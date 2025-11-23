import { Router } from 'express';
import {
  saveSnippet,
  getSnippetsByRoom,
  deleteSnippet
} from '../controllers/snippetController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/save', saveSnippet);
router.get('/room/:roomId', getSnippetsByRoom);
router.delete('/:snippetId', authMiddleware, deleteSnippet);

export default router;