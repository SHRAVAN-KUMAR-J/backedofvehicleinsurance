// controllers/authController.js
const User = require('../models/User');
const OTP = require('../models/OTP');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOTP, sendRegistrationSuccess, sendLoginSuccess } = require('../utils/email');

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// ✅ OPTIMIZATION 1: Reduce bcrypt rounds for OTP (it's temporary anyway)
const BCRYPT_ROUNDS_OTP = 8; // Reduced from 12 - OTPs expire in 10 min
const BCRYPT_ROUNDS_PASSWORD = 10; // Keep standard for passwords

const requestOTP = async (req, res) => {
  try {
    const { email, role, mobile, name, password } = req.body;

    const { error } = require('../middleware/validate').validateUser.validate({
      email,
      role,
      mobile,
      name,
      password,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    // ✅ OPTIMIZATION 2: Check existing user AND OTP in parallel
    const [existingUser, existingOTP] = await Promise.all([
      User.findOne({ email }),
      OTP.findOne({ email, purpose: 'register' })
    ]);

    let user = existingUser;

    if (!user) {
      user = new User({
        name,
        email,
        mobile,
        role,
        password,
        accountStatus: 'pending',
        isVerified: false,
      });
      await user.save();
    } else if (user.accountStatus === 'banned') {
      return res.status(403).json({
        success: false,
        message: 'Account is banned',
      });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const hashedOtp = await bcrypt.hash(otp, BCRYPT_ROUNDS_OTP);

    // ✅ OPTIMIZATION 3: Update or create OTP in one operation
    if (existingOTP) {
      existingOTP.otpHash = hashedOtp;
      existingOTP.expiresAt = expiresAt;
      existingOTP.attempts = 0;
      existingOTP.userId = user._id;
      await existingOTP.save();
    } else {
      await OTP.create({
        email,
        otpHash: hashedOtp,
        purpose: 'register',
        expiresAt,
        userId: user._id,
        attempts: 0,
      });
    }

    // ✅ OPTIMIZATION 4: Send email AFTER response (fire and forget)
    res.status(200).json({
      success: true,
      message: 'OTP sent to your email',
      data: {
        email: user.email,
        userId: user._id,
      },
    });

    // Email sent AFTER response - doesn't block user
    sendOTP(email, otp, 'Registration').catch(err => {
      console.error('Background email error:', err);
    });

  } catch (error) {
    console.error('Request OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP',
    });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required',
      });
    }

    const otpDoc = await OTP.findOne({
      email,
      purpose: 'register',
      expiresAt: { $gt: new Date() },
    }).populate('userId');

    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please request a new OTP.',
      });
    }

    if (otpDoc.attempts >= 5) {
      await OTP.deleteOne({ _id: otpDoc._id });
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.',
      });
    }

    const isMatch = await otpDoc.compareOTP(otp);

    if (!isMatch) {
      otpDoc.attempts = (otpDoc.attempts || 0) + 1;
      await otpDoc.save();
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${5 - otpDoc.attempts} attempts remaining.`,
      });
    }

    const user = otpDoc.userId;
    
    // ✅ OPTIMIZATION 5: Update user and delete OTP in parallel
    await Promise.all([
      User.findByIdAndUpdate(user._id, {
        isVerified: true,
        accountStatus: 'active'
      }),
      OTP.deleteOne({ _id: otpDoc._id })
    ]);

    // ✅ Send response immediately
    res.status(200).json({
      success: true,
      message: 'Verification successful. Please login to continue.',
      data: {
        email: user.email,
        role: user.role,
      },
    });

    // ✅ Email sent in background
    sendRegistrationSuccess(user.email, user).catch(err => {
      console.error('Background email error:', err);
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, role, password } = req.body;

    if (!email || !role || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email, role, and password are required',
      });
    }

    // ✅ OPTIMIZATION 6: Use lean() for faster query (no Mongoose overhead)
    const user = await User.findOne({ email, role })
      .select('+password')
      .lean(); // Returns plain JS object, much faster

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const token = generateToken(user._id);

    // ✅ OPTIMIZATION 7: Send response IMMEDIATELY
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        mobile: user.mobile,
        accountStatus: user.accountStatus,
      },
    });

    // ✅ CRITICAL: Email sent AFTER response (fire and forget)
    // User gets instant response, email sends in background
    sendLoginSuccess(user.email, user).catch(err => {
      console.error('Background login email error:', err);
      // Don't throw - login was successful regardless
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process login',
    });
  }
};

module.exports = {
  requestOTP,
  verifyOTP,
  login,
};

