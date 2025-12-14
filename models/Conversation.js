const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  conversationId: {
    type: String,
    required: true,
    unique: true
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatMessage'
  },
  lastMessageAt: {
    type: Date
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  }
}, {
  timestamps: true
});

conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);