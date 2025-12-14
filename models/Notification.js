const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    type: {
      type: String,
      enum: ['reminder', 'approval', 'message', 'update'],
      required: true,
    },
    metadata: {
      insuranceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Insurance',
      },
      reminderDays: Number,
      conversationId: String,
      senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
    isSeen: {
      type: Boolean,
      default: false,
    },
    seenAt: {
      type: Date,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isSeen: 1 });

module.exports = mongoose.model('Notification', notificationSchema);