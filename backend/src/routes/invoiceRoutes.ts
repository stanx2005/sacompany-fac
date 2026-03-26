import { Router } from 'express';
import { getInvoices, createInvoice, getInvoiceItems, convertInvoiceToBL } from '../controllers/invoiceController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getInvoices);
router.get('/:id/items', getInvoiceItems);
router.post('/', createInvoice);
router.post('/:id/convert-bl', convertInvoiceToBL);

export default router;
