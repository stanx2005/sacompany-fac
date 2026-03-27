import { Router } from 'express';
import { getProducts, createProduct, updateProduct, deleteProduct, bulkCreateProducts } from '../controllers/productController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.get('/', getProducts);
router.post('/', createProduct);
router.post('/bulk', bulkCreateProducts);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;
