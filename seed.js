const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Vehicle = require('./models/Vehicle');
const Insurance = require('./models/Insurance');
const Service = require('./models/Service');
const Notification = require('./models/Notification');
const connectDB = require('./config/database');

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();
    console.log('🗄️ Connected to MongoDB');

    await Promise.all([
      User.deleteMany({}),
      Vehicle.deleteMany({}),
      Insurance.deleteMany({}),
      Service.deleteMany({}),
      Notification.deleteMany({})
    ]);

    console.log('🧹 Cleared existing data');

    const adminPassword = await bcrypt.hash('admin123', 12);
    const staffPassword = await bcrypt.hash('staff123', 12);
    const customerPassword = await bcrypt.hash('customer123', 12);

    const users = [
      {
        name: 'Admin User',
        email: 'admin@vehicleins.com',
        mobile: '9876543210',
        role: 'admin',
        password: adminPassword,
        accountStatus: 'active',
        isVerified: true
      },
      {
        name: 'Staff Member 1',
        email: 'staff1@vehicleins.com',
        mobile: '9876543211',
        role: 'staff',
        password: staffPassword,
        accountStatus: 'active',
        isVerified: true
      },
      {
        name: 'Staff Member 2',
        email: 'staff2@vehicleins.com',
        mobile: '9876543212',
        role: 'staff',
        password: staffPassword,
        accountStatus: 'active',
        isVerified: true
      },
      {
        name: 'Customer One',
        email: 'customer1@vehicleins.com',
        mobile: '9876543213',
        role: 'customer',
        password: customerPassword,
        accountStatus: 'active',
        isVerified: true
      },
      {
        name: 'Customer Two',
        email: 'customer2@vehicleins.com',
        mobile: '9876543214',
        role: 'customer',
        password: customerPassword,
        accountStatus: 'active',
        isVerified: true
      },
      {
        name: 'Customer Three',
        email: 'customer3@vehicleins.com',
        mobile: '9876543215',
        role: 'customer',
        password: customerPassword,
        accountStatus: 'active',
        isVerified: true
      },
      {
        name: 'Customer Four',
        email: 'customer4@vehicleins.com',
        mobile: '9876543216',
        role: 'customer',
        password: customerPassword,
        accountStatus: 'active',
        isVerified: true
      },
      {
        name: 'Customer Five',
        email: 'customer5@vehicleins.com',
        mobile: '9876543217',
        role: 'customer',
        password: customerPassword,
        accountStatus: 'active',
        isVerified: true
      }
    ];

    const createdUsers = await User.insertMany(users);
    console.log(`👥 Created ${createdUsers.length} users`);

    const adminId = createdUsers[0]._id;
    const staffIds = createdUsers.slice(1, 3).map(u => u._id);
    const customerIds = createdUsers.slice(3).map(u => u._id);

    const now = new Date();

    const vehicles = [
      {
        ownerId: customerIds[0],
        registrationNumber: 'MH04AB1234',
        chassisNumber: 'MAH12345678901234',
        model: 'Maruti Swift',
        insurancePolicy: 'POLICY001',
        startDate: new Date('2024-09-01'),
        expiryDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
        insuranceSetBy: staffIds[0],
        insuranceSetAt: new Date('2024-09-01'),
        createdBy: customerIds[0]
      },
      {
        ownerId: customerIds[1],
        registrationNumber: 'MH04AB1235',
        chassisNumber: 'MAH12345678901235',
        model: 'Honda City',
        insurancePolicy: 'POLICY002',
        startDate: new Date('2024-08-15'),
        expiryDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        insuranceSetBy: staffIds[1],
        insuranceSetAt: new Date('2024-08-15'),
        createdBy: customerIds[1]
      },
      {
        ownerId: customerIds[2],
        registrationNumber: 'MH04AB1236',
        chassisNumber: 'MAH12345678901236',
        model: 'Toyota Innova',
        insurancePolicy: 'POLICY003',
        startDate: new Date('2024-07-01'),
        expiryDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        insuranceSetBy: staffIds[0],
        insuranceSetAt: new Date('2024-07-01'),
        createdBy: customerIds[2]
      },
      {
        ownerId: customerIds[3],
        registrationNumber: 'MH04AB1237',
        chassisNumber: 'MAH12345678901237',
        model: 'Hyundai Creta',
        insurancePolicy: 'POLICY004',
        createdBy: customerIds[3]
        // No insurance dates set - staff will set them
      },
      {
        ownerId: customerIds[4],
        registrationNumber: 'MH04AB1238',
        chassisNumber: 'MAH12345678901238',
        model: 'Tata Nexon',
        insurancePolicy: 'POLICY005',
        createdBy: customerIds[4]
        // No insurance dates set - staff will set them
      }
    ];

    const createdVehicles = await Vehicle.insertMany(vehicles);
    console.log(`🚗 Created ${createdVehicles.length} vehicles`);

    const services = [
      {
        serviceName: 'Annual Insurance Renewal',
        requiredDocs: [
          { name: 'Insurance Application Form', sampleUrl: 'https://example.com/form.pdf' },
          { name: 'Vehicle Registration Certificate', sampleUrl: null },
          { name: 'Previous Insurance Policy', sampleUrl: null },
          { name: 'Emission Certificate', sampleUrl: null }
        ],
        createdBy: adminId,
        isActive: true
      },
      {
        serviceName: 'Vehicle Service & Maintenance',
        requiredDocs: [
          { name: 'Service Request Form', sampleUrl: 'https://example.com/service-form.pdf' },
          { name: 'Previous Service Records', sampleUrl: null },
          { name: 'Vehicle Identification Details', sampleUrl: null }
        ],
        createdBy: adminId,
        isActive: true
      },
      {
        serviceName: 'Claim Processing',
        requiredDocs: [
          { name: 'Claim Form', sampleUrl: 'https://example.com/claim-form.pdf' },
          { name: 'Incident Report', sampleUrl: null },
          { name: 'Police FIR (if applicable)', sampleUrl: null },
          { name: 'Repair Estimates', sampleUrl: null },
          { name: 'Photographs of Damage', sampleUrl: null }
        ],
        createdBy: adminId,
        isActive: true
      }
    ];

    const createdServices = await Service.insertMany(services);
    console.log(`🔧 Created ${createdServices.length} services`);

    console.log('🎉 Seed data created successfully!');
    console.log('\n📋 Sample Login Credentials:');
    console.log('Admin: admin@vehicleins.com / admin123');
    console.log('Staff: staff1@vehicleins.com / staff123');
    console.log('Customer: customer1@vehicleins.com / customer123');
    console.log('\n📝 Note: Vehicles for Customer Four and Five have no insurance dates set.');
    console.log('   Staff can set these dates from the customer vehicles page.');

  } catch (error) {
    console.error('❌ Seed error:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
};

seedData();