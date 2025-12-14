const Notification = require('../models/Notification');

const createNotification = async (notificationData) => {
  try {
    const notification = new Notification({
      userId: notificationData.userId,
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type,
      metadata: notificationData.metadata || {}
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
};

const sendNotificationEmail = async ({ user, notification, vehicle = null, insurance = null }) => {
  try {
    const { sendNotificationEmail } = require('./email');
    await sendNotificationEmail({ user, notification, vehicle, insurance });
    return true;
  } catch (error) {
    console.error('Send notification email error:', error);
    throw error;
  }
};

const generateConversationId = (userId1, userId2) => {
  const sortedIds = [userId1, userId2].sort();
  return `conv_${sortedIds[0]}_${sortedIds[1]}`;
};

const validateFileUpload = (file, maxSize = 10 * 1024 * 1024, allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']) => {
  if (!file) {
    throw new Error('File is required');
  }

  if (file.size > maxSize) {
    throw new Error('File size too large. Maximum size is 10MB');
  }

  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only images and PDFs are allowed');
  }

  return true;
};

const cleanupCloudinaryResource = async (publicId) => {
  try {
    if (publicId) {
      const cloudinary = require('../config/cloudinary');
      await cloudinary.uploader.destroy(publicId);
      console.log(`🗑️ Cleaned up Cloudinary resource: ${publicId}`);
    }
  } catch (error) {
    console.error('Cleanup Cloudinary resource error:', error);
  }
};

module.exports = {
  createNotification,
  sendNotificationEmail,
  generateConversationId,
  validateFileUpload,
  cleanupCloudinaryResource
};