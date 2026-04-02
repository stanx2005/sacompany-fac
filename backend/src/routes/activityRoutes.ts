import { Router } from 'express';
import { getActivityLogs } from '../controllers/activityController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

router.use(authenticateToken);
router.get('/', requireAdmin, getActivityLogs);

export default router;
