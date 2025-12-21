// controllers/vehicleController.js
const Vehicle = require('../models/Vehicle');
const Insurance = require('../models/Insurance');
const User = require('../models/User');
const Joi = require('joi');
const Razorpay = require('razorpay');
const crypto = require('crypto');

let createNotification, sendNotificationEmail;
try {
  const helpers = require('../utils/helpers');
  createNotification = helpers.createNotification;
  sendNotificationEmail = helpers.sendNotificationEmail;
} catch (error) {
  console.log('Helpers not available, notifications will be skipped');
  createNotification = async () => ({ _id: 'mock' });
  sendNotificationEmail = async () => {};
}

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createVehicle = async (req, res) => {
  try {
    const { registrationNumber, chassisNumber, model, insurancePolicy, vehicleImage, feature1, feature2, feature3, customerId, insuranceAmount } = req.body;

    let ownerId;

    if (req.user.role === 'staff' && customerId) {
      ownerId = customerId;
      
      if (!chassisNumber) {
        return res.status(400).json({
          success: false,
          message: 'Chassis number is required when creating vehicle for customer'
        });
      }

      const staffSchema = Joi.object({
        registrationNumber: Joi.string().required().trim().min(1),
        chassisNumber: Joi.string().required().trim().min(1),
        model: Joi.string().required().trim().max(100),
        insurancePolicy: Joi.string().optional().trim().max(100),
        insuranceAmount: Joi.number().optional().min(0),
        vehicleImage: Joi.string().optional().uri().allow(''),
        feature1: Joi.string().optional().trim().max(100),
        feature2: Joi.string().optional().trim().max(100),
        feature3: Joi.string().optional().trim().max(100)
      });

      const { error } = staffSchema.validate({
        registrationNumber,
        chassisNumber,
        model,
        insurancePolicy: insurancePolicy || '',
        insuranceAmount: insuranceAmount ? parseFloat(insuranceAmount) : undefined,
        vehicleImage: vehicleImage || '',
        feature1: feature1 || '',
        feature2: feature2 || '',
        feature3: feature3 || ''
      });

      if (error) {
        return res.status(400).json({
          success: false,
          message: error.details[0].message
        });
      }
    } else {
      // Customer creating their own vehicle
      ownerId = req.user.id;

      const customerSchema = Joi.object({
        registrationNumber: Joi.string().required().trim().min(1),
        model: Joi.string().required().trim().max(100),
        vehicleImage: Joi.string().optional().uri().allow('')
      });

      const { error } = customerSchema.validate({
        registrationNumber,
        model,
        vehicleImage: vehicleImage || ''
      });

      if (error) {
        return res.status(400).json({
          success: false,
          message: error.details[0].message
        });
      }
    }

    // Check for duplicate registration number
    const regExists = await Vehicle.findOne({
      ownerId,
      registrationNumber: registrationNumber.toUpperCase()
    });

    if (regExists) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle with this registration number already exists for this owner'
      });
    }

    // Check for duplicate chassis number (only if chassis is provided)
    if (chassisNumber) {
      const chassisExists = await Vehicle.findOne({
        chassisNumber: chassisNumber.toUpperCase()
      });

      if (chassisExists) {
        return res.status(400).json({
          success: false,
          message: 'Vehicle with this chassis number already exists'
        });
      }
    }

    const vehicle = new Vehicle({
      ownerId,
      registrationNumber: registrationNumber.toUpperCase(),
      chassisNumber: chassisNumber ? chassisNumber.toUpperCase() : null,
      model,
      insurancePolicy: req.user.role === 'staff' ? (insurancePolicy || '') : '',
      insuranceAmount: req.user.role === 'staff' && insuranceAmount ? parseFloat(insuranceAmount) : null,
      vehicleImage: vehicleImage || '',
      feature1: req.user.role === 'staff' ? (feature1 || '') : '',
      feature2: req.user.role === 'staff' ? (feature2 || '') : '',
      feature3: req.user.role === 'staff' ? (feature3 || '') : '',
      createdBy: req.user.id,
      paymentStatus: 'pending'
    });

    await vehicle.save();
    await vehicle.populate('ownerId', 'name email mobile');
    await vehicle.populate('createdBy', 'name role');

    // Send notification if insurance amount is set during creation
    if (req.user.role === 'staff' && insuranceAmount && parseFloat(insuranceAmount) > 0) {
      try {
        const notification = await createNotification({
          userId: vehicle.ownerId._id,
          title: 'Insurance Amount Set',
          message: `Insurance amount of ₹${parseFloat(insuranceAmount).toLocaleString()} has been set for your vehicle ${vehicle.registrationNumber}. Please proceed with payment.`,
          type: 'update',
          metadata: {
            vehicleId: vehicle._id,
            amount: parseFloat(insuranceAmount),
            registrationNumber: vehicle.registrationNumber
          }
        });

        await sendNotificationEmail({
          user: vehicle.ownerId,
          notification,
          vehicle
        });
      } catch (notifError) {
        console.error('Notification error (non-critical):', notifError.message);
      }
    }

    res.status(201).json({
      success: true,
      message: req.user.role === 'customer' 
        ? 'Vehicle created successfully. Chassis number, insurance policy, and insurance dates will be set by staff.' 
        : 'Vehicle created successfully. Insurance dates will be set by staff.',
      data: vehicle
    });
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create vehicle'
    });
  }
};

