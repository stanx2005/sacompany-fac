import { Router } from 'express';
import { getCheques, createCheque, updateChequeStatus } from '../controllers/chequeController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getCheques);
router.post('/', createCheque);
router.put('/:id/status', updateChequeStatus);

export default router;
