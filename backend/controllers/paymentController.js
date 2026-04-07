import Stripe from 'stripe';
import Payment from '../models/Payment.js';
import Event from '../models/Event.js';
import Team from '../models/Team.js';
import Notification from '../models/Notification.js';
import EventTeamRegistration from '../models/EventTeamRegistration.js';
import {
  calculatePlatformFee,
  makeTransactionId,
  updateRegistrationAfterPayment,
  sendRegistrationPaymentNotifications,
} from '../utils/eventRegistrationPayment.js';
import {
  prepareTeamEventRegistrationContext,
  persistEventTeamRegistrationWrites,
} from './teamController.js';

/**
 * After Stripe (or dummy) confirms payment: create team registration + revenue (pay-first flow).
 * Idempotent via payment.metadata.registrationFinalized.
 */
const finalizePayBeforeRegisterTeam = async (paymentDoc) => {
  const payment = await Payment.findById(paymentDoc._id);
  if (!payment?.metadata?.payBeforeRegister) return;
  if (payment.metadata?.registrationFinalized) return;

  const event = await Event.findById(payment.event).populate('sport');
  const team = await Team.findById(payment.team).populate('sport', 'name');
  if (!event || !team) {
    console.error('finalizePayBeforeRegisterTeam: missing event or team', String(payment._id));
    return;
  }

  const applyRevenueOnce = async () => {
    if (payment.metadata?.revenueRecorded) return;
    const ev = await Event.findById(event._id);
    if (!ev) return;
    ev.revenue = ev.revenue || {};
    ev.revenue.totalRegistrations = Number(ev.revenue.totalRegistrations || 0) + 1;
    ev.revenue.totalAmount = Number(ev.revenue.totalAmount || 0) + Number(payment.amount || 0);
    ev.revenue.platformFee = Number(ev.revenue.platformFee || 0) + Number(payment.platformFee || 0);
    ev.revenue.netAmount = Number(ev.revenue.netAmount || 0) + Number(payment.netAmount || 0);
    await ev.save();
    await Payment.findByIdAndUpdate(payment._id, {
      $set: { 'metadata.revenueRecorded': true },
    });
    payment.metadata = { ...payment.metadata, revenueRecorded: true };
  };

  const existing = await EventTeamRegistration.findOne({
    event: event._id,
    team: team._id,
    status: { $ne: 'withdrawn' },
  });

  if (existing) {
    const evFresh = await Event.findById(event._id);
    await persistEventTeamRegistrationWrites({
      event: evFresh,
      team,
      payStatus: 'completed',
      feeStatus: 'confirmed',
      actorUserId: payment.user,
      auditMetadata: { source: 'pay_before_register_idempotent' },
    });
    await applyRevenueOnce();
    await Payment.findByIdAndUpdate(payment._id, {
      $set: { 'metadata.registrationFinalized': true },
    });
    await sendRegistrationPaymentNotifications(payment, await Event.findById(event._id));
    return;
  }

  const actorRole = payment.metadata?.actorRole || 'organizer';
  const prep = await prepareTeamEventRegistrationContext({
    actorUserId: payment.user,
    actorRole,
    eventId: event._id,
    teamId: team._id,
  });

  if (!prep.ok) {
    console.error(
      'finalizePayBeforeRegisterTeam: validation failed after payment — manual fix may be needed',
      prep.message,
      String(payment._id)
    );
    return;
  }

  await persistEventTeamRegistrationWrites({
    event: prep.event,
    team: prep.team,
    payStatus: 'completed',
    feeStatus: 'confirmed',
    actorUserId: payment.user,
    auditMetadata: { source: 'pay_before_register' },
  });

  await applyRevenueOnce();

  const evFinal = await Event.findById(prep.event._id);
  await Notification.create({
    recipient: evFinal.organizer,
    sender: payment.user,
    type: 'registration_confirmed',
    title: 'Team Registration',
    message: `Team "${prep.team.name}" has been registered for "${evFinal.name}".`,
    data: { eventId: evFinal._id, teamId: prep.team._id },
  });
  await Notification.create({
    recipient: payment.user,
    sender: evFinal.organizer,
    type: 'registration_confirmed',
    title: 'Team Registered Successfully',
    message: `Your team "${prep.team.name}" has been registered for "${evFinal.name}".`,
    data: { eventId: evFinal._id, teamId: prep.team._id },
  });

  await sendRegistrationPaymentNotifications(payment, evFinal);

  await Payment.findByIdAndUpdate(payment._id, {
    $set: { 'metadata.registrationFinalized': true },
  });
};

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
};

