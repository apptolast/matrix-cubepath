import { Router } from 'express';
import { ideasController } from '../controllers/ideas.controller';

const router = Router();

router.get('/ideas/top-scored', ideasController.getTopScored);
router.get('/ideas/funnel', ideasController.getFunnel);
router.get('/ideas', ideasController.getAll);
router.get('/ideas/:id', ideasController.getById);
router.post('/ideas', ideasController.create);
router.patch('/ideas/:id', ideasController.update);
router.delete('/ideas/:id', ideasController.delete);
router.post('/ideas/:id/evaluate', ideasController.evaluate);
router.get('/ideas/:id/evaluation', ideasController.getEvaluation);
router.patch('/ideas/:id/decide', ideasController.decide);
router.post('/ideas/:id/promote', ideasController.promote);

export { router as ideasRouter };
