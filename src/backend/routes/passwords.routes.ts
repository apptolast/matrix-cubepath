import { Router } from 'express';
import { passwordsController } from '../controllers/passwords.controller';

const router = Router();

router.get('/passwords/status', passwordsController.isSetup);
router.post('/passwords/setup', passwordsController.setup);
router.post('/passwords/unlock', passwordsController.unlock);
router.post('/passwords/lock', passwordsController.lock);

router.post('/passwords/import/parse', passwordsController.parseImportFile);
router.post('/passwords/import/confirm', passwordsController.confirmImport);

router.post('/passwords/change-master', passwordsController.changeMasterPassword);
router.post('/passwords/bulk-delete', passwordsController.bulkDelete);
router.get('/passwords', passwordsController.getAll);
router.get('/passwords/:id', passwordsController.getById);
router.post('/passwords', passwordsController.create);
router.patch('/passwords/:id', passwordsController.update);
router.patch('/passwords/:id/favorite', passwordsController.toggleFavorite);
router.delete('/passwords/:id', passwordsController.delete);

export { router as passwordsRouter };
