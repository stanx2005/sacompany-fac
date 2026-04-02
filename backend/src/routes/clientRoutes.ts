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

const router = Router();

router.use(authenticateToken);
router.get('/messaging/status', getMessagingStatusHandler);
router.get('/', getClients);
router.post('/', createClient);
router.post('/bulk', bulkCreateClients);
router.put('/:id', updateClient);
router.post('/:id/send-reminder', sendClientReminder);
router.patch('/:id/complete', setClientCompleted);
router.patch('/:id/archive', requireAdmin, setClientArchived);
router.delete('/:id', requireAdmin, deleteClient);

export default router;
