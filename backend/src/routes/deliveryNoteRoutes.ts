import { Router } from 'express';
import {
  getDeliveryNotes,
  createDeliveryNote,
  getDeliveryNoteItems,
  convertBLToInvoice,
  markAsDelivered,
  setDeliveryNoteArchived,
  setDeliveryNoteCompleted,
  deleteDeliveryNote,
} from '../controllers/deliveryNoteController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();
router.use(authenticateToken);
router.get('/', getDeliveryNotes);
router.get('/:id/items', getDeliveryNoteItems);
router.post('/', createDeliveryNote);
router.post('/:id/deliver', markAsDelivered);
router.post('/:id/convert-invoice', convertBLToInvoice);
router.patch('/:id/archive', requireAdmin, setDeliveryNoteArchived);
router.patch('/:id/complete', setDeliveryNoteCompleted);
router.delete('/:id', requireAdmin, deleteDeliveryNote);

export default router;
