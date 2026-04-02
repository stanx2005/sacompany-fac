import { Router } from 'express';
import { sendDocumentToRecipient } from '../controllers/documentMessagingController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.post('/send-document', sendDocumentToRecipient);

export default router;