const frontendOrigin = () =>
  (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')[0]
    .trim();

/** Stripe return URL after event registration checkout — matches role-scoped participant event routes. */
const participantEventReturnPath = (eventId, role) => {
  const id = String(eventId || '').trim();
  const r = String(role || '').toLowerCase();
  if (r === 'coach') return `/coach/events/${id}`;
  if (r === 'academyadmin') return `/academy/events/${id}`;
  if (r === 'organizer' || r === 'superadmin') return `/organizer/participant/events/${id}`;
  return `/player/events/${id}`;
};

const amountToStripeMinor = (amount, currency = 'INR') => {
  const cur = String(currency || 'INR').toLowerCase();
  const n = Number(amount || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const zeroDecimal = new Set(['jpy', 'krw', 'vnd', 'clp', 'ugx']);
  if (zeroDecimal.has(cur)) return Math.round(n);
  return Math.round(n * 100);
};

const buildStripeCheckoutSession = async ({ stripe, payment, event, teamId, reqUser }) => {
  const base = frontendOrigin();
  const returnPath = participantEventReturnPath(event._id, reqUser?.role);
  const success_url = `${base}${returnPath}?checkout=success`;
  const cancel_url = `${base}${returnPath}?checkout=cancel`;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    ...(reqUser?.email ? { customer_email: reqUser.email } : {}),
    line_items: [
      {
        price_data: {
          currency: String(event.currency || 'inr').toLowerCase(),
          unit_amount: amountToStripeMinor(payment.amount, event.currency),
          product_data: {
            name: `Event registration: ${event.name}`,
            description: teamId ? 'Team registration fee' : 'Player registration fee',
          },
        },
        quantity: 1,
      },
    ],
    success_url,
    cancel_url,
    metadata: {
      paymentMongoId: payment._id.toString(),
      eventId: event._id.toString(),
      userId: payment.user.toString(),
      teamId: teamId ? String(teamId) : '',
    },
    payment_intent_data: {
      metadata: {
        paymentMongoId: payment._id.toString(),
      },
    },
  });

  payment.stripeSessionId = session.id;
  payment.metadata = {
    ...(payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {}),
    stripeMode: 'checkout',
  };
  await payment.save();
  return session.url;
};

const ensureStripeCheckoutUrl = async ({ payment, event, teamId, reqUser }) => {
  const stripe = getStripe();
  if (!stripe) {
    return { checkoutUrl: null, stripeEnabled: false };
  }

  if (payment.stripeSessionId) {
    try {
      const sess = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
      if (sess.status === 'open' && sess.url) {
        return { checkoutUrl: sess.url, stripeEnabled: true };
      }
    } catch (_) {
      // create a fresh session below
    }
  }

  const url = await buildStripeCheckoutSession({ stripe, payment, event, teamId, reqUser });
  return { checkoutUrl: url, stripeEnabled: true };
};

