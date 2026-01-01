const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    chassisNumber: {
      type: String,
      required: false,
      uppercase: true,
      trim: true,
      sparse: true,
      default: null,
    },
    model: {
      type: String,
      required: [true, 'Vehicle model is required'],
      trim: true,
      maxlength: [100, 'Model cannot exceed 100 characters'],
    },
    insurancePolicy: {
      type: String,
      trim: true,
      maxlength: [100, 'Policy number cannot exceed 100 characters'],
    },
    insuranceAmount: {
      type: Number,
      default: null,
    },
    vehicleImage: {
      type: String,
      trim: true,
    },
    feature1: {
      type: String,
      trim: true,
      maxlength: [100, 'Feature cannot exceed 100 characters'],
    },
    feature2: {
      type: String,
      trim: true,
      maxlength: [100, 'Feature cannot exceed 100 characters'],
    },
    feature3: {
      type: String,
      trim: true,
      maxlength: [100, 'Feature cannot exceed 100 characters'],
    },
    startDate: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    activationReminderScheduledAt: {
      type: Date,
      default: null,
    },
    activationReminderSent: {
      type: Boolean,
      default: false,
    },
    monthReminderScheduledAt: {
      type: Date,
      default: null,
    },
    monthReminderSent: {
      type: Boolean,
      default: false,
    },
    preExpiryReminderScheduledAt: {
      type: Date,
      default: null,
    },
    preExpiryReminderSent: {
      type: Boolean,
      default: false,
    },
    insuranceSetBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    insuranceSetAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    razorpayOrderId: {
      type: String,
      default: null,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

vehicleSchema.pre('save', function (next) {
  if (this.isModified('startDate') && this.startDate && !this.activationReminderScheduledAt) {
    this.activationReminderScheduledAt = new Date(this.startDate.getTime() + 24 * 60 * 60 * 1000);
    console.log(`Scheduled activation reminder for ${this.registrationNumber} at ${this.activationReminderScheduledAt}`);
  }
  
  if (this.isModified('startDate') && this.startDate && !this.monthReminderScheduledAt) {
    this.monthReminderScheduledAt = new Date(this.startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    console.log(`Scheduled month reminder for ${this.registrationNumber} at ${this.monthReminderScheduledAt}`);
  }
  
  if (this.isModified('expiryDate') && this.expiryDate && !this.preExpiryReminderScheduledAt) {
    this.preExpiryReminderScheduledAt = new Date(this.expiryDate.getTime() - 24 * 60 * 60 * 1000);
    console.log(`Scheduled pre-expiry reminder for ${this.registrationNumber} at ${this.preExpiryReminderScheduledAt}`);
  }
  
  next();
});

vehicleSchema.index({ registrationNumber: 1 });
vehicleSchema.index({ chassisNumber: 1 }, { sparse: true });
vehicleSchema.index({ expiryDate: 1 });
vehicleSchema.index({ activationReminderScheduledAt: 1 });
vehicleSchema.index({ monthReminderScheduledAt: 1 });
vehicleSchema.index({ preExpiryReminderScheduledAt: 1 });

module.exports = mongoose.model('Vehicle', vehicleSchema);