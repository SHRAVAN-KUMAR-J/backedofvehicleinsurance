const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  attachments: [{
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['image', 'pdf', 'document'],
      required: true
    },
    filename: {
      type: String,
      required: true
    }
  }],
  seen: {
    type: Boolean,
    default: false
  },
  seenAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);