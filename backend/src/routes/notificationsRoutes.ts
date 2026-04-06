import { Router } from 'express';
import { getNotifications } from '../controllers/notificationsController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRoles } from '../middleware/requireRoles.js';

const router = Router();

router.use(authenticateToken);
router.use(requireRoles(['admin', 'staff']));
router.get('/', getNotifications);

export default router;
