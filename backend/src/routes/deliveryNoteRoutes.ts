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
  updateDeliveryNote,
} from '../controllers/deliveryNoteController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireRoles } from '../middleware/requireRoles.js';

const router = Router();
router.use(authenticateToken);
router.get('/', getDeliveryNotes);
router.get('/:id/items', getDeliveryNoteItems);
router.post('/', requireRoles(['admin', 'staff']), createDeliveryNote);
router.put('/:id', requireRoles(['admin', 'staff']), updateDeliveryNote);
router.post('/:id/deliver', requireRoles(['admin', 'staff']), markAsDelivered);
router.post('/:id/convert-invoice', requireRoles(['admin', 'staff']), convertBLToInvoice);
router.patch('/:id/archive', requireAdmin, setDeliveryNoteArchived);
router.patch('/:id/complete', requireRoles(['admin', 'staff']), setDeliveryNoteCompleted);
router.delete('/:id', requireAdmin, deleteDeliveryNote);

export default router;