const getMyVehicles = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;

    const query = { ownerId: req.user.id };

    if (search) {
      query.$or = [
        { registrationNumber: { $regex: search.toUpperCase(), $options: 'i' } },
        { chassisNumber: { $regex: search.toUpperCase(), $options: 'i' } },
        { model: { $regex: search, $options: 'i' } }
      ];
    }

    const vehicles = await Vehicle.find(query)
      .populate('ownerId', 'name email')
      .populate('insuranceSetBy', 'name')
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const vehiclesWithInsurance = await Promise.all(vehicles.map(async (v) => {
      let insurance = null;
      try {
        insurance = await Insurance.findOne({ vehicleId: v._id })
          .populate('approvedBy', 'name')
          .populate('rejectedBy', 'name')
          .populate('paymentMarkedBy', 'name');
      } catch (err) {
        console.log('Insurance fetch error:', err.message);
      }

      const vehicleObj = v.toObject();
      vehicleObj.insurance = insurance;
      return vehicleObj;
    }));

    const total = await Vehicle.countDocuments(query);

    res.status(200).json({
      success: true,
      count: vehiclesWithInsurance.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: vehiclesWithInsurance
    });
  } catch (error) {
    console.error('Get my vehicles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicles'
    });
  }
};

const getAllVehicles = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, chassisNo, regNo, customerId } = req.query;
    const skip = (page - 1) * limit;

    const query = {};

    if (search) {
      query.$or = [
        { registrationNumber: { $regex: search.toUpperCase(), $options: 'i' } },
        { chassisNumber: { $regex: search.toUpperCase(), $options: 'i' } },
        { model: { $regex: search, $options: 'i' } }
      ];
    }

    if (chassisNo) {
      query.chassisNumber = { $regex: chassisNo.toUpperCase(), $options: 'i' };
    }

    if (regNo) {
      query.registrationNumber = { $regex: regNo.toUpperCase(), $options: 'i' };
    }

    if (customerId) {
      query.ownerId = customerId;
    }

    const vehicles = await Vehicle.find(query)
      .populate('ownerId', 'name email mobile')
      .populate('insuranceSetBy', 'name')
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Vehicle.countDocuments(query);

    res.status(200).json({
      success: true,
      count: vehicles.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: vehicles
    });
  } catch (error) {
    console.error('Get all vehicles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicles'
    });
  }
};

