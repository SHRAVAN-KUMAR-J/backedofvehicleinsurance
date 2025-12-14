const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 🔒 Basic authentication middleware
const auth = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header or cookie
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // No token found
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token provided',
      });
    }

    // Verify and decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not found',
      });
    }

    // If user is banned
    if (user.accountStatus === 'banned') {
      return res.status(403).json({
        success: false,
        message: 'Account is banned',
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Not authorized, token failed',
    });
  }
};

// 🧩 Role-based access middleware
const roleAuth = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user?.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

module.exports = { auth, roleAuth };
