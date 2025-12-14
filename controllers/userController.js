const User = require('../models/User');
const { cloudinary } = require('../config/cloudinary');
const fs = require('fs').promises;

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, mobile } = req.body;
    
    if (!name && !mobile && !req.file) {
      return res.status(400).json({ success: false, message: 'At least one field must be provided' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const updateData = {};
    if (name) updateData.name = name;
    if (mobile) updateData.mobile = mobile;

    if (req.file) {
      try {
        // Delete old image if exists
        if (user.profileImage && user.profileImage.publicId) {
          try {
            await cloudinary.uploader.destroy(user.profileImage.publicId);
          } catch (deleteError) {
            console.error('Error deleting old image:', deleteError);
          }
        }

        // Upload new image with explicit timestamp to avoid stale request error
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'profiles',
          resource_type: 'image',
          timestamp: Math.round(Date.now() / 1000), // Current Unix timestamp
        });

        updateData.profileImage = {
          url: result.secure_url,
          publicId: result.public_id,
        };

        // Delete temp file after upload
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting temp file:', unlinkError);
        }
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        
        // Clean up temp file on error
        if (req.file && req.file.path) {
          try {
            await fs.unlink(req.file.path);
          } catch (unlinkError) {
            console.error('Error deleting temp file:', unlinkError);
          }
        }
        
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to upload image. Please check your server time settings.' 
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ 
      success: true, 
      message: 'Profile updated successfully', 
      user: updatedUser 
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    const skip = (page - 1) * limit;
    const query = {};

    if (req.user.role === 'admin') query.role = { $ne: 'admin' };
    else if (req.user.role === 'staff') query.role = 'customer';
    else return res.status(403).json({ success: false, message: 'Access denied' });

    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: users,
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { userId, status } = req.body;

    if (!['active', 'banned'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be active or banned' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ success: false, message: 'Cannot modify admin status' });

    user.accountStatus = status;
    await user.save();

    res.status(200).json({ success: true, message: `User status updated to ${status}`, user });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user status' });
  }
};

module.exports = { getProfile, updateProfile, getAllUsers, updateUserStatus };