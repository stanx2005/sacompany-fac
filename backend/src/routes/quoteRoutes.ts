import { Router } from 'express';
import { getQuotes, createQuote, getQuoteItems, convertQuoteToInvoice, updateQuote } from '../controllers/quoteController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRoles } from '../middleware/requireRoles.js';

const router = Router();
router.use(authenticateToken);
router.get('/', getQuotes);
router.get('/:id/items', getQuoteItems);
router.post('/', requireRoles(['admin', 'staff']), createQuote);
router.put('/:id', requireRoles(['admin', 'staff']), updateQuote);
router.post('/:id/convert-invoice', requireRoles(['admin', 'staff']), convertQuoteToInvoice);

export default router;
