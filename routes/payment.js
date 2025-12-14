const express = require('express');
const {
  getPendingPaymentsAdmin,
  getPaymentAnalytics
} = require('../controllers/paymentController');
const { auth, roleAuth } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/pending', roleAuth('admin'), getPendingPaymentsAdmin);
router.get('/analytics', roleAuth('admin'), getPaymentAnalytics);

module.exports = router;