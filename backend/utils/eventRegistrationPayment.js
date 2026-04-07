import Notification from '../models/Notification.js';
import EventPlayerRegistration from '../models/EventPlayerRegistration.js';
import EventTeamRegistration from '../models/EventTeamRegistration.js';
import Team from '../models/Team.js';

export const calculatePlatformFee = (amount) => {
  const value = Number(amount || 0);
  return Number((value * 0.05).toFixed(2));
};

export const makeTransactionId = (prefix = 'TXN') =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

export const isOrganizerOfEvent = (event, userId) => String(event?.organizer) === String(userId);

/**
 * After a successful Payment (gateway or manual), sync Event*Registration collections,
 * legacy embedded arrays on Event, optional Team payment fields, and revenue counters.
 */
export const updateRegistrationAfterPayment = async ({ event, payment, userId }) => {
  let updated = false;
  const payerId = userId;

  if (event?._id) {
    const playerReg = await EventPlayerRegistration.findOne({
      event: event._id,
      player: userId,
      status: { $ne: 'withdrawn' },
    });
    if (playerReg) {
      if (playerReg.pairGroupId) {
        await EventPlayerRegistration.updateMany(
          {
            event: event._id,
            pairGroupId: playerReg.pairGroupId,
            status: { $ne: 'withdrawn' },
          },
          {
            $set: {
              paymentStatus: 'completed',
              status: 'confirmed',
              paymentCompletedBy: payerId,
            },
          }
        );
      } else {
        playerReg.paymentStatus = 'completed';
        playerReg.status = 'confirmed';
        playerReg.paymentCompletedBy = payerId;
        await playerReg.save();
      }
      updated = true;
    }

    if (payment.team) {
      const teamReg = await EventTeamRegistration.findOne({
        event: event._id,
        team: payment.team,
        status: { $ne: 'withdrawn' },
      });
      if (teamReg) {
        teamReg.paymentStatus = 'completed';
        teamReg.status = 'confirmed';
        await teamReg.save();
        updated = true;
      }
    }
  }

  const playerRegLegacy = event.registeredPlayers?.find(
    (p) => String(p.player) === String(userId) && p.status !== 'withdrawn'
  );
  if (playerRegLegacy) {
    playerRegLegacy.paymentStatus = 'completed';
    playerRegLegacy.status = 'confirmed';
    playerRegLegacy.paymentCompletedBy = payerId;
    if (event.gameFormat === 'doubles' && playerRegLegacy.partner) {
      const partnerRow = event.registeredPlayers.find(
        (p) =>
          String(p.player) === String(playerRegLegacy.partner) && p.status !== 'withdrawn'
      );
      if (partnerRow) {
        partnerRow.paymentStatus = 'completed';
        partnerRow.status = 'confirmed';
        partnerRow.paymentCompletedBy = payerId;
      }
    }
    updated = true;
  }

  if (payment.team) {
    const teamRegLegacy = event.registeredTeams?.find(
      (t) => String(t.team) === String(payment.team) && t.status !== 'withdrawn'
    );
    if (teamRegLegacy) {
      teamRegLegacy.paymentStatus = 'completed';
      teamRegLegacy.status = 'confirmed';
      updated = true;
    }

    await Team.findByIdAndUpdate(payment.team, {
      paymentStatus: 'completed',
      registrationStatus: 'approved',
      paymentDetails: {
        amount: payment.amount,
        currency: payment.currency,
        transactionId: payment.transactionId,
        paidAt: payment.paidAt || new Date(),
      },
    });
  }

  if (updated) {
    event.revenue = event.revenue || {};
    event.revenue.totalRegistrations = Number(event.revenue.totalRegistrations || 0) + 1;
    event.revenue.totalAmount = Number(event.revenue.totalAmount || 0) + Number(payment.amount || 0);
    event.revenue.platformFee = Number(event.revenue.platformFee || 0) + Number(payment.platformFee || 0);
    event.revenue.netAmount = Number(event.revenue.netAmount || 0) + Number(payment.netAmount || 0);
    await event.save();
  }

  return updated;
};

export const sendRegistrationPaymentNotifications = async (payment, event) => {
  if (!event?._id) return;
  await Notification.create({
    recipient: payment.user,
    sender: event.organizer,
    type: 'payment_received',
    title: 'Payment Successful',
    message: `Your payment for "${event.name}" is confirmed.`,
    data: { eventId: event._id, paymentId: payment._id },
  });

  if (event.organizer && !isOrganizerOfEvent(event, payment.user)) {
    await Notification.create({
      recipient: event.organizer,
      sender: payment.user,
      type: 'payment_received',
      title: 'Registration Payment Received',
      message: `Payment received for "${event.name}".`,
      data: { eventId: event._id, paymentId: payment._id },
    });
  }
};
