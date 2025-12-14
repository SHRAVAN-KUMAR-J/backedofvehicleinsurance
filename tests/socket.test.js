const io = require('socket.io-client');
const server = require('../server');
const jwt = require('jsonwebtoken');
const ChatMessage = require('../models/ChatMessage');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const User = require('../models/User');
const supertest = require('supertest');

describe('Socket.IO Chat Integration', () => {
  let user1Token, user2Token;
  let user1, user2;
  let user1Socket, user2Socket;
  let conversation;

  beforeAll(async () => {
    const app = server;
    const request = supertest(app);

    user1 = new User({
      name: 'Socket User 1',
      email: 'socket1@test.com',
      mobile: '9876543218',
      role: 'customer',
      password: '$2a$12$testpasswordhash',
      accountStatus: 'active',
      isVerified: true
    });
    await user1.save();

    user2 = new User({
      name: 'Socket User 2',
      email: 'socket2@test.com',
      mobile: '9876543219',
      role: 'staff',
      password: '$2a$12$testpasswordhash',
      accountStatus: 'active',
      isVerified: true
    });
    await user2.save();

    const user1Login = await request
      .post('/api/auth/login')
      .send({ email: user1.email, role: user1.role });
    
    const user1OTP = await request
      .post('/api/auth/verify-login-otp')
      .send({ email: user1.email, otp: '123456' });
    user1Token = user1OTP.body.token;

    const user2Login = await request
      .post('/api/auth/login')
      .send({ email: user2.email, role: user2.role });
    
    const user2OTP = await request
      .post('/api/auth/verify-login-otp')
      .send({ email: user2.email, otp: '123456' });
    user2Token = user2OTP.body.token;
  });

  beforeEach((done) => {
    const user1Decoded = jwt.verify(user1Token, process.env.JWT_SECRET);
    const user2Decoded = jwt.verify(user2Token, process.env.JWT_SECRET);

    const sortedUsers = [user1Decoded.id, user2Decoded.id].sort();
    const conversationId = `conv_${sortedUsers[0]}_${sortedUsers[1]}`;

    conversation = new Conversation({
      participants: [user1._id, user2._id],
      conversationId
    });
    conversation.save();

    const socketUrl = `http://localhost:${process.env.PORT}`;
    
    user1Socket = io(socketUrl, {
      auth: { token: user1Token }
    });

    user2Socket = io(socketUrl, {
      auth: { token: user2Token }
    });

    user1Socket.on('connect', () => {
      user2Socket.on('connect', () => {
        done();
      });
    });
  });

  afterEach((done) => {
    if (user1Socket.connected) user1Socket.disconnect();
    if (user2Socket.connected) user2Socket.disconnect();
    
    ChatMessage.deleteMany({}).then(() => {
      Notification.deleteMany({}).then(() => done());
    });
  });

  it('should authenticate socket connections', (done) => {
    user1Socket.on('connected', (data) => {
      expect(data.userId).toBe(user1._id.toString());
      expect(data.message).toBe('Connected to chat server');
      
      user2Socket.on('connected', (data2) => {
        expect(data2.userId).toBe(user2._id.toString());
        done();
      });
    });
  });

  it('should join user room on connection', (done) => {
    user1Socket.on('connected', () => {
      expect(user1Socket.rooms.has(`user:${user1._id}`)).toBe(true);
      expect(user2Socket.rooms.has(`user:${user2._id}`)).toBe(true);
      done();
    });
  });

  it('should join conversation room', (done) => {
    const conversationId = conversation.conversationId;
    
    user1Socket.emit('join_conversation', { conversationId });
    
    user1Socket.on('connected', () => {
      setTimeout(() => {
        expect(user1Socket.rooms.has(`conv:${conversationId}`)).toBe(true);
        done();
      }, 100);
    });
  });

  it('should send and receive messages with acknowledgment', (done) => {
    const conversationId = conversation.conversationId;
    const messageContent = 'Hello from socket test!';
    
    user1Socket.emit('join_conversation', { conversationId });
    user2Socket.emit('join_conversation', { conversationId });

    let messageReceived = false;
    let ackReceived = false;

    user2Socket.on('receive_message', (message) => {
      expect(message.content).toBe(messageContent);
      expect(message.senderId).toBe(user1._id.toString());
      expect(message.receiverId).toBe(user2._id.toString());
      messageReceived = true;
    });

    user1Socket.on('connected', () => {
      user1Socket.emit('send_message', {
        conversationId,
        to: user2._id.toString(),
        content: messageContent
      }, (ack) => {
        expect(ack.success).toBe(true);
        expect(ack.message.id).toBeDefined();
        expect(ack.message.content).toBe(messageContent);
        expect(ack.timestamp).toBeDefined();
        ackReceived = true;
      });
    });

    setTimeout(() => {
      expect(messageReceived).toBe(true);
      expect(ackReceived).toBe(true);
      done();
    }, 500);
  });

  it('should persist messages in database', async () => {
    const conversationId = conversation.conversationId;
    const messageContent = 'Database persistence test';
    
    user1Socket.emit('join_conversation', { conversationId });
    
    await new Promise((resolve) => {
      user1Socket.on('connected', () => {
        user1Socket.emit('send_message', {
          conversationId,
          to: user2._id.toString(),
          content: messageContent
        }, resolve);
      });
    });

    const savedMessage = await ChatMessage.findOne({ content: messageContent });
    expect(savedMessage).toBeTruthy();
    expect(savedMessage.conversationId).toBe(conversationId);
    expect(savedMessage.senderId.toString()).toBe(user1._id.toString());
    expect(savedMessage.receiverId.toString()).toBe(user2._id.toString());
  });

  it('should create notification for received message', async () => {
    const conversationId = conversation.conversationId;
    const messageContent = 'Notification test message';
    
    user1Socket.emit('join_conversation', { conversationId });
    
    await new Promise((resolve) => {
      user1Socket.on('connected', () => {
        user1Socket.emit('send_message', {
          conversationId,
          to: user2._id.toString(),
          content: messageContent
        }, resolve);
      });
    });

    const notification = await Notification.findOne({
      userId: user2._id,
      type: 'message'
    });
    
    expect(notification).toBeTruthy();
    expect(notification.title).toBe('New Message Received');
    expect(notification.metadata.conversationId).toBe(conversationId);
  });

  it('should handle message seen status', (done) => {
    const conversationId = conversation.conversationId;
    const messageContent = 'Message to be seen';
    
    let messageId;
    
    user1Socket.emit('join_conversation', { conversationId });
    user2Socket.emit('join_conversation', { conversationId });

    user2Socket.on('receive_message', (message) => {
      messageId = message.id;
    });

    user1Socket.on('connected', () => {
      user1Socket.emit('send_message', {
        conversationId,
        to: user2._id.toString(),
        content: messageContent
      }, () => {
        setTimeout(() => {
          user2Socket.emit('message_seen', { 
            messageId, 
            conversationId 
          });

          user1Socket.on('message_seen', (seenData) => {
            expect(seenData.messageId).toBe(messageId);
            expect(seenData.userId).toBe(user2._id.toString());
            done();
          });
        }, 200);
      });
    });
  });

  it('should reject unauthorized socket connections', (done) => {
    const invalidSocket = io(`http://localhost:${process.env.PORT}`, {
      auth: { token: 'invalid-token' }
    });

    invalidSocket.on('connect_error', (error) => {
      expect(error.message).toBe('Authentication token required');
      invalidSocket.disconnect();
      done();
    });
  });
});