const getCustomerVehicles = async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID is required'
      });
    }

    let vehicles = await Vehicle.find({ ownerId: customerId })
      .populate('ownerId', 'name email mobile')
      .populate('insuranceSetBy', 'name')
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 });

    const vehiclesWithInsurance = await Promise.all(vehicles.map(async (v) => {
      let insurance = null;
      try {
        insurance = await Insurance.findOne({ vehicleId: v._id })
          .populate('approvedBy', 'name')
          .populate('rejectedBy', 'name')
          .populate('paymentMarkedBy', 'name');
      } catch (err) {
        console.log('Insurance fetch error:', err.message);
      }

      const vehicleObj = v.toObject();
      vehicleObj.insurance = insurance;
      return vehicleObj;
    }));

    res.status(200).json({
      success: true,
      count: vehiclesWithInsurance.length,
      data: vehiclesWithInsurance
    });
  } catch (error) {
    console.error('Get customer vehicles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer vehicles'
    });
  }
};

const setInsuranceDates = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { startDate, expiryDate, insuranceAmount } = req.body;

    if (!startDate || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: 'Both start date and expiry date are required'
      });
    }

    const start = new Date(startDate);
    const expiry = new Date(expiryDate);

    if (expiry <= start) {
      return res.status(400).json({
        success: false,
        message: 'Expiry date must be after start date'
      });
    }

    if (expiry <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Expiry date must be in the future'
      });
    }

    if (insuranceAmount !== undefined && (isNaN(insuranceAmount) || parseFloat(insuranceAmount) < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Insurance amount must be a valid non-negative number'
      });
    }

    const vehicle = await Vehicle.findById(vehicleId).populate('ownerId', 'name email mobile');

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    const oldExpiryDate = vehicle.expiryDate;
    const oldInsuranceAmount = vehicle.insuranceAmount;
    const isAmountUpdated = insuranceAmount !== undefined && parseFloat(insuranceAmount) !== oldInsuranceAmount;

    vehicle.startDate = start;
    vehicle.expiryDate = expiry;
    if (insuranceAmount !== undefined) {
      vehicle.insuranceAmount = parseFloat(insuranceAmount);
    }
    vehicle.insuranceSetBy = req.user.id;
    vehicle.insuranceSetAt = new Date();

    await vehicle.save();
    await vehicle.populate('insuranceSetBy', 'name');
    await vehicle.populate('createdBy', 'name role');

    // Send notification for insurance dates update
    const notificationMessage = oldExpiryDate
      ? `Insurance dates updated for your vehicle ${vehicle.registrationNumber}. New expiry: ${expiry.toDateString()}`
      : `Insurance dates set for your vehicle ${vehicle.registrationNumber}. Coverage starts: ${start.toDateString()}, Expires: ${expiry.toDateString()}`;

    try {
      const notification = await createNotification({
        userId: vehicle.ownerId._id,
        title: oldExpiryDate ? 'Insurance Dates Updated' : 'Insurance Dates Set',
        message: notificationMessage,
        type: 'update',
        metadata: {
          vehicleId: vehicle._id,
          startDate: start,
          expiryDate: expiry
        }
      });

      await sendNotificationEmail({
        user: vehicle.ownerId,
        notification,
        vehicle
      });
    } catch (notifError) {
      console.error('Notification error (non-critical):', notifError.message);
    }

    // Send separate notification if insurance amount was set or updated
    if (isAmountUpdated && parseFloat(insuranceAmount) > 0) {
      try {
        const amountNotification = await createNotification({
          userId: vehicle.ownerId._id,
          title: oldInsuranceAmount ? 'Insurance Amount Updated' : 'Insurance Amount Set',
          message: `Insurance amount of ₹${parseFloat(insuranceAmount).toLocaleString()} has been ${oldInsuranceAmount ? 'updated' : 'set'} for your vehicle ${vehicle.registrationNumber} (${vehicle.model}). Start Date: ${start.toDateString()}, Expiry Date: ${expiry.toDateString()}. Please proceed with payment.`,
          type: 'update',
          metadata: {
            vehicleId: vehicle._id,
            amount: parseFloat(insuranceAmount),
            registrationNumber: vehicle.registrationNumber,
            model: vehicle.model,
            startDate: start,
            expiryDate: expiry
          }
        });

        await sendNotificationEmail({
          user: vehicle.ownerId,
          notification,
          vehicle
        });
      } catch (notifError) {
        console.error('Amount notification error (non-critical):', notifError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Insurance dates set successfully',
      data: vehicle
    });
  } catch (error) {
    console.error('Set insurance dates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set insurance dates'
    });
  }
};

const updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const { registrationNumber, chassisNumber, model, insurancePolicy, vehicleImage, feature1, feature2, feature3, insuranceAmount } = req.body;

    let query = { _id: id };
    if (req.user.role !== 'staff') {
      query.$or = [
        { ownerId: req.user.id },
        { createdBy: req.user.id }
      ];
    }

    const vehicle = await Vehicle.findOne(query).populate('ownerId', 'name email mobile');

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found or not authorized'
      });
    }

    if (req.user.role === 'customer') {
      const restrictedFields = ['chassisNumber', 'insurancePolicy', 'feature1', 'feature2', 'feature3', 'insuranceAmount'];
      const restrictedUpdate = restrictedFields.some(field => req.body[field] !== undefined);

      if (restrictedUpdate) {
        return res.status(400).json({
          success: false,
          message: 'Chassis number, insurance policy, amount, and features can only be updated by staff'
        });
      }
    }

    // Check for chassis number uniqueness when updating (only if provided)
    if (chassisNumber && req.user.role === 'staff') {
      const chassisExists = await Vehicle.findOne({
        _id: { $ne: id },
        chassisNumber: chassisNumber.toUpperCase()
      });

      if (chassisExists) {
        return res.status(400).json({
          success: false,
          message: 'Vehicle with this chassis number already exists'
        });
      }
    }

    const oldInsuranceAmount = vehicle.insuranceAmount;
    const isAmountUpdated = req.user.role === 'staff' && insuranceAmount !== undefined && parseFloat(insuranceAmount) !== oldInsuranceAmount;

    const updateData = {};
    if (registrationNumber !== undefined) updateData.registrationNumber = registrationNumber.toUpperCase();
    if (chassisNumber !== undefined && req.user.role === 'staff') updateData.chassisNumber = chassisNumber.toUpperCase();
    if (model !== undefined) updateData.model = model;
    if (insurancePolicy !== undefined && req.user.role === 'staff') updateData.insurancePolicy = insurancePolicy;
    if (insuranceAmount !== undefined && req.user.role === 'staff') updateData.insuranceAmount = parseFloat(insuranceAmount);
    if (vehicleImage !== undefined) updateData.vehicleImage = vehicleImage;
    if (feature1 !== undefined && req.user.role === 'staff') updateData.feature1 = feature1;
    if (feature2 !== undefined && req.user.role === 'staff') updateData.feature2 = feature2;
    if (feature3 !== undefined && req.user.role === 'staff') updateData.feature3 = feature3;

    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('ownerId', 'name email mobile')
     .populate('insuranceSetBy', 'name')
     .populate('createdBy', 'name role');

    // Send notification if insurance amount was updated by staff
    if (isAmountUpdated && parseFloat(insuranceAmount) > 0) {
      try {
        const notification = await createNotification({
          userId: updatedVehicle.ownerId._id,
          title: oldInsuranceAmount ? 'Insurance Amount Updated' : 'Insurance Amount Set',
          message: `Insurance amount of ₹${parseFloat(insuranceAmount).toLocaleString()} has been ${oldInsuranceAmount ? 'updated' : 'set'} for your vehicle ${updatedVehicle.registrationNumber} (${updatedVehicle.model}). Please proceed with payment.`,
          type: 'update',
          metadata: {
            vehicleId: updatedVehicle._id,
            amount: parseFloat(insuranceAmount),
            registrationNumber: updatedVehicle.registrationNumber,
            model: updatedVehicle.model
          }
        });

        await sendNotificationEmail({
          user: updatedVehicle.ownerId,
          notification,
          vehicle: updatedVehicle
        });
      } catch (notifError) {
        console.error('Notification error (non-critical):', notifError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Vehicle updated successfully',
      data: updatedVehicle
    });
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update vehicle'
    });
  }
};

const deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;

    let query = { _id: id };
    if (req.user.role !== 'staff') {
      query.$or = [
        { ownerId: req.user.id },
        { createdBy: req.user.id }
      ];
    }

    const vehicle = await Vehicle.findOne(query);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found or not authorized'
      });
    }

    await Vehicle.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Vehicle deleted successfully'
    });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete vehicle'
    });
  }
};

const getRenewalQueue = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const vehicles = await Vehicle.find({
      expiryDate: {
        $gte: now,
        $lte: thirtyDays,
        $ne: null
      }
    })
      .populate('ownerId', 'name email mobile accountStatus')
      .populate('insuranceSetBy', 'name')
      .populate('createdBy', 'name role')
      .sort({ expiryDate: 1 })
      .limit(50);

    const filteredVehicles = vehicles
      .filter(v => v.ownerId && v.ownerId.accountStatus === 'active')
      .map(v => {
        const daysUntilExpiry = Math.ceil((v.expiryDate - now) / (1000 * 60 * 60 * 24));
        let daysCategory;
        if (daysUntilExpiry <= 1) daysCategory = '1 Day';
        else if (daysUntilExpiry <= 7) daysCategory = '7 Days';
        else daysCategory = '30 Days';

        return {
          ...v.toObject(),
          daysUntilExpiry,
          daysCategory
        };
      });

    res.status(200).json({
      success: true,
      count: filteredVehicles.length,
      data: filteredVehicles
    });
  } catch (error) {
    console.error('Get renewal queue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch renewal queue'
    });
  }
};

const initiateInsurancePayment = async (req, res) => {
  try {
    const { vehicleId } = req.params;

    console.log('=== PAYMENT INITIATION STARTED ===');
    console.log('User ID:', req.user.id);
    console.log('Vehicle ID:', vehicleId);

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('RAZORPAY CREDENTIALS MISSING!');
      return res.status(500).json({
        success: false,
        message: 'Payment gateway not configured. Please contact administrator.'
      });
    }

    const vehicle = await Vehicle.findById(vehicleId).populate('ownerId', 'name email mobile');
   
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    if (vehicle.ownerId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to pay for this vehicle'
      });
    }

    if (!vehicle.insuranceAmount || vehicle.insuranceAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Insurance amount not set for this vehicle'
      });
    }

    if (vehicle.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Insurance payment already completed for this vehicle'
      });
    }

    const amountInPaise = Math.round(vehicle.insuranceAmount * 100);
    const timestamp = Date.now();
    const shortReceipt = `INS_${timestamp.toString().slice(-8)}`;

    console.log('Creating Razorpay order with receipt:', shortReceipt);
   
    let razorpayOrder;
    try {
      razorpayOrder = await razorpayInstance.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: shortReceipt,
        notes: {
          vehicleId: vehicleId.toString().slice(-12),
          regNo: vehicle.registrationNumber,
          userId: req.user.id.toString().slice(-12)
        },
      });
      console.log('Razorpay order created:', razorpayOrder.id);
    } catch (rzpError) {
      console.error('=== RAZORPAY API ERROR ===');
      console.error('Error:', rzpError);
     
      const errorMessage = rzpError?.error?.description
        || rzpError?.message
        || 'Razorpay API error';
     
      return res.status(500).json({
        success: false,
        message: errorMessage
      });
    }

    if (!razorpayOrder || !razorpayOrder.id) {
      return res.status(500).json({
        success: false,
        message: 'Invalid response from payment gateway'
      });
    }

    vehicle.razorpayOrderId = razorpayOrder.id;
    await vehicle.save();

    console.log('=== PAYMENT INITIATION SUCCESS ===');

    res.status(200).json({
      success: true,
      message: 'Payment order created successfully',
      data: {
        key: process.env.RAZORPAY_KEY_ID,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        vehicleId: vehicle._id,
        registrationNumber: vehicle.registrationNumber,
        insuranceAmount: vehicle.insuranceAmount
      }
    });
  } catch (error) {
    console.error('=== PAYMENT INITIATION ERROR ===');
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to initiate payment'
    });
  }
};

