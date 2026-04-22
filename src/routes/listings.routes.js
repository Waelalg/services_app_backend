import { Router } from 'express';
import {
  createAvailabilityRule,
  createPortfolioImage,
  createTimeOff,
  createWorkArea,
  createWorkerListing,
  editAvailabilityRule,
  getListing,
  listMyListings,
  listingAvailableSlots,
  publishWorkerListing,
  removeAvailabilityRule,
  removeListing,
  removePortfolioImage,
  removeTimeOff,
  removeWorkArea,
  unpublishWorkerListing,
  updateWorkerListing
} from '../controllers/listing.controller.js';
import { optionalAuth, requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { listingGalleryUpload } from '../middlewares/upload.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import {
  availabilityRuleIdParamsSchema,
  availabilityRuleSchema,
  availableSlotsQuerySchema,
  createListingSchema,
  listingIdParamsSchema,
  myListingsQuerySchema,
  portfolioImageIdParamsSchema,
  portfolioImageSchema,
  timeOffIdParamsSchema,
  timeOffSchema,
  updateAvailabilityRuleSchema,
  updateListingSchema,
  workAreaIdParamsSchema,
  workAreaSchema
} from '../validations/listing.validation.js';

const router = Router();

router.get('/me', requireAuth, requireRole('WORKER'), validateRequest({ query: myListingsQuerySchema }), listMyListings);
router.get('/:listingId/available-slots', validateRequest({ params: listingIdParamsSchema, query: availableSlotsQuerySchema }), listingAvailableSlots);
router.get('/:listingId', optionalAuth, validateRequest({ params: listingIdParamsSchema }), getListing);

router.use(requireAuth, requireRole('WORKER'));

router.post('/', listingGalleryUpload, validateRequest({ body: createListingSchema }), createWorkerListing);
router.patch('/:listingId', validateRequest({ params: listingIdParamsSchema, body: updateListingSchema }), updateWorkerListing);
router.patch('/:listingId/publish', validateRequest({ params: listingIdParamsSchema }), publishWorkerListing);
router.patch('/:listingId/unpublish', validateRequest({ params: listingIdParamsSchema }), unpublishWorkerListing);
router.delete('/:listingId', validateRequest({ params: listingIdParamsSchema }), removeListing);
router.post('/:listingId/work-areas', validateRequest({ params: listingIdParamsSchema, body: workAreaSchema }), createWorkArea);
router.delete('/work-areas/:workAreaId', validateRequest({ params: workAreaIdParamsSchema }), removeWorkArea);
router.post('/:listingId/portfolio', validateRequest({ params: listingIdParamsSchema, body: portfolioImageSchema }), createPortfolioImage);
router.delete('/portfolio/:portfolioImageId', validateRequest({ params: portfolioImageIdParamsSchema }), removePortfolioImage);
router.post('/:listingId/availability-rules', validateRequest({ params: listingIdParamsSchema, body: availabilityRuleSchema }), createAvailabilityRule);
router.patch('/availability-rules/:ruleId', validateRequest({ params: availabilityRuleIdParamsSchema, body: updateAvailabilityRuleSchema }), editAvailabilityRule);
router.delete('/availability-rules/:ruleId', validateRequest({ params: availabilityRuleIdParamsSchema }), removeAvailabilityRule);
router.post('/:listingId/time-off', validateRequest({ params: listingIdParamsSchema, body: timeOffSchema }), createTimeOff);
router.delete('/time-off/:timeOffId', validateRequest({ params: timeOffIdParamsSchema }), removeTimeOff);

export default router;
