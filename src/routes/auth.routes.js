import { Router } from 'express';
import {
  login,
  me,
  register,
  registerClient,
  registerWorker,
  updateProfile
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import {
  clientRegisterSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
  workerRegisterSchema
} from '../validations/auth.validation.js';

const router = Router();

router.post('/register', validateRequest({ body: registerSchema }), register);
router.post('/register/client', validateRequest({ body: clientRegisterSchema }), registerClient);
router.post('/register/worker', validateRequest({ body: workerRegisterSchema }), registerWorker);
router.post('/login', validateRequest({ body: loginSchema }), login);
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, validateRequest({ body: updateProfileSchema }), updateProfile);

export default router;
