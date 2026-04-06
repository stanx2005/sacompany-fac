import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRoles } from '../middleware/requireRoles.js';
import {
  listPurchaseInvoices,
  getPurchaseInvoiceItems,
  createManualPurchaseInvoice,
  createUploadedPurchaseInvoice,
  getPurchaseInvoiceAttachment,
  archivePurchaseInvoice,
  deletePurchaseInvoice,
  purchaseInvoiceUploadMiddleware,
} from '../controllers/purchaseInvoiceController.js';

const router = Router();
router.use(authenticateToken);

router.get('/', listPurchaseInvoices);
router.post('/', requireRoles(['admin', 'staff']), createManualPurchaseInvoice);
router.post(
  '/upload',
  requireRoles(['admin', 'staff']),
  (req, res, next) => {
    purchaseInvoiceUploadMiddleware.single('file')(req, res, (err: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : 'Erreur upload.';
        return res.status(400).json({ message: msg });
      }
      next();
    });
  },
  createUploadedPurchaseInvoice
);
router.get('/:id/items', getPurchaseInvoiceItems);
router.get('/:id/attachment', getPurchaseInvoiceAttachment);
router.patch('/:id/archive', requireRoles(['admin', 'staff']), archivePurchaseInvoice);
router.delete('/:id', requireRoles(['admin', 'staff']), deletePurchaseInvoice);

export default router;
