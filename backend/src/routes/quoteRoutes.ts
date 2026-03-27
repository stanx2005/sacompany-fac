import { Router } from 'express';
import { getQuotes, createQuote, getQuoteItems, convertQuoteToInvoice, updateQuote } from '../controllers/quoteController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);
router.get('/', getQuotes);
router.get('/:id/items', getQuoteItems);
router.post('/', createQuote);
router.put('/:id', updateQuote);
router.post('/:id/convert-invoice', convertQuoteToInvoice);

export default router;
