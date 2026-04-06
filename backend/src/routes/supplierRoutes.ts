import { Router } from 'express';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../controllers/supplierController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRoles } from '../middleware/requireRoles.js';

const router = Router();

router.use(authenticateToken);
router.get('/', getSuppliers);
router.post('/', requireRoles(['admin', 'staff']), createSupplier);
router.put('/:id', requireRoles(['admin', 'staff']), updateSupplier);
router.delete('/:id', requireRoles(['admin', 'staff']), deleteSupplier);

export default router;
