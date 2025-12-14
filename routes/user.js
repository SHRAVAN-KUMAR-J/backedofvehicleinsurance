const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, getAllUsers, updateUserStatus } = require('../controllers/userController');
const { auth, roleAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Multer setup like course image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/temp/'),
  filename: (req, file, cb) => cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Images only (JPEG/PNG)'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// All routes require auth
router.use(auth);

// Profile routes
router.get('/profile', getProfile);
router.put('/profile', upload.single('profileImage'), updateProfile);

// Admin/staff routes
router.get('/all-users', roleAuth('admin', 'staff'), getAllUsers);
router.put('/update-status', roleAuth('admin'), updateUserStatus);

module.exports = router;
