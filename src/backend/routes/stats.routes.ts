import { Router } from 'express';
import { statsController } from '../controllers/stats.controller';

export const statsRouter = Router();

statsRouter.get('/stats', statsController.get);
