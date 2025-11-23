import { Router } from 'express';
import {
  createRoom,
  getRoom,
  saveRoom,
  deleteRoom
} from '../controllers/roomController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/create', createRoom);
router.get('/:roomId', getRoom);
router.post('/:roomId/save', saveRoom);
router.delete('/:roomId', authMiddleware, deleteRoom);

export default router;