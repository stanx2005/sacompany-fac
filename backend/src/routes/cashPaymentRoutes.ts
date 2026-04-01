import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createCashPayment, getCashPayments } from '../controllers/cashPaymentController.js';

const router = Router();

router.use(authenticateToken);
router.get('/', getCashPayments);
router.post('/', createCashPayment);

export default router;
