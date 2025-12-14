const Notification = require('../models/Notification');

const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, seen, type } = req.query;
    const skip = (page - 1) * limit;

    const query = { userId: req.user.id };
    if (type) query.type = type;
    if (seen !== undefined && seen !== null) {
      query.isSeen = seen === 'true' || seen === true;
    }

    const notifications = await Notification.find(query)
      .populate([
        {
          path: 'metadata.insuranceId',
          select: 'paymentStatus',
        },
        {
          path: 'metadata.senderId',
          select: 'name email',
        },
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(query);

    res.status(200).json({
      success: true,
      count: notifications.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: notifications,
    });
  } catch (error) {
    console.error('Get notifications error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch notifications',
    });
  }
};

const markAsSeen = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOne({
      _id: notificationId,
      userId: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or unauthorized',
      });
    }

    if (notification.isSeen) {
      return res.status(200).json({
        success: true,
        message: 'Notification already seen',
        data: notification,
      });
    }

    notification.isSeen = true;
    notification.seenAt = new Date();
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Notification marked as seen',
      data: notification,
    });
  } catch (error) {
    console.error('Mark notification as seen error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark notification as seen',
    });
  }
};

const markAllAsSeen = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.id, isSeen: false },
      { $set: { isSeen: true, seenAt: new Date() } }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as seen`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Mark all notifications as seen error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark all notifications as seen',
    });
  }
};

const getNotificationStats = async (req, res) => {
  try {
    const stats = await Notification.aggregate([
      {
        $match: { userId: req.user.id },
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          unseenCount: {
            $sum: {
              $cond: [{ $eq: ['$isSeen', false] }, 1, 0],
            },
          },
        },
      },
    ]);

    const totalUnseen = await Notification.countDocuments({
      userId: req.user.id,
      isSeen: false,
    });

    res.status(200).json({
      success: true,
      totalUnseen,
      data: stats,
    });
  } catch (error) {
    console.error('Get notification stats error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch notification stats',
    });
  }
};

module.exports = {
  getNotifications,
  markAsSeen,
  markAllAsSeen,
  getNotificationStats,
};