const Insurance = require('../models/Insurance');

const getPendingPaymentsAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can access pending payments',
      });
    }

    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const payments = await Insurance.find({ paymentStatus: 'pending' })
      .populate([
        {
          path: 'vehicleId',
          populate: {
            path: 'ownerId',
            select: 'name email mobile accountStatus',
            match: { accountStatus: 'active' }, // Ensure only active owners
          },
        },
        { path: 'paymentMarkedBy', select: 'name role' },
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Filter out payments where ownerId is null due to population match
    const filteredPayments = payments.filter((p) => p.vehicleId?.ownerId);

    const total = await Insurance.countDocuments({ paymentStatus: 'pending' });

    res.status(200).json({
      success: true,
      count: filteredPayments.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: filteredPayments,
    });
  } catch (error) {
    console.error('Get pending payments admin error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch pending payments',
    });
  }
};

const getPaymentAnalytics = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can access payment analytics',
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

    const [statusBreakdown, temporalBreakdown] = await Promise.all([
      Insurance.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: '$paymentStatus',
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            status: '$_id',
            count: 1,
          },
        },
      ]).catch(() => {
        throw new Error('Failed to aggregate payment status breakdown');
      }),
      Insurance.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              status: '$paymentStatus',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.date': 1 } },
      ]).catch(() => {
        throw new Error('Failed to aggregate temporal payment breakdown');
      }),
    ]);

    const statusMap = {
      none: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    statusBreakdown.forEach((stat) => {
      statusMap[stat.status] = stat.count;
    });

    res.status(200).json({
      success: true,
      dateRange,
      data: {
        statusBreakdown: statusMap,
        temporalBreakdown,
      },
    });
  } catch (error) {
    console.error('Get payment analytics error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch payment analytics',
    });
  }
};

module.exports = {
  getPendingPaymentsAdmin,
  getPaymentAnalytics,
};