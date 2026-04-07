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
  updateInvoice,
} from '../controllers/invoiceController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireRoles } from '../middleware/requireRoles.js';

const router = Router();

router.use(authenticateToken);
router.get('/', getInvoices);
router.get('/:id/payment-timeline', getInvoicePaymentTimeline);
router.patch('/:id/archive', requireAdmin, setInvoiceArchived);
router.patch('/:id/complete', requireRoles(['admin', 'staff']), setInvoiceCompleted);
router.delete('/:id', requireAdmin, deleteInvoice);
router.get('/:id/items', getInvoiceItems);
router.post('/', requireRoles(['admin', 'staff']), createInvoice);
router.put('/:id', requireRoles(['admin', 'staff']), updateInvoice);
router.post('/:id/convert-bl', requireRoles(['admin', 'staff']), convertInvoiceToBL);
router.post('/:id/convert-bc', requireRoles(['admin', 'staff']), convertInvoiceToBC);

export default router;
