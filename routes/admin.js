const express = require('express');
const {
  getDashboardStats,
  getSystemAnalytics,
  getUserActivity
} = require('../controllers/adminController');
const { auth, roleAuth } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/dashboard', roleAuth('admin'), getDashboardStats);
router.get('/analytics', roleAuth('admin'), getSystemAnalytics);
router.get('/user-activity', roleAuth('admin'), getUserActivity);

module.exports = router;