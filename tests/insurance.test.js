const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Insurance = require('../models/Insurance');
const Notification = require('../models/Notification');
const bcrypt = require('bcryptjs');

describe('Insurance Controller', () => {
  let adminToken, customerToken, staffToken;
  let adminUser, customerUser, staffUser, vehicle;

  beforeAll(async () => {
    await User.deleteMany({});
    await Vehicle.deleteMany({});
    await Insurance.deleteMany({});
    await Notification.deleteMany({});

    adminUser = new User({
      name: 'Admin Test',
      email: 'admin@test.com',
      mobile: '9876543210',
      role: 'admin',
      password: await bcrypt.hash('admin123', 12),
      accountStatus: 'active',
      isVerified: true
    });
    await adminUser.save();

    customerUser = new User({
      name: 'Customer Test',
      email: 'customer@test.com',
      mobile: '9876543211',
      role: 'customer',
      password: await bcrypt.hash('customer123', 12),
      accountStatus: 'active',
      isVerified: true
    });
    await customerUser.save();

    staffUser = new User({
      name: 'Staff Test',
      email: 'staff@test.com',
      mobile: '9876543212',
      role: 'staff',
      password: await bcrypt.hash('staff123', 12),
      accountStatus: 'active',
      isVerified: true
    });
    await staffUser.save();

    vehicle = new Vehicle({
      ownerId: customerUser._id,
      registrationNumber: 'MH04AB9999',
      chassisNumber: 'MAH99999999999999',
      model: 'Test Vehicle',
      insurancePolicy: 'TEST001',
      expiryDate: new Date('2025-12-31'),
      createdBy: staffUser._id
    });
    await vehicle.save();
  });

  describe('Create Insurance', () => {
    it('should create insurance for customer vehicle', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: customerUser.email, role: customerUser.role });

      const otpRes = await request(app)
        .post('/api/auth/verify-login-otp')
        .send({ email: customerUser.email, otp: '123456' });

      customerToken = otpRes.body.token;

      const res = await request(app)
        .post('/api/insurance')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ vehicleId: vehicle._id.toString() })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.vehicleId).toBe(vehicle._id.toString());
      expect(res.body.data.paymentStatus).toBe('none');
    });
  });

  describe('Upload Payment PDF', () => {
    it('should allow staff to upload payment PDF', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: staffUser.email, role: staffUser.role });

      const otpRes = await request(app)
        .post('/api/auth/verify-login-otp')
        .send({ email: staffUser.email, otp: '123456' });

      staffToken = otpRes.body.token;

      const insurance = await Insurance.findOne({ vehicleId: vehicle._id });

      const res = await request(app)
        .post('/api/insurance/upload-pdf')
        .set('Authorization', `Bearer ${staffToken}`)
        .field('vehicleId', vehicle._id.toString())
        .attach('pdf', 'tests/sample.pdf')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentStatus).toBe('pending');
      expect(res.body.data.pdfUrl).toBeDefined();
      expect(res.body.data.paymentMarkedBy).toBe(staffUser._id.toString());
    });
  });

  describe('Approve Payment', () => {
    it('should allow admin to approve payment', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: adminUser.email, role: adminUser.role });

      const otpRes = await request(app)
        .post('/api/auth/verify-login-otp')
        .send({ email: adminUser.email, otp: '123456' });

      adminToken = otpRes.body.token;

      const insurance = await Insurance.findOne({ vehicleId: vehicle._id });

      const res = await request(app)
        .put(`/api/insurance/approve/${insurance._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentStatus).toBe('approved');
      expect(res.body.data.approvedBy).toBe(adminUser._id.toString());

      const notification = await Notification.findOne({
        userId: customerUser._id,
        type: 'approval'
      });

      expect(notification).toBeTruthy();
      expect(notification.title).toBe('Insurance Payment Approved');
    });

    it('should prevent customer from approving payment', async () => {
      const res = await request(app)
        .put(`/api/insurance/approve/${insurance._id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({})
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Role customer is not authorized to access this route');
    });
  });

  describe('PDF Download Restrictions', () => {
    it('should prevent PDF download before approval', async () => {
      const newInsurance = new Insurance({
        vehicleId: vehicle._id,
        paymentStatus: 'pending'
      });
      await newInsurance.save();

      const res = await request(app)
        .get(`/api/insurance/download/${newInsurance._id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('PDF is not available for download');
    });

    it('should allow PDF download after approval', async () => {
      const approvedInsurance = new Insurance({
        vehicleId: vehicle._id,
        paymentStatus: 'approved',
        pdfUrl: 'https://example.com/approved.pdf'
      });
      await approvedInsurance.save();

      const res = await request(app)
        .get(`/api/insurance/download/${approvedInsurance._id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(302);

      expect(res.headers.location).toBe('https://example.com/approved.pdf');
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Vehicle.deleteMany({});
    await Insurance.deleteMany({});
    await Notification.deleteMany({});
  });
});