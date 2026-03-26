import { Router } from 'express';
import { getDeliveryNotes, createDeliveryNote, getDeliveryNoteItems, convertBLToInvoice, markAsDelivered } from '../controllers/deliveryNoteController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);
router.get('/', getDeliveryNotes);
router.get('/:id/items', getDeliveryNoteItems);
router.post('/', createDeliveryNote);
router.post('/:id/deliver', markAsDelivered);
router.post('/:id/convert-invoice', convertBLToInvoice);

export default router;
