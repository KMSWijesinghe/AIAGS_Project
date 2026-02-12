import { Router } from 'express';
import { login, createUser, me } from '../controllers/authController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.get('/me', requireAuth, me);

// Admin creates users
router.post('/users', requireAuth, requireRole('admin'), createUser);

export default router;