// @desc    Coach / academy / organizer: pay first — team is registered automatically after successful payment (Stripe webhook or dummy confirm)
// @route   POST /api/teams/checkout-register-for-event
// @access  Private (coach, academyadmin, organizer)
export const createCheckoutRegisterTeamForEvent = async (req, res) => {
  try {
    const { eventId, teamId } = req.body;
    if (!eventId || !teamId) {
      return res.status(400).json({
        success: false,
        message: 'eventId and teamId are required',
      });
    }

    const prep = await prepareTeamEventRegistrationContext({
      actorUserId: req.user._id,
      actorRole: req.user.role,
      eventId,
      teamId,
    });
    if (!prep.ok) {
      return res.status(prep.status).json({ success: false, message: prep.message });
    }
    const { team, event } = prep;

    if (Number(event.registrationFee || 0) <= 0) {
      await persistEventTeamRegistrationWrites({
        event,
        team,
        payStatus: 'completed',
        feeStatus: 'confirmed',
        actorUserId: req.user._id,
        auditMetadata: { source: 'free_register_checkout_flow' },
      });
      await Notification.create({
        recipient: event.organizer,
        sender: req.user._id,
        type: 'registration_confirmed',
        title: 'Team Registration',
        message: `Team "${team.name}" has been registered for "${event.name}".`,
        data: { eventId: event._id, teamId: team._id },
      });
      await Notification.create({
        recipient: req.user._id,
        sender: event.organizer,
        type: 'registration_confirmed',
        title: 'Team Registered Successfully',
        message: `Your team "${team.name}" has been registered for "${event.name}".`,
        data: { eventId: event._id, teamId: team._id },
      });
      return res.status(201).json({
        success: true,
        message: 'Team registered successfully (no fee)',
        data: { team, registered: true, requiresPayment: false },
        checkoutUrl: null,
        stripeEnabled: Boolean(getStripe()),
        payBeforeRegister: false,
      });
    }

    const stripe = getStripe();
    if (!stripe) {
      return res.status(400).json({
        success: false,
        message:
          'Online payment is not configured (set STRIPE_SECRET_KEY). Use register-then-pay flow or ask the organizer for offline payment.',
      });
    }

    const existingPending = await Payment.findOne({
      user: req.user._id,
      event: eventId,
      team: team._id,
      paymentType: 'event_registration',
      status: { $in: ['pending', 'processing'] },
      'metadata.payBeforeRegister': true,
    }).sort({ createdAt: -1 });

    if (existingPending) {
      const { checkoutUrl, stripeEnabled } = await ensureStripeCheckoutUrl({
        payment: existingPending,
        event,
        teamId: team._id,
        reqUser: req.user,
      });
      return res.json({
        success: true,
        message: checkoutUrl
          ? 'Complete payment to register your team'
          : 'You already have a pending checkout for this team',
        data: existingPending,
        checkoutUrl,
        stripeEnabled,
        payBeforeRegister: true,
      });
    }

    const amount = Number(event.registrationFee || 0);
    const platformFee = calculatePlatformFee(amount);
    const payment = await Payment.create({
      user: req.user._id,
      event: eventId,
      team: team._id,
      paymentType: 'event_registration',
      amount,
      currency: event.currency || 'INR',
      status: 'pending',
      paymentMethod: 'upi',
      platformFee,
      description: `Register team for event: ${event.name}`,
      metadata: {
        payBeforeRegister: true,
        actorRole: req.user.role,
        source: 'stripe_checkout_pay_first',
      },
    });

    const { checkoutUrl, stripeEnabled } = await ensureStripeCheckoutUrl({
      payment,
      event,
      teamId: team._id,
      reqUser: req.user,
    });

    return res.status(201).json({
      success: true,
      message: checkoutUrl
        ? 'Complete payment — your team will be registered automatically'
        : 'Could not start Stripe Checkout',
      data: payment,
      checkoutUrl,
      stripeEnabled,
      payBeforeRegister: true,
    });
  } catch (error) {
    console.error('createCheckoutRegisterTeamForEvent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create registration payment (Stripe Checkout when STRIPE_SECRET_KEY is set; else dummy record only)
// @route   POST /api/payments/create-registration-intent
// @access  Private
export const createRegistrationIntent = async (req, res) => {
  try {
    const { eventId, teamId, paymentMethod = 'upi' } = req.body;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'eventId is required',
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    if (Number(event.registrationFee || 0) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This event does not require payment',
      });
    }

    if (teamId) {
      const teamExists = await Team.findById(teamId).select('_id');
      if (!teamExists) {
        return res.status(404).json({
          success: false,
          message: 'Team not found',
        });
      }
    }

    const existingPending = await Payment.findOne({
      user: req.user._id,
      event: eventId,
      team: teamId || null,
      paymentType: 'event_registration',
      status: { $in: ['pending', 'processing'] },
    }).sort({ createdAt: -1 });

    if (existingPending) {
      const { checkoutUrl, stripeEnabled } = await ensureStripeCheckoutUrl({
        payment: existingPending,
        event,
        teamId: teamId || existingPending.team || null,
        reqUser: req.user,
      });
      return res.json({
        success: true,
        message: checkoutUrl
          ? 'Continue to payment'
          : 'Existing pending payment found',
        data: existingPending,
        checkoutUrl,
        stripeEnabled,
      });
    }

    const amount = Number(event.registrationFee || 0);
    const platformFee = calculatePlatformFee(amount);
    const stripe = getStripe();

    const payment = await Payment.create({
      user: req.user._id,
      event: eventId,
      team: teamId || null,
      paymentType: 'event_registration',
      amount,
      currency: event.currency || 'INR',
      status: 'pending',
      paymentMethod,
      platformFee,
      description: `Registration payment for ${event.name}`,
      metadata: {
        source: stripe ? 'stripe_checkout' : 'dummy',
        createdByRole: req.user.role || 'user',
      },
    });

    const { checkoutUrl, stripeEnabled } = await ensureStripeCheckoutUrl({
      payment,
      event,
      teamId,
      reqUser: req.user,
    });

    return res.status(201).json({
      success: true,
      message: checkoutUrl
        ? 'Complete payment on Stripe Checkout'
        : 'Registration payment intent created',
      data: payment,
      checkoutUrl,
      stripeEnabled,
    });
  } catch (error) {
    console.error('Create registration intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Stripe webhook — confirms event registration payment (raw body)
// @route   POST /api/payments/webhook/stripe
export const handleStripeWebhook = async (req, res) => {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return res.status(503).json({ success: false, message: 'Stripe webhook not configured' });
  }

  const sig = req.headers['stripe-signature'];
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const finalizeFromPaymentMongoId = async (paymentMongoId, stripePaymentIntentId, receiptUrl) => {
    if (!paymentMongoId) return;
    const payment = await Payment.findById(paymentMongoId);
    if (!payment || payment.status === 'completed') return;

    payment.status = 'completed';
    payment.paidAt = new Date();
    payment.transactionId =
      payment.transactionId || stripePaymentIntentId || makeTransactionId('STRIPE');
    if (stripePaymentIntentId) payment.stripePaymentIntentId = stripePaymentIntentId;
    if (receiptUrl) payment.receiptUrl = receiptUrl;
    await payment.save();

    if (payment.metadata?.payBeforeRegister) {
      await finalizePayBeforeRegisterTeam(payment);
      return;
    }

    const event = payment.event ? await Event.findById(payment.event) : null;
    if (event) {
      await updateRegistrationAfterPayment({
        event,
        payment,
        userId: payment.user,
      });
      await sendRegistrationPaymentNotifications(payment, event);
    }
  };

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const paymentMongoId = session.metadata?.paymentMongoId;
      const pi =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;
      await finalizeFromPaymentMongoId(paymentMongoId, pi, session.receipt_url || null);
    } else if (stripeEvent.type === 'payment_intent.succeeded') {
      const pi = stripeEvent.data.object;
      const paymentMongoId = pi.metadata?.paymentMongoId;
      await finalizeFromPaymentMongoId(paymentMongoId, pi.id, null);
    }
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }

  res.json({ received: true });
};

// @desc    Dev / fallback: mark payment completed without Stripe (not for production if using real fees)
// @route   POST /api/payments/:id/confirm
// @access  Private
export const confirmPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    if (String(payment.user) !== String(req.user._id) && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to confirm this payment',
      });
    }

    if (payment.status === 'completed') {
      return res.json({
        success: true,
        message: 'Payment already completed',
        data: payment,
      });
    }

    payment.status = 'completed';
    payment.paidAt = new Date();
    payment.transactionId = payment.transactionId || makeTransactionId('PAY');
    payment.metadata = {
      ...(payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {}),
      confirmedVia: 'api_dummy_confirm',
    };
    await payment.save();

    if (payment.metadata?.payBeforeRegister) {
      await finalizePayBeforeRegisterTeam(payment);
    } else {
      const event = payment.event ? await Event.findById(payment.event) : null;
      if (event) {
        await updateRegistrationAfterPayment({
          event,
          payment,
          userId: payment.user,
        });
        await sendRegistrationPaymentNotifications(payment, event);
      }
    }

    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      data: payment,
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * Organizer confirms payment after participant paid via static bank/UPI QR.
 * Static QR payments are NOT reported to your server automatically — you verify in your bank app
 * (and optional UTR submitted by the team) then mark paid here.
 */
