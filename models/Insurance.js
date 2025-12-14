// models/Insurance.js
const mongoose = require('mongoose');

const insuranceSchema = new mongoose.Schema(
  {
    registrationNumber: {
      type: String,
      required: true,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
    },
    pdfFilename: {
      type: String,
    },
    pdfUrl: {
      type: String,
    },
    paymentMarkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
    },
    // Added customer name field for direct access
    customerName: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Insurance', insuranceSchema);