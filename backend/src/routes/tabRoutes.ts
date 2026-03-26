import { Router } from 'express';
import { getOpenTabs, addToTab, closeTabsForClient, deleteTabItem } from '../controllers/tabController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getOpenTabs);
router.post('/', addToTab);
router.delete('/:id', deleteTabItem);
router.put('/close/:clientId', closeTabsForClient);

export default router;
