import { Router } from 'express';
import {
  getPurchaseOrders,
  createPurchaseOrder,
  getPurchaseOrderItems,
  convertBCToBL,
  archivePurchaseOrder,
  deletePurchaseOrder,
  convertPOToPurchaseInvoice,
} from '../controllers/purchaseOrderController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);
router.get('/', getPurchaseOrders);
router.get('/:id/items', getPurchaseOrderItems);
router.post('/', createPurchaseOrder);
router.post('/:id/convert-bl', convertBCToBL);
router.post('/:id/convert-purchase-invoice', convertPOToPurchaseInvoice);
router.patch('/:id/archive', archivePurchaseOrder);
router.delete('/:id', deletePurchaseOrder);

export default router;
