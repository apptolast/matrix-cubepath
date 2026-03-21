import { Router } from 'express';
import { plansController } from '../controllers/plans.controller';

const router = Router();

router.get('/plans', plansController.getAll);
router.get('/plans/:id', plansController.getById);
router.post('/plans', plansController.create);
router.patch('/plans/:id', plansController.update);
router.delete('/plans/:id', plansController.delete);

export { router as plansRouter };
