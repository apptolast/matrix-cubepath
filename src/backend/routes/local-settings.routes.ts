import { Router } from 'express';
import { localSettingsController } from '../controllers/local-settings.controller';

export const localSettingsRouter = Router();

localSettingsRouter.get('/local-settings', localSettingsController.getAll);
localSettingsRouter.get('/local-settings/:key', localSettingsController.getOne);
localSettingsRouter.put('/local-settings/:key', localSettingsController.set);
localSettingsRouter.delete('/local-settings/:key', localSettingsController.delete);
