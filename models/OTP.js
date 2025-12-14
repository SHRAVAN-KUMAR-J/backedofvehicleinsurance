// models/OTP.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true
  },
  otpHash: {
    type: String,
    required: [true, 'OTP hash is required']
  },
  purpose: {
    type: String,
    enum: ['register', 'reset'],
    required: [true, 'Purpose is required']
  },
  expiresAt: {
    type: Date,
    required: [true, 'Expiry time is required']
  },
  attempts: {
    type: Number,
    default: 0
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

otpSchema.methods.compareOTP = async function(candidateOTP) {
  return await bcrypt.compare(candidateOTP.toString(), this.otpHash);
};

otpSchema.index({ email: 1, purpose: 1 }, { unique: true });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OTP', otpSchema);