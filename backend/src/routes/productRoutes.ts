import { Router } from 'express';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkCreateProducts,
  bulkPreviewProducts,
} from '../controllers/productController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireRoles } from '../middleware/requireRoles.js';

const router = Router();

router.use(authenticateToken);
router.get('/', getProducts);
router.post('/', requireRoles(['admin', 'staff']), createProduct);
router.post('/bulk-preview', requireRoles(['admin', 'staff']), bulkPreviewProducts);
router.post('/bulk', requireRoles(['admin', 'staff']), bulkCreateProducts);
router.put('/:id', requireRoles(['admin', 'staff']), updateProduct);
router.delete('/:id', requireAdmin, deleteProduct);

export default router;
