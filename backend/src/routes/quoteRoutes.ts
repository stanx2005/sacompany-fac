import { Router } from 'express';
import { getQuotes, createQuote, getQuoteItems, convertQuoteToInvoice, updateQuote, deleteQuote, setQuoteStatus } from '../controllers/quoteController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRoles } from '../middleware/requireRoles.js';

const router = Router();
router.use(authenticateToken);
router.get('/', getQuotes);
router.get('/:id/items', getQuoteItems);
router.post('/', requireRoles(['admin', 'staff']), createQuote);
router.put('/:id', requireRoles(['admin', 'staff']), updateQuote);
router.post('/:id/convert-invoice', requireRoles(['admin', 'staff']), convertQuoteToInvoice);
router.patch('/:id/status', requireRoles(['admin', 'staff']), setQuoteStatus);
router.delete('/:id', requireRoles(['admin', 'staff']), deleteQuote);

export default router;
