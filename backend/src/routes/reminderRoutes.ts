import { Router } from 'express';
import {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
} from '../controllers/reminderController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.get('/', getReminders);
router.post('/', createReminder);
router.patch('/:id', updateReminder);
router.delete('/:id', deleteReminder);

export default router;
