import { Router } from 'express';
import { missionController } from '../controllers/mission.controller';

const router = Router();

router.get('/mission', missionController.getAll);
router.get('/mission/:id', missionController.getById);
router.post('/mission', missionController.create);
router.patch('/mission/:id', missionController.update);
router.delete('/mission/:id', missionController.delete);

export { router as missionRouter };
