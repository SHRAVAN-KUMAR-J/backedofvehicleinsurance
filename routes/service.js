const express = require('express');
const {
  createService,
  getAllServices,
  updateService,
  deleteService
} = require('../controllers/serviceController');
const { auth, roleAuth } = require('../middleware/auth');
const router = express.Router();

// Public GET for customers
router.get('/', getAllServices);

// Protected routes for admin
router.use(auth);
router.post('/', roleAuth('admin'), createService);
router.put('/:id', roleAuth('admin'), updateService);
router.delete('/:id', roleAuth('admin'), deleteService);

module.exports = router;