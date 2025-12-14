// routes/vehicle.js
const express = require('express');
const {
  createVehicle,
  getMyVehicles,
  getAllVehicles,
  getCustomerVehicles,
  setInsuranceDates,
  updateVehicle,
  deleteVehicle,
  getRenewalQueue,
  initiateInsurancePayment,
  verifyInsurancePayment,
} = require('../controllers/vehicleController');
const { auth, roleAuth } = require('../middleware/auth');
const router = express.Router();

router.use(auth);

router.post('/', roleAuth('customer', 'staff'), createVehicle);
router.get('/my-vehicles', roleAuth('customer'), getMyVehicles);
router.get('/list', roleAuth('staff', 'admin'), getAllVehicles);
router.get('/customer/:customerId', roleAuth('staff', 'admin'), getCustomerVehicles);
router.put('/:vehicleId/insurance-dates', roleAuth('staff', 'admin'), setInsuranceDates);
router.put('/:id', roleAuth('customer', 'staff'), updateVehicle);
router.delete('/:id', roleAuth('customer', 'staff'), deleteVehicle);
router.get('/renewal-queue', roleAuth('staff', 'admin'), getRenewalQueue);

router.post('/:vehicleId/payment/initiate', roleAuth('customer'), initiateInsurancePayment);
router.post('/:vehicleId/payment/verify', roleAuth('customer'), verifyInsurancePayment);

module.exports = router;