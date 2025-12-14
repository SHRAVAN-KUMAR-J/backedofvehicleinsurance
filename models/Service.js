const mongoose = require('mongoose');

const requiredDocSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Document name is required'],
    trim: true,
    maxlength: [100, 'Document name cannot exceed 100 characters'],
  },
  sampleUrl: {
    type: String,
    trim: true,
  },
});

const serviceSchema = new mongoose.Schema(
  {
    serviceName: {
      type: String,
      required: [true, 'Service name is required'],
      unique: true,
      trim: true,
      maxlength: [100, 'Service name cannot exceed 100 characters'],
    },
    explanation: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },
    priceRange: {
      type: String,
      trim: true,
    },
    requiredDocs: [requiredDocSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

serviceSchema.index({ serviceName: 1 });
serviceSchema.index({ createdAt: 1 }); // Added for analytics

module.exports = mongoose.model('Service', serviceSchema);