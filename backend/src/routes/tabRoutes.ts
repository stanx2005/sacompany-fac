import { Router } from 'express';
import { getOpenTabs, addToTab, closeTabsForClient, deleteTabItem, updateTabItem } from '../controllers/tabController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRoles } from '../middleware/requireRoles.js';

const router = Router();

router.use(authenticateToken);
router.get('/', getOpenTabs);
router.post('/', requireRoles(['admin', 'staff']), addToTab);
router.patch('/:id', requireRoles(['admin', 'staff']), updateTabItem);
router.delete('/:id', requireRoles(['admin', 'staff']), deleteTabItem);
router.put('/close/:clientId', requireRoles(['admin', 'staff']), closeTabsForClient);

export default router;
