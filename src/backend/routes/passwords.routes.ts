import { Router } from 'express';
import { passwordsController } from '../controllers/passwords.controller';
import { validate } from '../middleware/validate.middleware';
import {
  passwordMasterBody,
  passwordCreateBody,
  passwordUpdateBody,
  passwordImportConfirmBody,
  passwordImportParseBody,
  passwordBulkDeleteBody,
  passwordChangeMasterBody,
} from '../validations/passwords.validation';

const router = Router();

router.get('/passwords/status', passwordsController.isSetup);
router.post('/passwords/setup', validate({ body: passwordMasterBody }), passwordsController.setup);
router.post('/passwords/unlock', validate({ body: passwordMasterBody }), passwordsController.unlock);
router.post('/passwords/lock', passwordsController.lock);

router.post(
  '/passwords/import/parse',
  validate({ body: passwordImportParseBody }),
  passwordsController.parseImportFile,
);
router.post(
  '/passwords/import/confirm',
  validate({ body: passwordImportConfirmBody }),
  passwordsController.confirmImport,
);

router.post(
  '/passwords/change-master',
  validate({ body: passwordChangeMasterBody }),
  passwordsController.changeMasterPassword,
);
router.post('/passwords/bulk-delete', validate({ body: passwordBulkDeleteBody }), passwordsController.bulkDelete);
router.get('/passwords', passwordsController.getAll);
router.get('/passwords/:id', passwordsController.getById);
router.post('/passwords', validate({ body: passwordCreateBody }), passwordsController.create);
router.patch('/passwords/:id', validate({ body: passwordUpdateBody }), passwordsController.update);
router.patch('/passwords/:id/favorite', passwordsController.toggleFavorite);
router.delete('/passwords/:id', passwordsController.delete);

export { router as passwordsRouter };
