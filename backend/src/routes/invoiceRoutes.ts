import { Router } from 'express';
import {
  getInvoices,
  createInvoice,
  getInvoiceItems,
  getInvoicePaymentTimeline,
  setInvoiceArchived,
  setInvoiceCompleted,
  deleteInvoice,
  convertInvoiceToBL,
  convertInvoiceToBC,
} from '../controllers/invoiceController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

router.use(authenticateToken);
router.get('/', getInvoices);
router.get('/:id/payment-timeline', getInvoicePaymentTimeline);
router.patch('/:id/archive', requireAdmin, setInvoiceArchived);
router.patch('/:id/complete', setInvoiceCompleted);
router.delete('/:id', requireAdmin, deleteInvoice);
router.get('/:id/items', getInvoiceItems);
router.post('/', createInvoice);
router.post('/:id/convert-bl', convertInvoiceToBL);
router.post('/:id/convert-bc', convertInvoiceToBC);

export default router;
