import { Router } from 'express';
import { getNotifications } from '../controllers/notificationsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.get('/', getNotifications);

export default router;
