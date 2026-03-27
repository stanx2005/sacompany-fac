import { Router } from 'express';
import { getDeliveryNotes, createDeliveryNote, getDeliveryNoteItems, convertBLToInvoice, markAsDelivered } from '../controllers/deliveryNoteController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);
router.get('/', getDeliveryNotes);
router.get('/:id/items', getDeliveryNoteItems);
router.post('/', createDeliveryNote);
router.post('/:id/deliver', markAsDelivered);
router.post('/:id/convert-invoice', convertBLToInvoice);

export default router;
