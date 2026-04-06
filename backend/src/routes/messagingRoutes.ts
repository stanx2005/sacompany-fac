import { Router } from 'express';
import { sendDocumentToRecipient } from '../controllers/documentMessagingController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRoles } from '../middleware/requireRoles.js';

const router = Router();

router.use(authenticateToken);
router.post('/send-document', requireRoles(['admin', 'staff']), sendDocumentToRecipient);

export default router;
