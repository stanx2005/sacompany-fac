import { Router } from 'express';
import { login, register, updateProfile } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.put('/profile', authenticateToken, updateProfile);

export default router;
