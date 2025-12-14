// routes/insurance.js
const express = require('express');
const {
  uploadPaymentPDF,
  approvePayment,
  getPendingPayments,
  getMyUploadedInsurances,
  getMyInsurances,
} = require('../controllers/insuranceController');
const { auth, roleAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/payments/');
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});
const router = express.Router();
router.use(auth);
// ✅ Staff upload payment PDF by registration number
router.post('/upload-pdf', roleAuth('staff'), upload.single('pdf'), uploadPaymentPDF);
// ✅ Admin approve/reject payment
router.put('/approve/:insuranceId', roleAuth('admin'), approvePayment);
// ✅ View all pending payments (admin/staff)
router.get('/pending', roleAuth('staff', 'admin'), getPendingPayments);
// ✅ Staff get their uploaded insurances
router.get('/my-uploads', roleAuth('staff'), getMyUploadedInsurances);
// ✅ Get user's insurances
router.get('/my-insurances', getMyInsurances);
module.exports = router;