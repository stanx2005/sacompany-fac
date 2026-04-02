import { Router } from 'express';
import { getCheques, createCheque, updateChequeStatus, setChequeArchived, deleteCheque } from '../controllers/chequeController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.get('/', getCheques);
router.post('/', createCheque);
router.put('/:id/status', updateChequeStatus);
router.patch('/:id/archive', setChequeArchived);
router.delete('/:id', deleteCheque);

export default router;
