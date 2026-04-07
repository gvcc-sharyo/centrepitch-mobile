import SportTemplate from '../models/SportTemplate.js';

/**
 * @desc    Get all sport templates
 * @route   GET /api/sport-templates
 * @access  Public
 */
export const getAllTemplates = async (req, res) => {
  try {
    const { category, isActive = true } = req.query;

    let query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    if (category) {
      query.category = category;
    }

    const templates = await SportTemplate.find(query)
      .populate('sport', 'name slug isActive')
      .sort({ sportName: 1 });

    res.status(200).json({
      success: true,
      count: templates.length,
      data: templates
    });
  } catch (error) {
    console.error('Get all templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sport templates',
      error: error.message
    });
  }
};

/**
 * @desc    Get template by sport ID
 * @route   GET /api/sport-templates/sport/:sportId
 * @access  Public
 */
export const getTemplateBySportId = async (req, res) => {
  try {
    const { sportId } = req.params;

    const template = await SportTemplate.findOne({ 
      sport: sportId, 
      isActive: true 
    }).populate('sport', 'name slug');

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'No template found for this sport'
      });
    }

    res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Get template by sport ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sport template',
      error: error.message
    });
  }
};

/**
 * @desc    Get template by sport slug
 * @route   GET /api/sport-templates/slug/:slug
 * @access  Public
 */
export const getTemplateBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const template = await SportTemplate.findOne({ 
      sportSlug: slug, 
      isActive: true 
    }).populate('sport', 'name slug');

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'No template found for this sport'
      });
    }

    res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Get template by slug error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sport template',
      error: error.message
    });
  }
};

/**
 * @desc    Get templates by category
 * @route   GET /api/sport-templates/category/:category
 * @access  Public
 */
export const getTemplatesByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    const templates = await SportTemplate.find({ 
      category, 
      isActive: true 
    })
      .populate('sport', 'name slug')
      .sort({ sportName: 1 });

    res.status(200).json({
      success: true,
      count: templates.length,
      data: templates
    });
  } catch (error) {
    console.error('Get templates by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sport templates',
      error: error.message
    });
  }
};

/**
 * @desc    Get all categories
 * @route   GET /api/sport-templates/categories
 * @access  Public
 */
export const getCategories = async (req, res) => {
  try {
    const categories = await SportTemplate.distinct('category');
    
    const categoryLabels = {
      team_sports: 'Team Sports',
      racket_sports: 'Racket Sports',
      water_sports: 'Water Sports',
      combat_sports: 'Combat & Martial Arts',
      target_sports: 'Target Sports',
      fitness: 'Fitness & Gym',
      indoor_games: 'Indoor Games',
      skating_cycling: 'Skating & Cycling',
      outdoor_adventure: 'Outdoor & Adventure',
      esports: 'eSports & Gaming',
      other: 'Other Sports'
    };

    const categoriesWithLabels = categories.map(cat => ({
      key: cat,
      label: categoryLabels[cat] || cat
    }));

    res.status(200).json({
      success: true,
      data: categoriesWithLabels
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
};

/**
 * @desc    Create sport template (Super Admin only)
 * @route   POST /api/sport-templates
 * @access  Private/SuperAdmin
 */
export const createTemplate = async (req, res) => {
  try {
    const { sportId, sportName, sportSlug, category, fields } = req.body;

    // Check if template already exists for this sport
    const existingTemplate = await SportTemplate.findOne({ sport: sportId });
    if (existingTemplate) {
      return res.status(400).json({
        success: false,
        message: 'Template already exists for this sport'
      });
    }

    const template = await SportTemplate.create({
      sport: sportId,
      sportName,
      sportSlug,
      category,
      fields,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'Sport template created successfully',
      data: template
    });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating sport template',
      error: error.message
    });
  }
};

/**
 * @desc    Update sport template (Super Admin only)
 * @route   PUT /api/sport-templates/:id
 * @access  Private/SuperAdmin
 */
export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, fields, isActive } = req.body;

    const template = await SportTemplate.findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    if (category) template.category = category;
    if (fields) template.fields = fields;
    if (isActive !== undefined) template.isActive = isActive;

    await template.save();

    res.status(200).json({
      success: true,
      message: 'Sport template updated successfully',
      data: template
    });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating sport template',
      error: error.message
    });
  }
};

/**
 * @desc    Delete sport template (Super Admin only)
 * @route   DELETE /api/sport-templates/:id
 * @access  Private/SuperAdmin
 */
export const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await SportTemplate.findByIdAndDelete(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Sport template deleted successfully'
    });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting sport template',
      error: error.message
    });
  }
};
