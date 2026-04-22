import { Router } from 'express';
import {
  acceptRequestOffer,
  cancelRequest,
  createOffer,
  createRequest,
  editRequest,
  opportunitiesFeed,
  rejectRequestOffer,
  removeOffer,
  requestDetails,
  requestOffers,
  listMyRequests
} from '../controllers/request.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { clientRequestImagesUpload } from '../middlewares/upload.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import {
  createClientRequestSchema,
  createOfferSchema,
  listOffersQuerySchema,
  offerIdParamsSchema,
  opportunitiesQuerySchema,
  requestIdParamsSchema,
  requestsListQuerySchema,
  updateClientRequestSchema
} from '../validations/request.validation.js';

const router = Router();

router.get('/explore', requireAuth, requireRole('WORKER'), validateRequest({ query: opportunitiesQuerySchema }), opportunitiesFeed);
router.get('/opportunities', requireAuth, requireRole('WORKER'), validateRequest({ query: opportunitiesQuerySchema }), opportunitiesFeed);
router.get('/my', requireAuth, requireRole('CLIENT'), validateRequest({ query: requestsListQuerySchema }), listMyRequests);
router.patch('/offers/:offerId/accept', requireAuth, requireRole('CLIENT'), validateRequest({ params: offerIdParamsSchema }), acceptRequestOffer);
router.patch('/offers/:offerId/reject', requireAuth, requireRole('CLIENT'), validateRequest({ params: offerIdParamsSchema }), rejectRequestOffer);
router.delete('/offers/:offerId', requireAuth, requireRole('WORKER'), validateRequest({ params: offerIdParamsSchema }), removeOffer);
router.post('/', requireAuth, requireRole('CLIENT'), clientRequestImagesUpload, validateRequest({ body: createClientRequestSchema }), createRequest);
router.get('/:requestId/offers', requireAuth, requireRole('CLIENT'), validateRequest({ params: requestIdParamsSchema, query: listOffersQuerySchema }), requestOffers);
router.patch('/:requestId/cancel', requireAuth, requireRole('CLIENT'), validateRequest({ params: requestIdParamsSchema }), cancelRequest);
router.patch('/:requestId', requireAuth, requireRole('CLIENT'), validateRequest({ params: requestIdParamsSchema, body: updateClientRequestSchema }), editRequest);
router.get('/:requestId', requireAuth, validateRequest({ params: requestIdParamsSchema }), requestDetails);
router.post('/:requestId/offers', requireAuth, requireRole('WORKER'), validateRequest({ params: requestIdParamsSchema, body: createOfferSchema }), createOffer);

export default router;
