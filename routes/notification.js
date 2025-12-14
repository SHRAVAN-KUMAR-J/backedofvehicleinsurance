const express = require('express');
const {
  getNotifications,
  markAsSeen,
  markAllAsSeen,
  getNotificationStats
} = require('../controllers/notificationController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/', getNotifications);
router.put('/:notificationId/seen', markAsSeen);
router.put('/mark-all-seen', markAllAsSeen);
router.get('/stats', getNotificationStats);

module.exports = router;