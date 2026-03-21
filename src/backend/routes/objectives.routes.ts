import { Router } from 'express';
import { objectivesController } from '../controllers/objectives.controller';

const router = Router();

router.get('/objectives', objectivesController.getAll);
router.get('/objectives/:id', objectivesController.getById);
router.post('/objectives', objectivesController.create);
router.patch('/objectives/:id', objectivesController.update);
router.delete('/objectives/:id', objectivesController.delete);

export { router as objectivesRouter };
