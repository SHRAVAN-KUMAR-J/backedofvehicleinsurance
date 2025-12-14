const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Insurance = require('../models/Insurance');
const Service = require('../models/Service');

const getDashboardStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can access dashboard stats',
      });
    }

    const [
      totalUsers,
      totalCustomers,
      totalStaff,
      totalVehicles,
      totalInsurances,
      pendingPayments,
      activeServices,
      upcomingRenewals,
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }).catch(() => {
        throw new Error('Failed to count total users');
      }),
      User.countDocuments({ role: 'customer', accountStatus: 'active' }).catch(() => {
        throw new Error('Failed to count active customers');
      }),
      User.countDocuments({ role: 'staff', accountStatus: 'active' }).catch(() => {
        throw new Error('Failed to count active staff');
      }),
      Vehicle.countDocuments().catch(() => {
        throw new Error('Failed to count vehicles');
      }),
      Insurance.countDocuments().catch(() => {
        throw new Error('Failed to count insurances');
      }),
      Insurance.countDocuments({ paymentStatus: 'pending' }).catch(() => {
        throw new Error('Failed to count pending payments');
      }),
      Service.countDocuments({ isActive: true }).catch(() => {
        throw new Error('Failed to count active services');
      }),
      Vehicle.countDocuments({
        expiryDate: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }).catch(() => {
        throw new Error('Failed to count upcoming renewals');
      }),
    ]);

    const now = new Date();
    const renewalsByDays = await Vehicle.aggregate([
      {
        $match: {
          expiryDate: {
            $gte: now,
            $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $addFields: {
          daysUntilExpiry: {
            $divide: [{ $subtract: ['$expiryDate', now] }, 1000 * 60 * 60 * 24],
          },
        },
      },
      {
        $bucket: {
          groupBy: '$daysUntilExpiry',
          boundaries: [0, 1, 7, 30, 1000], // Replaced Infinity with 1000
          default: '30+',
          output: {
            count: { $sum: 1 },
          },
        },
      },
    ]).catch(() => {
      throw new Error('Failed to aggregate renewals by days');
    });

    const renewalsData = {
      '1 Day': 0,
      '7 Days': 0,
      '30 Days': 0,
      '30+ Days': 0,
    };

    renewalsByDays.forEach((item) => {
      if (item._id === 0) renewalsData['1 Day'] = item.count;
      else if (item._id < 7) renewalsData['7 Days'] = item.count;
      else if (item._id < 30) renewalsData['30 Days'] = item.count;
      else renewalsData['30+ Days'] = item.count;
    });

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalCustomers,
        totalStaff,
        totalVehicles,
        totalInsurances,
        pendingPayments,
        activeServices,
        upcomingRenewals,
        renewalsByDays: renewalsData,
      },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch dashboard stats',
    });
  }
};

const getSystemAnalytics = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can access system analytics',
      });
    }

    const dateRange = req.query.dateRange || '30days';
    let days;
    switch (dateRange) {
      case '7days':
        days = 7;
        break;
      case '30days':
        days = 30;
        break;
      case '90days':
        days = 90;
        break;
      default:
        days = 30;
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const [
      userRegistrations,
      vehicleAdditions,
      insuranceCreations,
      serviceCompletions,
      paymentApprovals,
      paymentStatusBreakdown,
    ] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]).catch(() => {
        throw new Error('Failed to aggregate user registrations');
      }),
      Vehicle.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]).catch(() => {
        throw new Error('Failed to aggregate vehicle additions');
      }),
      Insurance.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]).catch(() => {
        throw new Error('Failed to aggregate insurance creations');
      }),
      Service.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]).catch(() => {
        throw new Error('Failed to aggregate service completions');
      }),
      Insurance.aggregate([
        {
          $match: {
            approvedAt: { $gte: startDate, $lte: endDate },
            paymentStatus: 'approved',
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$approvedAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]).catch(() => {
        throw new Error('Failed to aggregate payment approvals');
      }),
      Insurance.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: '$paymentStatus',
            count: { $sum: 1 },
          },
        },
      ]).catch(() => {
        throw new Error('Failed to aggregate payment status breakdown');
      }),
    ]);

    const approvalRejectionRates = {
      approved: paymentStatusBreakdown.find((s) => s._id === 'approved')?.count || 0,
      rejected: paymentStatusBreakdown.find((s) => s._id === 'rejected')?.count || 0,
      pending: paymentStatusBreakdown.find((s) => s._id === 'pending')?.count || 0,
      none: paymentStatusBreakdown.find((s) => s._id === 'none')?.count || 0,
    };

    res.status(200).json({
      success: true,
      dateRange,
      data: {
        userRegistrations,
        vehicleAdditions,
        insuranceCreations,
        serviceCompletions,
        paymentApprovals,
        approvalRejectionRates,
      },
    });
  } catch (error) {
    console.error('Get system analytics error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch system analytics',
    });
  }
};

const getUserActivity = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can access user activity',
      });
    }

    const { role, period = '30days' } = req.query;

    if (role && !['customer', 'staff'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be "customer" or "staff"',
      });
    }

    let days;
    switch (period) {
      case '7days':
        days = 7;
        break;
      case '30days':
        days = 30;
        break;
      case '90days':
        days = 90;
        break;
      default:
        days = 30;
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const activity = await User.aggregate([
      {
        $match: {
          role: role ? role : { $in: ['customer', 'staff'] },
          accountStatus: 'active',
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          firstActivity: { $min: '$createdAt' },
          lastActivity: { $max: '$updatedAt' },
        },
      },
      {
        $lookup: {
          from: 'vehicles',
          let: { role: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $gte: ['$createdAt', startDate] },
                    { $lte: ['$createdAt', endDate] },
                    { $in: ['$ownerId.role', ['$role']] },
                  ],
                },
              },
            },
            { $count: 'vehicleCount' },
          ],
          as: 'vehicleActivity',
        },
      },
      {
        $unwind: { path: '$vehicleActivity', preserveNullAndEmptyArrays: true },
      },
    ]).catch(() => {
      throw new Error('Failed to aggregate user activity');
    });

    res.status(200).json({
      success: true,
      period,
      data: activity,
    });
  } catch (error) {
    console.error('Get user activity error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch user activity',
    });
  }
};

module.exports = {
  getDashboardStats,
  getSystemAnalytics,
  getUserActivity,
};