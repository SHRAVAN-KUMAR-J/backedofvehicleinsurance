// routes/auth.js
const express = require('express');
const { requestOTP, verifyOTP, login } = require('../controllers/authController');

const router = express.Router();

// Request OTP for registration
router.post('/request-otp', requestOTP);

// Verify OTP (registration)
router.post('/verify-otp', verifyOTP);

// Login (used by frontend to sign in)
router.post('/login', login);

// For compatibility if some frontend code hits /login-password:
// keep a duplicate route that maps to same controller
router.post('/login-password', login);

module.exports = router;
