const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
      match: [/^\d{10}$/, 'Mobile number must be 10 digits'],
    },
    role: {
      type: String,
      enum: ['customer', 'staff', 'admin'],
      required: true,
    },
    profileImage: {
      url: { type: String },
      publicId: { type: String },
    },
    accountStatus: {
      type: String,
      enum: ['pending', 'active', 'banned'],
      default: 'pending',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.index({ email: 1 });
userSchema.index({ mobile: 1 });
userSchema.index({ createdAt: 1 }); // Added for analytics queries

module.exports = mongoose.model('User', userSchema);