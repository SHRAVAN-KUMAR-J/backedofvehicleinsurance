const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('./config/database');
const socketHandler = require('./socket/socketHandler');
const cronJobs = require('./utils/cronJobs');
const Vehicle = require('./models/Vehicle');
const User = require('./models/User');

const app = express();

connectDB();

const uploadsDir = path.join(__dirname, 'uploads/payments');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 500 : 1000,
  message: 'Too many requests, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts, please try again later.'
});

app.use(generalLimiter);
app.use('/api/auth', authLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/vehicle', require('./routes/vehicle'));
app.use('/api/insurance', require('./routes/insurance'));
app.use('/api/service', require('./routes/service'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/notification', require('./routes/notification'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    timezone: 'UTC',
    cronStatus: 'Active'
  });
});

app.get('/test-activation-reminder', async (req, res) => {
  try {
    console.log('🧪 Testing 1-day activation reminder manually...');
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    let testUser = await User.findOne({ role: 'customer', accountStatus: 'active' });
    if (!testUser) {
      testUser = await User.create({
        name: 'Test Customer',
        email: 'test@example.com',
        password: 'hashedpassword',
        role: 'customer',
        accountStatus: 'active'
      });
      console.log(`✅ Created test user: ${testUser.email}`);
    }
    
    const testVehicle = await Vehicle.create({
      registrationNumber: 'TESTACT-' + Date.now(),
      startDate: twentyFourHoursAgo,
      expiryDate: new Date(twentyFourHoursAgo.getTime() + 365 * 24 * 60 * 60 * 1000),
      ownerId: testUser._id,
      model: 'Test Model',
    });
    console.log(`✅ Created test vehicle: ${testVehicle.registrationNumber}`);
    console.log(` Start Date: ${testVehicle.startDate}`);
    console.log(` Expiry Date: ${testVehicle.expiryDate}`);
    console.log(` Scheduled At: ${testVehicle.activationReminderScheduledAt}`);
    console.log(` Owner: ${testUser.email}`);
    
    const result = await cronJobs.manualRunActivationReminders();
    res.json({
      success: true,
      message: `Test completed - ${result} activation reminders sent`,
      testVehicle: {
        registration: testVehicle.registrationNumber,
        startDate: testVehicle.startDate,
        expiryDate: testVehicle.expiryDate,
        scheduledAt: testVehicle.activationReminderScheduledAt,
        sent: testVehicle.activationReminderSent,
        owner: testUser.email
      },
      remindersSent: result
    });
  } catch (error) {
    console.error('❌ Test route error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/test-month-reminder', async (req, res) => {
  try {
    console.log('🧪 Testing 1-month reminder manually...');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let testUser = await User.findOne({ role: 'customer', accountStatus: 'active' });
    if (!testUser) {
      testUser = await User.create({
        name: 'Test Customer Month',
        email: 'testmonth@example.com',
        password: 'hashedpassword',
        role: 'customer',
        accountStatus: 'active'
      });
      console.log(`✅ Created test user: ${testUser.email}`);
    }
    
    const testVehicle = await Vehicle.create({
      registrationNumber: 'TESTMTH-' + Date.now(),
      startDate: thirtyDaysAgo,
      expiryDate: new Date(thirtyDaysAgo.getTime() + 365 * 24 * 60 * 60 * 1000),
      ownerId: testUser._id,
      model: 'Test Model Month',
    });
    console.log(`✅ Created test vehicle: ${testVehicle.registrationNumber}`);
    console.log(` Start Date: ${testVehicle.startDate}`);
    console.log(` Expiry Date: ${testVehicle.expiryDate}`);
    console.log(` Scheduled At: ${testVehicle.monthReminderScheduledAt}`);
    
    const result = await cronJobs.manualRunMonthReminders();
    res.json({
      success: true,
      message: `Test completed - ${result} month reminders sent`,
      testVehicle: {
        registration: testVehicle.registrationNumber,
        startDate: testVehicle.startDate,
        expiryDate: testVehicle.expiryDate,
        scheduledAt: testVehicle.monthReminderScheduledAt,
        sent: testVehicle.monthReminderSent,
        owner: testUser.email
      },
      remindersSent: result
    });
  } catch (error) {
    console.error('❌ Test route error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/test-preexpiry-reminder', async (req, res) => {
  try {
    console.log('🧪 Testing pre-expiry reminder manually...');
    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 1);
    
    let testUser = await User.findOne({ role: 'customer', accountStatus: 'active' });
    if (!testUser) {
      testUser = await User.create({
        name: 'Test Customer Expiry',
        email: 'testexpiry@example.com',
        password: 'hashedpassword',
        role: 'customer',
        accountStatus: 'active'
      });
      console.log(`✅ Created test user: ${testUser.email}`);
    }
    
    const testVehicle = await Vehicle.create({
      registrationNumber: 'TESTEXP-' + Date.now(),
      startDate: startDate,
      expiryDate: expiryDate,
      ownerId: testUser._id,
      model: 'Test Model Expiry',
    });
    console.log(`✅ Created test vehicle: ${testVehicle.registrationNumber}`);
    console.log(` Start Date: ${testVehicle.startDate}`);
    console.log(` Expiry Date: ${testVehicle.expiryDate}`);
    console.log(` Scheduled At: ${testVehicle.preExpiryReminderScheduledAt}`);
    
    const result = await cronJobs.manualRunPreExpiryReminders();
    res.json({
      success: true,
      message: `Test completed - ${result} pre-expiry reminders sent`,
      testVehicle: {
        registration: testVehicle.registrationNumber,
        startDate: testVehicle.startDate,
        expiryDate: testVehicle.expiryDate,
        scheduledAt: testVehicle.preExpiryReminderScheduledAt,
        sent: testVehicle.preExpiryReminderSent,
        owner: testUser.email
      },
      remindersSent: result
    });
  } catch (error) {
    console.error('❌ Test route error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/debug-activation-vehicles', async (req, res) => {
  try {
    const now = new Date();
    console.log(`🔍 Debug: Looking for pending activation reminders as of ${now} (UTC)`);
    const vehicles = await Vehicle.find({
      activationReminderScheduledAt: { $lte: now },
      activationReminderSent: false,
      startDate: { $ne: null }
    }).populate('ownerId', 'name email role accountStatus');
    const vehiclesWithDetails = vehicles.map(v => ({
      registration: v.registrationNumber,
      startDate: v.startDate,
      expiryDate: v.expiryDate,
      scheduledAt: v.activationReminderScheduledAt,
      sent: v.activationReminderSent,
      owner: v.ownerId ? {
        name: v.ownerId.name,
        email: v.ownerId.email,
        role: v.ownerId.role,
        status: v.ownerId.accountStatus
      } : 'No owner',
      eligibleForActivationReminder: v.ownerId && v.ownerId.role === 'customer' && v.ownerId.accountStatus === 'active'
    }));
    res.json({
      success: true,
      debugInfo: {
        currentTime: now,
        timezone: 'UTC'
      },
      vehiclesFound: vehicles.length,
      vehicles: vehiclesWithDetails
    });
  } catch (error) {
    console.error('❌ Debug route error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/debug-month-vehicles', async (req, res) => {
  try {
    const now = new Date();
    console.log(`🔍 Debug: Looking for pending month reminders as of ${now} (UTC)`);
    const vehicles = await Vehicle.find({
      monthReminderScheduledAt: { $lte: now },
      monthReminderSent: false,
      startDate: { $ne: null }
    }).populate('ownerId', 'name email role accountStatus');
    const vehiclesWithDetails = vehicles.map(v => ({
      registration: v.registrationNumber,
      startDate: v.startDate,
      expiryDate: v.expiryDate,
      scheduledAt: v.monthReminderScheduledAt,
      sent: v.monthReminderSent,
      owner: v.ownerId ? {
        name: v.ownerId.name,
        email: v.ownerId.email,
        role: v.ownerId.role,
        status: v.ownerId.accountStatus
      } : 'No owner',
      eligibleForMonthReminder: v.ownerId && v.ownerId.role === 'customer' && v.ownerId.accountStatus === 'active'
    }));
    res.json({
      success: true,
      debugInfo: {
        currentTime: now,
        timezone: 'UTC'
      },
      vehiclesFound: vehicles.length,
      vehicles: vehiclesWithDetails
    });
  } catch (error) {
    console.error('❌ Debug route error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/debug-preexpiry-vehicles', async (req, res) => {
  try {
    const now = new Date();
    console.log(`🔍 Debug: Looking for pending pre-expiry reminders as of ${now} (UTC)`);
    const vehicles = await Vehicle.find({
      preExpiryReminderScheduledAt: { $lte: now },
      preExpiryReminderSent: false,
      expiryDate: { $ne: null }
    }).populate('ownerId', 'name email role accountStatus');
    const vehiclesWithDetails = vehicles.map(v => ({
      registration: v.registrationNumber,
      startDate: v.startDate,
      expiryDate: v.expiryDate,
      scheduledAt: v.preExpiryReminderScheduledAt,
      sent: v.preExpiryReminderSent,
      owner: v.ownerId ? {
        name: v.ownerId.name,
        email: v.ownerId.email,
        role: v.ownerId.role,
        status: v.ownerId.accountStatus
      } : 'No owner',
      eligibleForPreExpiryReminder: v.ownerId && v.ownerId.role === 'customer' && v.ownerId.accountStatus === 'active'
    }));
    res.json({
      success: true,
      debugInfo: {
        currentTime: now,
        timezone: 'UTC'
      },
      vehiclesFound: vehicles.length,
      vehicles: vehiclesWithDetails
    });
  } catch (error) {
    console.error('❌ Debug route error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/cron-status', (req, res) => {
  const now = new Date();
  res.json({
    success: true,
    status: 'active',
    timezone: 'UTC',
    currentTime: now,
    cronJobs: {
      activationReminder: '*/5 * * * * (UTC)',
      monthReminder: '*/5 * * * * (UTC)',
      preExpiryReminder: '*/5 * * * * (UTC)'
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/trigger-activation-reminders', async (req, res) => {
  try {
    console.log('🔄 Manually triggering activation reminders...');
    const result = await cronJobs.manualRunActivationReminders();
    res.json({
      success: true,
      message: `Manual activation reminder run completed`,
      remindersSent: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Manual activation trigger error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/trigger-month-reminders', async (req, res) => {
  try {
    console.log('🔄 Manually triggering month reminders...');
    const result = await cronJobs.manualRunMonthReminders();
    res.json({
      success: true,
      message: `Manual month reminder run completed`,
      remindersSent: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Manual month trigger error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/trigger-preexpiry-reminders', async (req, res) => {
  try {
    console.log('🔄 Manually triggering pre-expiry reminders...');
    const result = await cronJobs.manualRunPreExpiryReminders();
    res.json({
      success: true,
      message: `Manual pre-expiry reminder run completed`,
      remindersSent: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Manual pre-expiry trigger error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

socketHandler(io);

cronJobs.initializeActivationCron();
cronJobs.initializeMonthReminder();
cronJobs.initializePreExpiryReminder();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🧪 Test 1-Day Activation Reminder: http://localhost:${PORT}/test-activation-reminder`);
  console.log(`🧪 Test 1-Month Reminder: http://localhost:${PORT}/test-month-reminder`);
  console.log(`🧪 Test Pre-Expiry Reminder: http://localhost:${PORT}/test-preexpiry-reminder`);
  console.log(`🔍 Debug Activation Vehicles: http://localhost:${PORT}/debug-activation-vehicles`);
  console.log(`🔍 Debug Month Vehicles: http://localhost:${PORT}/debug-month-vehicles`);
  console.log(`🔍 Debug Pre-Expiry Vehicles: http://localhost:${PORT}/debug-preexpiry-vehicles`);
  console.log(`⏰ Cron Status: http://localhost:${PORT}/cron-status`);
  console.log(`🔄 Trigger Activation Reminders: http://localhost:${PORT}/trigger-activation-reminders`);
  console.log(`🔄 Trigger Month Reminders: http://localhost:${PORT}/trigger-month-reminders`);
  console.log(`🔄 Trigger Pre-Expiry Reminders: http://localhost:${PORT}/trigger-preexpiry-reminders`);
  console.log(`📧 Email User: ${process.env.EMAIL_USER}`);
  console.log(`⏰ Cron reminders: Using UTC-based 5-minute interval crons (activation, month, pre-expiry)`);
});
