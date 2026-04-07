import express from 'express';
import {
  getAllTemplates,
  getTemplateBySportId,
  getTemplateBySlug,
  getTemplatesByCategory,
  getCategories,
  createTemplate,
  updateTemplate,
  deleteTemplate
} from '../controllers/sportTemplateController.js';
import { protect, isSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getAllTemplates);
router.get('/categories', getCategories);
router.get('/sport/:sportId', getTemplateBySportId);
router.get('/slug/:slug', getTemplateBySlug);
router.get('/category/:category', getTemplatesByCategory);

// Super Admin routes
router.post('/', protect, isSuperAdmin, createTemplate);
router.put('/:id', protect, isSuperAdmin, updateTemplate);
router.delete('/:id', protect, isSuperAdmin, deleteTemplate);

export default router;
