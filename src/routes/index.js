import { Router } from 'express';
import authRoutes from './auth.routes.js';
import adminRoutes from './admin.routes.js';
import taxonomyRoutes from './taxonomy.routes.js';
import workersRoutes from './workers.routes.js';
import listingsRoutes from './listings.routes.js';
import requestsRoutes from './requests.routes.js';
import bookingsRoutes from './bookings.routes.js';
import reviewsRoutes from './reviews.routes.js';
import { sendSuccess } from '../utils/api-response.js';

const router = Router();

router.get('/health', (req, res) => {
  return sendSuccess(res, {
    message: 'Service is healthy',
    data: { status: 'ok', service: 'artisan-marketplace-api' }
  });
});

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/taxonomy', taxonomyRoutes);
router.use('/workers', workersRoutes);
router.use('/listings', listingsRoutes);
router.use('/requests', requestsRoutes);
router.use('/bookings', bookingsRoutes);
router.use('/reviews', reviewsRoutes);

export default router;
