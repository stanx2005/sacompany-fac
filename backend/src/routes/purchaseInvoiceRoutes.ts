import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
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
router.post('/', createManualPurchaseInvoice);
router.post(
  '/upload',
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
router.patch('/:id/archive', archivePurchaseInvoice);
router.delete('/:id', deletePurchaseInvoice);

export default router;
