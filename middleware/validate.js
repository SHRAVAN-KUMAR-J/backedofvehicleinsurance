const Joi = require('joi');

const validateUser = Joi.object({
  name: Joi.string().max(50).required(),
  email: Joi.string().email().required(),
  mobile: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
  role: Joi.string().valid('customer', 'staff', 'admin').required(),
  password: Joi.string().min(6).required()
});

const validateVehicleCreate = Joi.object({
  registrationNumber: Joi.string().uppercase().required(),
  chassisNumber: Joi.string().uppercase().required(),
  model: Joi.string().max(100).required(),
  insurancePolicy: Joi.string().max(100).allow('')
});

const validateVehicle = Joi.object({
  registrationNumber: Joi.string().uppercase().required(),
  chassisNumber: Joi.string().uppercase().required(),
  model: Joi.string().max(100).required(),
  insurancePolicy: Joi.string().max(100).allow(''),
  expiryDate: Joi.date().greater('now').required()
});

const validateInsurance = Joi.object({
  vehicleId: Joi.string().required(),
  paymentStatus: Joi.string().valid('none', 'pending', 'approved', 'rejected')
});

const validateService = Joi.object({
  serviceName: Joi.string().max(100).required(),
  requiredDocs: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    sampleUrl: Joi.string().uri().allow('')
  })),
  isActive: Joi.boolean()
});

const validateMessage = Joi.object({
  conversationId: Joi.string().required(),
  receiverId: Joi.string().required(),
  content: Joi.string().required(),
  attachments: Joi.array().items(Joi.object({
    url: Joi.string().uri().required(),
    publicId: Joi.string().required(),
    type: Joi.string().valid('image', 'pdf', 'document').required(),
    filename: Joi.string().required()
  })).optional()
});

const validateNotification = Joi.object({
  userId: Joi.string().required(),
  title: Joi.string().required(),
  message: Joi.string().required(),
  type: Joi.string().valid('reminder', 'approval', 'system', 'message', 'update').required(),
  metadata: Joi.object().optional()
});

module.exports = {
  validateUser,
  validateVehicle,
  validateVehicleCreate,
  validateInsurance,
  validateService,
  validateMessage,
  validateNotification
};