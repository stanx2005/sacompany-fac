import { Router } from 'express';
import { getPurchaseOrders, createPurchaseOrder, getPurchaseOrderItems } from '../controllers/purchaseOrderController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);
router.get('/', getPurchaseOrders);
router.get('/:id/items', getPurchaseOrderItems);
router.post('/', createPurchaseOrder);

export default router;
