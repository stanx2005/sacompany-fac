import { Router } from 'express';
import { getPurchaseOrders, createPurchaseOrder, getPurchaseOrderItems, convertBCToBL } from '../controllers/purchaseOrderController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);
router.get('/', getPurchaseOrders);
router.get('/:id/items', getPurchaseOrderItems);
router.post('/', createPurchaseOrder);
router.post('/:id/convert-bl', convertBCToBL);

export default router;
