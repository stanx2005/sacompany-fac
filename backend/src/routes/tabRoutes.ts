import { Router } from 'express';
import { getOpenTabs, addToTab, closeTabsForClient, deleteTabItem } from '../controllers/tabController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.get('/', getOpenTabs);
router.post('/', addToTab);
router.delete('/:id', deleteTabItem);
router.put('/close/:clientId', closeTabsForClient);

export default router;
