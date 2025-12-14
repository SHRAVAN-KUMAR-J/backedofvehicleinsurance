const express = require('express');
const {
  getOrCreateConversation,
  getConversationHistory,
  markMessageAsSeen,
  getConversations,
  getAvailableUsers,
  getUnreadChatCount
} = require('../controllers/chatController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/conversations', getConversations);
router.get('/available-users', getAvailableUsers);
router.get('/unread-count', getUnreadChatCount);
router.get('/conversation/:participantId', getOrCreateConversation);
router.get('/history/:conversationId', getConversationHistory);
router.put('/message/:messageId/seen', markMessageAsSeen);

module.exports = router;

