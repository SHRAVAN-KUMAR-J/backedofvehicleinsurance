// models/Vehicle.js
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
      unique: true,
      sparse: true,
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
  {
    timestamps: true,
  }
);

vehicleSchema.index({ registrationNumber: 1 });
vehicleSchema.index({ chassisNumber: 1 }, { sparse: true });
vehicleSchema.index({ expiryDate: 1 });

module.exports = mongoose.model('Vehicle', vehicleSchema);