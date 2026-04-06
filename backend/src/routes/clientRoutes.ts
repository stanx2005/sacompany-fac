import { Router } from 'express';
import {
  getClients,
  createClient,
  updateClient,
  deleteClient,
  bulkCreateClients,
  setClientArchived,
  setClientCompleted,
} from '../controllers/clientController.js';
import { getMessagingStatusHandler, sendClientReminder } from '../controllers/clientReminderController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireRoles } from '../middleware/requireRoles.js';

const router = Router();

router.use(authenticateToken);
router.get('/messaging/status', getMessagingStatusHandler);
router.get('/', getClients);
router.post('/', requireRoles(['admin', 'staff']), createClient);
router.post('/bulk', requireRoles(['admin', 'staff']), bulkCreateClients);
router.put('/:id', requireRoles(['admin', 'staff']), updateClient);
router.post('/:id/send-reminder', requireRoles(['admin', 'staff']), sendClientReminder);
router.patch('/:id/complete', requireRoles(['admin', 'staff']), setClientCompleted);
router.patch('/:id/archive', requireAdmin, setClientArchived);
router.delete('/:id', requireAdmin, deleteClient);

export default router;