export const confirmOfflineTeamEventRegistration = async (req, res) => {
  try {
    const { id: eventId, teamId } = req.params;
    const { referenceNote } = req.body || {};

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (
      String(event.organizer) !== String(req.user._id) &&
      req.user.role !== 'superadmin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Only the event organizer can confirm offline payments',
      });
    }

    const reg = await EventTeamRegistration.findOne({
      event: eventId,
      team: teamId,
      status: { $ne: 'withdrawn' },
    });

    if (!reg) {
      return res.status(404).json({
        success: false,
        message: 'Team is not registered for this event',
      });
    }

    if (reg.paymentStatus === 'completed') {
      const refreshed = await EventTeamRegistration.findById(reg._id).lean();
      return res.json({
        success: true,
        message: 'Payment already marked as completed',
        data: { registration: refreshed },
      });
    }

    const payerId = reg.registeredBy || req.user._id;
    const amount = Number(event.registrationFee || 0);
    const platformFee = calculatePlatformFee(amount);

    const payment = await Payment.create({
      user: payerId,
      event: eventId,
      team: teamId,
      paymentType: 'event_registration',
      amount,
      currency: event.currency || 'INR',
      status: 'completed',
      paymentMethod: 'other',
      platformFee,
      paidAt: new Date(),
      transactionId: makeTransactionId('OFFLINE'),
      description: `Offline payment confirmed by organizer for ${event.name}`,
      metadata: {
        channel: 'offline_qr',
        referenceNote: String(referenceNote || '').trim(),
        confirmedByOrganizer: String(req.user._id),
        confirmedAt: new Date().toISOString(),
      },
    });

    const eventFresh = await Event.findById(eventId);
    await updateRegistrationAfterPayment({
      event: eventFresh,
      payment,
      userId: payerId,
    });
    await sendRegistrationPaymentNotifications(payment, eventFresh);

    const registration = await EventTeamRegistration.findById(reg._id).lean();

    res.json({
      success: true,
      message: 'Team registration payment marked as paid',
      data: { registration, payment },
    });
  } catch (error) {
    console.error('confirmOfflineTeamEventRegistration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get current user payments
// @route   GET /api/payments/my
// @access  Private
export const getMyPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type } = req.query;
    const query = { user: req.user._id };
    if (status) query.status = status;
    if (type) query.paymentType = type;

    const payments = await Payment.find(query)
      .populate('event', 'name sport startDate')
      .populate('team', 'name')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Payment.countDocuments(query);

    res.json({
      success: true,
      data: payments,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)) || 1,
        total,
      },
    });
  } catch (error) {
    console.error('Get my payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
