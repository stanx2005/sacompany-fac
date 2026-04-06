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
import { requireRoles } from '../middleware/requireRoles.js';

const router = Router();
router.use(authenticateToken);
router.get('/', getPurchaseOrders);
router.get('/:id/items', getPurchaseOrderItems);
router.post('/', requireRoles(['admin', 'staff']), createPurchaseOrder);
router.post('/:id/convert-bl', requireRoles(['admin', 'staff']), convertBCToBL);
router.post('/:id/convert-purchase-invoice', requireRoles(['admin', 'staff']), convertPOToPurchaseInvoice);
router.patch('/:id/archive', requireRoles(['admin', 'staff']), archivePurchaseOrder);
router.delete('/:id', requireRoles(['admin', 'staff']), deletePurchaseOrder);

export default router;
