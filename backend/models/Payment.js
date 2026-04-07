import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },
  paymentType: {
    type: String,
    enum: [
      'event_registration',
      'organizer_subscription',
      'academy_subscription',
      'coach_subscription',
      'platform_fee',
      'refund',
    ],
    required: true
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required']
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'wallet', 'other'],
    default: 'card'
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  stripePaymentIntentId: String,
  stripeSessionId: String,
  receiptUrl: String,
  description: String,
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  refundReason: String,
  refundedAt: Date,
  refundAmount: Number,
  platformFee: {
    type: Number,
    default: 0
  },
  netAmount: {
    type: Number,
    default: 0
  },
  paidAt: Date,
  failureReason: String
}, {
  timestamps: true
});

// Index for better query performance
paymentSchema.index({ user: 1, status: 1, createdAt: -1 });
paymentSchema.index({ event: 1 });

// Pre-save hook to calculate net amount
paymentSchema.pre('save', function(next) {
  if (this.isModified('amount') || this.isModified('platformFee')) {
    this.netAmount = this.amount - this.platformFee;
  }
  next();
});

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
