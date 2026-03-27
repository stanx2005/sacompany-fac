import { Router } from 'express';
import { getCheques, createCheque, updateChequeStatus } from '../controllers/chequeController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.get('/', getCheques);
router.post('/', createCheque);
router.put('/:id/status', updateChequeStatus);

export default router;
