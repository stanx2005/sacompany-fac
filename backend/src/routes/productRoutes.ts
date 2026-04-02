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

const router = Router();

router.use(authenticateToken);
router.get('/', getProducts);
router.post('/', createProduct);
router.post('/bulk-preview', bulkPreviewProducts);
router.post('/bulk', bulkCreateProducts);
router.put('/:id', updateProduct);
router.delete('/:id', requireAdmin, deleteProduct);

export default router;
