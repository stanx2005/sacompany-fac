import { Router } from 'express';
import { getProducts, createProduct, updateProduct, deleteProduct, bulkCreateProducts } from '../controllers/productController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getProducts);
router.post('/', createProduct);
router.post('/bulk', bulkCreateProducts);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;
