const Service = require('../models/Service');

const createService = async (req, res) => {
  try {
    const { serviceName, requiredDocs, isActive, explanation, image, priceRange } = req.body;

    const existingService = await Service.findOne({ serviceName });

    if (existingService) {
      return res.status(400).json({
        success: false,
        message: 'Service with this name already exists'
      });
    }

    const service = new Service({
      serviceName,
      explanation: explanation || '',
      image: image || '',
      priceRange: priceRange || '',
      requiredDocs: requiredDocs || [],
      createdBy: req.user.id,
      isActive: isActive !== undefined ? isActive : true
    });
    await service.save();
    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: service
    });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create service'
    });
  }
};

const getAllServices = async (req, res) => {
  try {
    const { activeOnly = true } = req.query;

    const query = activeOnly === 'false' ? {} : { isActive: true };

    const services = await Service.find(query)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    console.error('Get all services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services'
    });
  }
};

const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { serviceName, requiredDocs, isActive, explanation, image, priceRange } = req.body;

    const service = await Service.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }
    if (service.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this service'
      });
    }
    const updateData = {};

    if (serviceName !== undefined) updateData.serviceName = serviceName;
    if (explanation !== undefined) updateData.explanation = explanation;
    if (image !== undefined) updateData.image = image;
    if (priceRange !== undefined) updateData.priceRange = priceRange;
    if (requiredDocs !== undefined) updateData.requiredDocs = requiredDocs;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedService = await Service.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name');
    res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      data: updatedService
    });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update service'
    });
  }
};

const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }
    if (service.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this service'
      });
    }
    await Service.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete service'
    });
  }
};

module.exports = {
  createService,
  getAllServices,
  updateService,
  deleteService
};