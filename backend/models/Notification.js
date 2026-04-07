import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  // Single-recipient notification (legacy + most current controllers)
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function () {
      return !(this.recipients && this.recipients.length > 0);
    }
  },
  recipients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: [
      'event_created',
      'event_updated',
      'event_cancelled',
      'event_rescheduled',
      'event_pair_invite',
      'registration_confirmed',
      'registration_cancelled',
      'payment_received',
      'payment_failed',
      'team_invitation',
      'team_joined',
      'team_removed',
      'query_received',
      'query_response',
      'achievement_unlocked',
      'reminder',
      'announcement',
      'system',
      // Coach & Academy connection types
      'connection_request',
      'connection_response',
      'approval_status_changed'
    ],
    required: true
  },
  title: {
    type: String,
    required: [true, 'Notification title is required']
  },
  message: {
    type: String,
    required: [true, 'Notification message is required']
  },
  data: {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
    },
    connectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Connection'
    },
    link: String,
    additionalInfo: mongoose.Schema.Types.Mixed
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isEmailSent: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Index for better query performance
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
