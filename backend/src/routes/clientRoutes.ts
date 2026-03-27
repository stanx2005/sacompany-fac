import { Router } from 'express';
import { getClients, createClient, updateClient, deleteClient, bulkCreateClients } from '../controllers/clientController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.get('/', getClients);
router.post('/', createClient);
router.post('/bulk', bulkCreateClients);
router.put('/:id', updateClient);
router.delete('/:id', deleteClient);

export default router;
