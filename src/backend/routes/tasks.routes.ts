import { Router } from 'express';
import { tasksController } from '../controllers/tasks.controller';

const router = Router();

router.get('/tasks', tasksController.getAll);
router.get('/tasks/deadlines', tasksController.getDeadlines);
router.get('/tasks/:id', tasksController.getById);
router.post('/tasks', tasksController.create);
router.patch('/tasks/:id', tasksController.update);
router.delete('/tasks/:id', tasksController.delete);

export { router as tasksRouter };
