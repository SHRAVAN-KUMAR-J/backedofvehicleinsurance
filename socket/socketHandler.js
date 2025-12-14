const jwt = require('jsonwebtoken');
const ChatMessage = require('../models/ChatMessage');
const Conversation = require('../models/Conversation');

let connectedUsers = new Map();

const socketHandler = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    console.log(`👤 User connected: ${userId}`);
    
    connectedUsers.set(userId, socket.id);
    socket.join(`user:${userId}`);

    socket.emit('connected', {
      userId,
      message: 'Connected to chat server',
    });

    socket.on('join_conversation', async ({ conversationId }) => {
      try {
        const conversation = await Conversation.findOne({ conversationId });
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        if (!conversation.participants.includes(userId)) {
          socket.emit('error', { message: 'Not authorized for this conversation' });
          return;
        }

        socket.join(`conv:${conversationId}`);
        console.log(`🔗 ${userId} joined conversation: ${conversationId}`);
      } catch (error) {
        console.error('Join conversation error:', error);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    socket.on('send_message', async ({ conversationId, to, content, attachments = [] }, callback) => {
      try {
        if (!content.trim() && attachments.length === 0) {
          callback({ error: 'Message content or attachments are required' });
          return;
        }

        const conversation = await Conversation.findOne({ conversationId });
        if (!conversation) {
          callback({ error: 'Conversation not found' });
          return;
        }

        if (!conversation.participants.includes(to)) {
          callback({ error: 'Receiver is not a participant in this conversation' });
          return;
        }

        const message = new ChatMessage({
          conversationId,
          senderId: userId,
          receiverId: to,
          content: content.trim(),
          attachments,
        });

        await message.save();

        await message.populate([
          { path: 'senderId', select: 'name profileImage' },
          { path: 'receiverId', select: 'name profileImage' },
        ]);

        await Conversation.findOneAndUpdate(
          { conversationId },
          {
            lastMessage: message._id,
            lastMessageAt: message.createdAt,
            $inc: { [`unreadCount.${to}`]: 1 },
          }
        );

        const formattedMessage = {
          _id: message._id,
          id: message._id,
          conversationId: message.conversationId,
          senderId: message.senderId._id,
          receiverId: message.receiverId._id,
          sender: {
            id: message.senderId._id,
            name: message.senderId.name,
            profileImage: message.senderId.profileImage?.url,
          },
          content: message.content,
          attachments: message.attachments,
          seen: message.seen,
          createdAt: message.createdAt,
        };

        // Send to receiver only (not to sender's other tabs)
        io.to(`user:${to}`).emit('receive_message', formattedMessage);

        // Send acknowledgment to sender
        callback({
          success: true,
          message: formattedMessage,
          timestamp: message.createdAt,
        });

        console.log(`💬 Message sent from ${userId} to ${to}: ${content.substring(0, 50)}...`);
      } catch (error) {
        console.error('Send message error:', error);
        callback({ error: 'Failed to send message' });
      }
    });

    socket.on('message_seen', async ({ messageId, conversationId }) => {
      try {
        const message = await ChatMessage.findById(messageId);
        if (!message || message.receiverId.toString() !== userId.toString()) {
          socket.emit('error', { message: 'Invalid message or unauthorized' });
          return;
        }

        if (message.seen) {
          socket.emit('message_seen_ack', { messageId, alreadySeen: true });
          return;
        }

        message.seen = true;
        message.seenAt = new Date();
        await message.save();

        await Conversation.findOneAndUpdate(
          { conversationId },
          { $inc: { [`unreadCount.${userId}`]: -1 } }
        );

        const senderSocketId = connectedUsers.get(message.senderId.toString());
        if (senderSocketId) {
          io.to(senderSocketId).emit('message_seen', {
            messageId,
            seenAt: message.seenAt,
            userId,
          });
        }

        socket.emit('message_seen_ack', {
          messageId,
          seenAt: message.seenAt,
        });

        console.log(`👁️ Message ${messageId} marked as seen by ${userId}`);
      } catch (error) {
        console.error('Message seen error:', error);
        socket.emit('error', { message: 'Failed to mark message as seen' });
      }
    });

    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(`conv:${conversationId}`).emit('typing', {
        userId,
        conversationId,
        isTyping,
      });
    });

    socket.on('disconnect', () => {
      console.log(`👋 User disconnected: ${userId}`);
      connectedUsers.delete(userId);
      socket.leave(`user:${userId}`);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
      socket.emit('error', { message: error.message });
    });
  });
};

module.exports = socketHandler;