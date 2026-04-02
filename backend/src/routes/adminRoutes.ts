import { Router } from 'express';
import { exportDataJson } from '../controllers/adminExportController.js';
import { listUsers, createUser } from '../controllers/adminUsersController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

router.use(authenticateToken);
router.get('/export-json', requireAdmin, exportDataJson);
router.get('/users', requireAdmin, listUsers);
router.post('/users', requireAdmin, createUser);

export default router;
