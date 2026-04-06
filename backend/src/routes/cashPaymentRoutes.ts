import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createCashPayment, getCashPayments } from '../controllers/cashPaymentController.js';
import { requireRoles } from '../middleware/requireRoles.js';

const router = Router();

router.use(authenticateToken);
router.use(requireRoles(['admin', 'staff']));
router.get('/', getCashPayments);
router.post('/', createCashPayment);

export default router;
