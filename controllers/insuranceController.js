// controllers/insuranceController.js
const Insurance = require('../models/Insurance');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const { createNotification, sendNotificationEmail } = require('../utils/helpers');

// Helper function to clean up uploaded file on error
const cleanupFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error(`Failed to delete file ${filePath}:`, err.message);
    }
  }
};

// Upload Payment PDF using registration number
const uploadPaymentPDF = async (req, res) => {
  let uploadedFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'PDF file is required',
      });
    }

    uploadedFilePath = req.file.path;
    const { registrationNumber } = req.body;
    
    if (!registrationNumber) {
      cleanupFile(uploadedFilePath);
      return res.status(400).json({
        success: false,
        message: 'Registration number is required',
      });
    }

    // Find vehicle and populate owner to get customer name
    const vehicle = await Vehicle.findOne({ registrationNumber: registrationNumber.toUpperCase() })
      .populate('ownerId', 'name email');
    
    if (!vehicle) {
      cleanupFile(uploadedFilePath);
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found with this registration number',
      });
    }

    // Find existing insurance or create a new one
    let insurance = await Insurance.findOne({ registrationNumber: vehicle.registrationNumber });
    if (!insurance) {
      insurance = new Insurance({
        registrationNumber: vehicle.registrationNumber,
        paymentStatus: 'none',
        customerName: vehicle.ownerId.name // Store customer name directly
      });
    } else {
      insurance.customerName = vehicle.ownerId.name; // Update customer name if exists
    }

    // Generate the public URL for the file
    const filename = req.file.filename;
    const pdfUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}/uploads/payments/${filename}`;

    // Store the filename and URL
    insurance.pdfFilename = filename;
    insurance.pdfUrl = pdfUrl;
    insurance.paymentStatus = 'pending';
    insurance.paymentMarkedBy = req.user.id;

    await insurance.save();

    res.status(200).json({
      success: true,
      message: 'Payment PDF uploaded successfully',
      data: insurance,
    });
  } catch (error) {
    console.error('Upload payment PDF error:', error.message);
    if (uploadedFilePath) {
      cleanupFile(uploadedFilePath);
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload payment PDF',
    });
  }
};

// Approve payment
const approvePayment = async (req, res) => {
  try {
    const { insuranceId } = req.params;
    const { rejectionReason } = req.body || {};

    const insurance = await Insurance.findById(insuranceId).populate('paymentMarkedBy');
    if (!insurance) {
      return res.status(404).json({
        success: false,
        message: 'Insurance record not found',
      });
    }

    if (insurance.paymentStatus === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Payment already approved',
      });
    }

    if (rejectionReason) {
      if (!rejectionReason.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required',
        });
      }
      insurance.paymentStatus = 'rejected';
      insurance.rejectedBy = req.user.id;
      insurance.rejectedAt = new Date();
      insurance.rejectionReason = rejectionReason;
    } else {
      insurance.paymentStatus = 'approved';
      insurance.approvedBy = req.user.id;
      insurance.approvedAt = new Date();
      insurance.rejectionReason = null;
    }

    await insurance.save();
    await insurance.populate(['paymentMarkedBy', 'approvedBy', 'rejectedBy']);

    // Find vehicle and owner for notification
    const vehicle = await Vehicle.findOne({ registrationNumber: insurance.registrationNumber }).populate('ownerId');
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Associated vehicle not found',
      });
    }

    const notification = await createNotification({
      userId: vehicle.ownerId._id,
      title: `Insurance Payment ${rejectionReason ? 'Rejected' : 'Approved'}`,
      message: rejectionReason
        ? `Your insurance payment for vehicle ${vehicle.registrationNumber} was rejected: ${rejectionReason}`
        : `Your insurance payment for vehicle ${vehicle.registrationNumber} has been approved. Download the PDF from your portal.`,
      type: 'approval',
      metadata: {
        registrationNumber: vehicle.registrationNumber,
        insuranceId: insurance._id,
      },
    });

    try {
      await sendNotificationEmail({
        user: vehicle.ownerId,
        notification,
        vehicle,
        insurance,
      });
      notification.emailSent = true;
      await notification.save();
    } catch (emailError) {
      console.error('Error sending notification email:', emailError.message);
    }

    res.status(200).json({
      success: true,
      message: `Payment ${rejectionReason ? 'rejected' : 'approved'} successfully`,
      data: insurance,
    });
  } catch (error) {
    console.error('Approve payment error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process payment approval',
    });
  }
};

// Get pending payments
const getPendingPayments = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can access pending payments',
      });
    }

    const pendingPayments = await Insurance.find({ paymentStatus: 'pending' })
      .populate('paymentMarkedBy', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: pendingPayments.length,
      data: pendingPayments,
    });
  } catch (error) {
    console.error('Get pending payments error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch pending payments',
    });
  }
};

// Get staff's uploaded insurances
const getMyUploadedInsurances = async (req, res) => {
  try {
    if (req.user.role !== 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Only staff can access their uploaded payments',
      });
    }

    const insurances = await Insurance.find({ paymentMarkedBy: req.user.id })
      .populate('paymentMarkedBy', 'name')
      .populate('approvedBy', 'name')
      .populate('rejectedBy', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: insurances.length,
      data: insurances,
    });
  } catch (error) {
    console.error('Get my uploaded insurances error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch uploaded insurances',
    });
  }
};

// Get user's insurances
const getMyInsurances = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ ownerId: req.user.id }).select('registrationNumber');
    const registrationNumbers = vehicles.map((v) => v.registrationNumber);
    
    const insurances = await Insurance.find({
      registrationNumber: { $in: registrationNumbers },
    });

    res.status(200).json({
      success: false,
      count: insurances.length,
      data: insurances,
    });
  } catch (error) {
    console.error('Get my insurances error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch insurances',
    });
  }
};

module.exports = {
  uploadPaymentPDF,
  approvePayment,
  getPendingPayments,
  getMyUploadedInsurances,
  getMyInsurances,
};