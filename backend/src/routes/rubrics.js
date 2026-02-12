import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getRubricByAssignment, createRubric } from '../controllers/rubricController.js';

const router = Router();

router.get('/assignment/:assignmentId', requireAuth, getRubricByAssignment);
router.post('/', requireAuth, requireRole('admin','teacher'), createRubric);

export default router;
