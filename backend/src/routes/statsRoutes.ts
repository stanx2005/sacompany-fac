import { Router } from 'express';
import { getStats } from '../controllers/statsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getStats);

export default router;
