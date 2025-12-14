const ChatMessage = require('../models/ChatMessage');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { generateConversationId } = require('../utils/helpers');

const getOrCreateConversation = async (req, res) => {
  try {
    const { participantId } = req.params;
    const user1 = req.user.id;
    const user2 = participantId;

    if (user1.toString() === user2.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create conversation with yourself',
      });
    }

    const participant = await User.findById(participantId).select('name email profileImage');
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found',
      });
    }

    const conversationId = generateConversationId(user1, user2);
    let conversation = await Conversation.findOne({ conversationId });

    if (!conversation) {
      conversation = new Conversation({
        participants: [user1, user2],
        conversationId,
      });
      await conversation.save();
    }

    await conversation.populate('participants', 'name email profileImage');
    await conversation.populate('lastMessage');

    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error('Get or create conversation error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get/create conversation',
    });
  }
};

const getConversationHistory = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    if (!conversation.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this conversation',
      });
    }

    const messages = await ChatMessage.find({ conversationId })
      .populate('senderId', 'name profileImage')
      .populate('receiverId', 'name profileImage')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ChatMessage.countDocuments({ conversationId });

    res.status(200).json({
      success: true,
      count: messages.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: messages,
    });
  } catch (error) {
    console.error('Get conversation history error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch conversation history',
    });
  }
};

const markMessageAsSeen = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await ChatMessage.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    if (message.receiverId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to mark this message as seen',
      });
    }

    if (message.seen) {
      return res.status(200).json({
        success: true,
        message: 'Message already seen',
      });
    }

    message.seen = true;
    message.seenAt = new Date();
    await message.save();

    await Conversation.findOneAndUpdate(
      { conversationId: message.conversationId },
      { $inc: { [`unreadCount.${req.user.id}`]: -1 } }
    );

    res.status(200).json({
      success: true,
      message: 'Message marked as seen',
      data: message,
    });
  } catch (error) {
    console.error('Mark message as seen error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark message as seen',
    });
  }
};

const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user.id })
      .populate('participants', 'name email profileImage')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 });

    const formattedConversations = conversations.map((conversation) => {
      const otherParticipant = conversation.participants.find(
        (p) => p._id.toString() !== req.user.id.toString()
      );
      const lastMessage = conversation.lastMessage;

      return {
        id: conversation._id,
        conversationId: conversation.conversationId,
        participant: otherParticipant,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              createdAt: lastMessage.createdAt,
              senderId: lastMessage.senderId,
            }
          : null,
        lastMessageAt: conversation.lastMessageAt,
        unreadCount: conversation.unreadCount
          ? conversation.unreadCount.get(req.user.id.toString()) || 0
          : 0,
      };
    });

    res.status(200).json({
      success: true,
      count: formattedConversations.length,
      data: formattedConversations,
    });
  } catch (error) {
    console.error('Get conversations error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch conversations',
    });
  }
};

const getAvailableUsers = async (req, res) => {
  try {
    const currentUser = req.user;
    let query = {};

    if (currentUser.role === 'customer') {
      query.role = 'staff';
    } else if (currentUser.role === 'staff') {
      query.role = { $in: ['customer', 'admin'] };
    } else if (currentUser.role === 'admin') {
      query.role = { $in: ['customer', 'staff'] };
    }

    query._id = { $ne: currentUser.id };
    query.accountStatus = 'active';

    const users = await User.find(query)
      .select('name email profileImage role')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error('Get available users error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch available users',
    });
  }
};

const getUnreadChatCount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const count = await ChatMessage.countDocuments({
      receiverId: userId,
      seen: false,
    });

    res.status(200).json({
      success: true,
      unreadCount: count,
    });
  } catch (error) {
    console.error('Get unread chat count error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch unread chat count',
    });
  }
};

module.exports = {
  getOrCreateConversation,
  getConversationHistory,
  markMessageAsSeen,
  getConversations,
  getAvailableUsers,
  getUnreadChatCount,
};