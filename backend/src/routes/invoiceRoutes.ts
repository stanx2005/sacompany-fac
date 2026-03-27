import { Router } from 'express';
import { getInvoices, createInvoice, getInvoiceItems, convertInvoiceToBL, convertInvoiceToBC } from '../controllers/invoiceController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.get('/', getInvoices);
router.get('/:id/items', getInvoiceItems);
router.post('/', createInvoice);
router.post('/:id/convert-bl', convertInvoiceToBL);
router.post('/:id/convert-bc', convertInvoiceToBC);

export default router;