const verifyInsurancePayment = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
   
    console.log('=== PAYMENT VERIFICATION STARTED ===');

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification parameters'
      });
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      console.error('SIGNATURE MISMATCH');
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    const vehicle = await Vehicle.findById(vehicleId).populate('ownerId', 'name email mobile');
   
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    if (vehicle.ownerId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    vehicle.paymentStatus = 'paid';
    vehicle.razorpayPaymentId = razorpayPaymentId;
    vehicle.razorpaySignature = razorpaySignature;
    vehicle.paidAt = new Date();
    await vehicle.save();

    await vehicle.populate('insuranceSetBy', 'name');
    await vehicle.populate('createdBy', 'name role');

    // Send notification to customer
    try {
      const customerNotification = await createNotification({
        userId: vehicle.ownerId._id,
        title: 'Insurance Payment Successful',
        message: `Payment of ₹${vehicle.insuranceAmount.toLocaleString()} for vehicle ${vehicle.registrationNumber} (${vehicle.model}) completed successfully. Payment ID: ${razorpayPaymentId}`,
        type: 'success',
        metadata: {
          vehicleId: vehicle._id,
          amount: vehicle.insuranceAmount,
          paymentId: razorpayPaymentId,
          registrationNumber: vehicle.registrationNumber,
          model: vehicle.model
        }
      });

      await sendNotificationEmail({
        user: vehicle.ownerId,
        notification: customerNotification,
        vehicle
      });
    } catch (notifError) {
      console.error('Customer notification error (non-critical):', notifError.message);
    }

    // Send notification to all staff members
    try {
      const staffUsers = await User.find({ role: 'staff', accountStatus: 'active' });
      for (const staffUser of staffUsers) {
        try {
          const staffNotification = await createNotification({
            userId: staffUser._id,
            title: 'Customer Payment Received',
            message: `Customer ${vehicle.ownerId.name} has successfully paid ₹${vehicle.insuranceAmount.toLocaleString()} for vehicle ${vehicle.registrationNumber} (${vehicle.model}). Payment ID: ${razorpayPaymentId}`,
            type: 'success',
            metadata: {
              vehicleId: vehicle._id,
              amount: vehicle.insuranceAmount,
              paymentId: razorpayPaymentId,
              customerId: vehicle.ownerId._id,
              customerName: vehicle.ownerId.name,
              registrationNumber: vehicle.registrationNumber,
              model: vehicle.model
            }
          });

          await sendNotificationEmail({
            user: staffUser,
            notification: staffNotification,
            vehicle
          });
        } catch (staffNotifError) {
          console.error(`Staff notification error for ${staffUser.email}:`, staffNotifError.message);
        }
      }
    } catch (staffError) {
      console.error('Staff notifications error (non-critical):', staffError.message);
    }

    console.log('=== PAYMENT VERIFICATION SUCCESS ===');
   
    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: vehicle
    });
  } catch (error) {
    console.error('=== PAYMENT VERIFICATION ERROR ===');
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify payment'
    });
  }
};

module.exports = {
  createVehicle,
  getMyVehicles,
  getAllVehicles,
  getCustomerVehicles,
  setInsuranceDates,
  updateVehicle,
  deleteVehicle,
  getRenewalQueue,
  initiateInsurancePayment,
  verifyInsurancePayment
};
