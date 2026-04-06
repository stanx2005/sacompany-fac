import { Router } from 'express';
import { getStats } from '../controllers/statsController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRoles } from '../middleware/requireRoles.js';

const router = Router();

router.use(authenticateToken);
router.use(requireRoles(['admin', 'staff']));
router.get('/', getStats);

export default router;
