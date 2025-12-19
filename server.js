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

// Connect to MongoDB
connectDB();

// Ensure uploads/payments directory exists
const uploadsDir = path.join(__dirname, 'uploads/payments');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL||"http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// ✅ Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 500 : 1000, // relaxed for dev
  message: 'Too many requests, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // strict for login/register
  message: 'Too many login attempts, please try again later.'
});

// ✅ Apply rate limiters
app.use(generalLimiter);
app.use('/api/auth', authLimiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/vehicle', require('./routes/vehicle'));
app.use('/api/insurance', require('./routes/insurance'));
app.use('/api/service', require('./routes/service'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/notification', require('./routes/notification'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/admin', require('./routes/admin'));


// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    timezone: 'Asia/Kolkata',
    cronStatus: 'Active'
  });
});

// 🔧 TEST ROUTES FOR 364-DAY REMINDER
app.get('/test-364-reminder', async (req, res) => {
  try {
    console.log('🧪 Testing 364-day reminder manually...');

    // Create a test vehicle with start date = yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0); // Set to midday yesterday

    // Find or create a test customer user
    const testUser = await User.findOne({ role: 'customer', accountStatus: 'active' });

    if (!testUser) {
      return res.status(404).json({
        success: false,
        error: 'No active customer user found for testing. Please create a customer user first.'
      });
    }

    // Create test vehicle
    const testVehicle = await Vehicle.create({
      registrationNumber: 'TEST364-' + Date.now(),
      startDate: yesterday,
      expiryDate: new Date(yesterday.getTime() + 365 * 24 * 60 * 60 * 1000), // 365 days from start
      ownerId: testUser._id,
      vehicleType: 'car',
      model: 'Test Model',
      brand: 'Test Brand',
      year: 2024
    });

    console.log(`✅ Created test vehicle: ${testVehicle.registrationNumber}`);
    console.log(`   Start Date: ${testVehicle.startDate}`);
    console.log(`   Expiry Date: ${testVehicle.expiryDate}`);
    console.log(`   Owner: ${testUser.email}`);

    // Run manual reminders
    const result = await cronJobs.manualRunReminders();

    res.json({
      success: true,
      message: `Test completed - ${result} reminders sent`,
      testVehicle: {
        registration: testVehicle.registrationNumber,
        startDate: testVehicle.startDate,
        expiryDate: testVehicle.expiryDate,
        owner: testUser.email
      },
      remindersSent: result
    });
  } catch (error) {
    console.error('❌ Test route error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🔧 Test route to check vehicles with start date = yesterday
app.get('/debug-vehicles', async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setDate(startOfDay.getDate() - 1);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`🔍 Debug: Looking for vehicles with start dates between ${startOfDay} and ${endOfDay}`);

    const vehicles = await Vehicle.find({
      startDate: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    }).populate('ownerId', 'name email role accountStatus');

    const vehiclesWithDetails = vehicles.map(v => ({
      registration: v.registrationNumber,
      startDate: v.startDate,
      expiryDate: v.expiryDate,
      owner: v.ownerId ? {
        name: v.ownerId.name,
        email: v.ownerId.email,
        role: v.ownerId.role,
        status: v.ownerId.accountStatus
      } : 'No owner',
      eligibleFor364Reminder: v.ownerId &&
        v.ownerId.role === 'customer' &&
        v.ownerId.accountStatus === 'active'
    }));

    res.json({
      success: true,
      debugInfo: {
        dateRange: {
          start: startOfDay,
          end: endOfDay
        },
        currentTime: now,
        timezone: 'Asia/Kolkata'
      },
      vehiclesFound: vehicles.length,
      vehicles: vehiclesWithDetails
    });
  } catch (error) {
    console.error('❌ Debug route error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🔧 Simple test route to check cron status
app.get('/cron-status', (req, res) => {
  const now = new Date();
  res.json({
    success: true,
    status: 'active',
    timezone: 'Asia/Kolkata',
    currentTime: now,
    cronTime: process.env.CRON_TIME || '0 3 * * *',
    nextRun: 'Based on CRON_TIME in .env',
    environment: process.env.NODE_ENV || 'development'
  });
});

// 🔧 Route to manually trigger all reminders
app.get('/trigger-reminders', async (req, res) => {
  try {
    console.log('🔄 Manually triggering all reminders...');
    const result = await cronJobs.manualRunReminders();

    res.json({
      success: true,
      message: `Manual reminder run completed`,
      remindersSent: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Manual trigger error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Socket.IO setup
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Initialize socket handler
socketHandler(io);

// Start cron jobs
cronJobs.initializeCronJobs();

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🧪 364-Day Reminder Test: http://localhost:${PORT}/test-364-reminder`);
  console.log(`🔍 Debug Vehicles: http://localhost:${PORT}/debug-vehicles`);
  console.log(`⏰ Cron Status: http://localhost:${PORT}/cron-status`);
  console.log(`🔄 Trigger Reminders: http://localhost:${PORT}/trigger-reminders`);
  console.log(`📧 Email User: ${process.env.EMAIL_USER}`);
  console.log(`⏰ Cron Time: ${process.env.CRON_TIME || '0 3 * * *'}`);
});