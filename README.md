# Artisan Marketplace API

Production-oriented Express.js + Prisma backend for a two-sided artisan marketplace with:

- `CLIENT` users who browse workers, create direct or scheduled bookings, post public requests, favorite workers, and leave reviews
- `WORKER` users who manage listings, work areas, availability, incoming bookings, offers, and dashboard stats

## Stack

- Express.js
- Prisma
- PostgreSQL
- JWT auth
- Zod validation
- JavaScript ES modules

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env`.

3. Configure `DATABASE_URL`, `JWT_SECRET`, and `CLIENT_URL` in `.env`.

4. Generate Prisma client and apply schema changes:

```bash
npm run prisma:generate
npm run prisma:push
```

5. Seed demo data:

```bash
npm run seed
```

6. Start the server:

```bash
npm run dev
```

## Environment variables

- `PORT`: HTTP server port. Default `4000`
- `NODE_ENV`: runtime mode. Default `development`
- `CLIENT_URL`: allowed CORS origin for the mobile/web client
- `DATABASE_URL`: PostgreSQL / Neon connection string
- `JWT_SECRET`: signing secret for access tokens
- `JWT_EXPIRES_IN`: JWT expiry string such as `7d`
- `CLOUDINARY_URL`: Cloudinary connection string used for image uploads
- `CLOUDINARY_UPLOAD_FOLDER`: optional Cloudinary base folder. Default `artisan-marketplace`
- `ADMIN_EMAIL`: optional seed admin email
- `ADMIN_PASSWORD`: optional seed admin password
- `ADMIN_FIRST_NAME`: optional seed admin first name
- `ADMIN_LAST_NAME`: optional seed admin last name

## Core business rules

- Mobile roles are `CLIENT` and `WORKER`; `ADMIN` exists only for protected back-office routes
- Worker registration creates a lightweight `WorkerProfile`
- Worker specialization is defined by `WorkerListing` records, not by a single worker-level profession field
- Categories and subcategories use `imageUrl` for UI images instead of icon fields
- Bookings support both `DIRECT` and `SCHEDULED`
- `scheduledDate`, `slotStart`, and `slotEnd` stay nullable for direct bookings
- Reviews are allowed only once per completed booking
- Only clients can favorite workers
- Workers cannot book themselves
- Public client requests can receive worker offers
- Accepting an offer creates a confirmed booking linked to that offer
- Uploaded images are stored in Cloudinary and persisted as hosted HTTPS URLs, which works on Render free instances

## Role rules

- `CLIENT` can browse workers, favorite workers, create bookings, create public requests, accept or reject offers on own requests, and review completed jobs
- `WORKER` can manage own listings, work areas, portfolio, availability, time off, incoming bookings, opportunities, and offers
- A worker account is generic at registration time and can publish multiple service listings across categories/subcategories
- Listing mutation endpoints are worker-only and ownership-checked
- Request mutation endpoints are client-only and ownership-checked
- Offer creation and withdrawal are worker-only
- Booking cancellation is client-only, while booking accept/decline/complete is worker-only
- Admin taxonomy routes require an authenticated user with role `ADMIN`

## Demo seed

`npm run seed` creates a full demo dataset for the app:

- `Works`: Plumbing, Painting, Electricity, Waterproofing, Locksmith, Drywall
- `Beauty`: Hair, Makeup
- `Health`: Nursing, Physio
- one admin account
- two client accounts
- three worker accounts with profiles
- published and draft listings
- work areas, gallery images, availability rules, and time off
- public client requests with photos
- offers in `SENT`, `ACCEPTED`, and `REJECTED`
- direct bookings and request-offer bookings in `PENDING`, `CONFIRMED`, `COMPLETED`, and `CANCELLED`
- reviews and favorites

The seed refreshes the known demo accounts instead of wiping unrelated database records.

Default demo credentials:

- admin: `admin@example.com` / `AdminPass123`
- client: `client@example.com` / `ClientPass123`
- worker: `worker@example.com` / `WorkerPass123`

## API response format

Success:

```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": ["Invalid email"]
  }
}
```

## Main endpoints

### Auth

- `POST /api/auth/register`
- `POST /api/auth/register/client`
- `POST /api/auth/register/worker`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/me`

### Taxonomy

- `GET /api/taxonomy/categories`
- `GET /api/taxonomy/categories/:categoryId/subcategories`

### Admin taxonomy

- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `PATCH /api/admin/categories/:categoryId`
- `DELETE /api/admin/categories/:categoryId`
- `POST /api/admin/categories/:categoryId/subcategories`
- `PATCH /api/admin/subcategories/:subcategoryId`
- `DELETE /api/admin/subcategories/:subcategoryId`

### Workers

- `GET /api/workers`
- `GET /api/workers/:workerId`
- `GET /api/workers/:workerId/reviews`
- `POST /api/workers/:workerId/favorite`
- `DELETE /api/workers/:workerId/favorite`
- `GET /api/workers/favorites/me`
- `GET /api/workers/dashboard/me`

`GET /api/workers/dashboard/me` returns worker home data with:

- `stats`
- `recentIncomingBookings`
- `recentOpportunities`
- `upcomingJobs`

Each booking item in `recentIncomingBookings` and `upcomingJobs` now includes:

- `contactPhone`
- `address.wilaya`
- `address.commune`
- `address.addressLine`

### Listings

- `GET /api/listings/services`
- `POST /api/listings`
- `GET /api/listings/me`
- `GET /api/listings/:listingId`
- `PATCH /api/listings/:listingId`
- `PATCH /api/listings/:listingId/publish`
- `PATCH /api/listings/:listingId/unpublish`
- `DELETE /api/listings/:listingId`
- `POST /api/listings/:listingId/work-areas`
- `DELETE /api/listings/work-areas/:workAreaId`
- `POST /api/listings/:listingId/portfolio`
- `DELETE /api/listings/portfolio/:portfolioImageId`
- `POST /api/listings/:listingId/availability-rules`
- `PATCH /api/listings/availability-rules/:ruleId`
- `DELETE /api/listings/availability-rules/:ruleId`
- `POST /api/listings/:listingId/time-off`
- `DELETE /api/listings/time-off/:timeOffId`
- `GET /api/listings/:listingId/available-slots?date=YYYY-MM-DD`

### Client requests and opportunities

- `POST /api/requests`
- `GET /api/requests/my`
- `PATCH /api/requests/:requestId`
- `PATCH /api/requests/:requestId/cancel`
- `GET /api/requests/:requestId`
- `GET /api/requests/:requestId/offers`
- `GET /api/requests/explore`
- `GET /api/requests/opportunities?tab=explore|offers|confirmed`
- `POST /api/requests/:requestId/offers`
- `DELETE /api/requests/offers/:offerId`
- `PATCH /api/requests/offers/:offerId/accept`
- `PATCH /api/requests/offers/:offerId/reject`

### Bookings

- `POST /api/bookings`
- `GET /api/bookings/my`
- `GET /api/bookings/incoming`
- `GET /api/bookings/:bookingId`
- `PATCH /api/bookings/:bookingId/accept`
- `PATCH /api/bookings/:bookingId/decline`
- `PATCH /api/bookings/:bookingId/complete`
- `PATCH /api/bookings/:bookingId/cancel`

### Reviews

- `POST /api/reviews`

## Registration payloads

Client registration:

```json
{
  "firstName": "Sara",
  "lastName": "Client",
  "email": "client@example.com",
  "password": "ClientPass123",
  "phone": "+213555000001",
  "gender": "FEMALE",
  "dateOfBirth": "1997-05-14"
}
```

Worker registration:

```json
{
  "firstName": "Yacine",
  "lastName": "Worker",
  "email": "worker@example.com",
  "password": "WorkerPass123",
  "phone": "+213555000002",
  "gender": "MALE",
  "dateOfBirth": "1994-08-23"
}
```

Optional profile extras such as `avatarUrl`, `headline`, `bio`, `yearsExperience`, and `avgResponseMinutes` are handled later through profile updates and do not define worker specialization.

## Listing creation payload

Service identity lives on listings. The worker create-listing flow can be submitted as `multipart/form-data` in one request:

- `categoryId`: text, required
- `subcategoryId`: text, optional
- `title`: text, required
- `description`: text, required
- `pricingType`: text, optional, `QUOTE|FIXED|HOURLY`
- `priceFrom`: text/number, optional
- `currency`: text, optional, defaults to `DZD`
- `isPublished`: text/boolean, optional, defaults to `true`; send `false` only when saving a draft
- `workAreas`: text containing a JSON array
- `availabilityRules`: text containing a JSON array
- `images`: file, optional, repeat this key for multiple gallery photos

Example `workAreas` form field value:

```json
[{"wilaya":"Biskra","commune":"Doucen"}]
```

Example `availabilityRules` form field value:

```json
[
  {
    "dayOfWeek": 1,
    "startTime": "09:00",
    "endTime": "17:00",
    "slotDurationMinutes": 60,
    "isActive": true
  }
]
```

This matches the mobile flow:
1. choose category and subcategory
2. define one or more work areas
3. define weekly availability
4. enter service title and description
5. upload optional gallery photos

## Client request creation with photos

`POST /api/requests` also supports `multipart/form-data` so clients can attach request photos.

- `categoryId`: text, required
- `subcategoryId`: text, optional
- `title`: text, required
- `description`: text, required
- `wilaya`: text, required
- `commune`: text, required
- `addressLine`: text, optional
- `preferredDate`: text, optional, `YYYY-MM-DD`
- `preferredTime`: text, optional, `HH:mm`
- `requestMode`: text, optional, usually `OPEN_REQUEST`
- `images`: file, optional, repeat this key for multiple photos

The returned request payload includes:

```json
{
  "images": [
    {
      "id": "image_cuid",
      "imageUrl": "https://res.cloudinary.com/your-cloud/image/upload/v123/artisan-marketplace/requests/images/file.jpg",
      "displayOrder": 0
    }
  ]
}
```

## Admin taxonomy form-data

Admin taxonomy create/update endpoints accept `multipart/form-data`. Send either `imageUrl` as text or an `image` file. If both are sent, the uploaded file is used.

`POST /api/admin/categories`:

- `name`: text, required
- `slug`: text, optional; generated from name when omitted
- `displayOrder`: text/number, optional
- `imageUrl`: text, optional
- `image`: file, optional

`PATCH /api/admin/categories/:categoryId`:

- `name`: text, optional
- `slug`: text, optional
- `displayOrder`: text/number, optional
- `imageUrl`: text, optional; send empty string to clear the image
- `image`: file, optional

`POST /api/admin/categories/:categoryId/subcategories`:

- `name`: text, required
- `slug`: text, optional; generated from name when omitted
- `displayOrder`: text/number, optional
- `imageUrl`: text, optional
- `image`: file, optional

`PATCH /api/admin/subcategories/:subcategoryId`:

- `name`: text, optional
- `slug`: text, optional
- `displayOrder`: text/number, optional
- `imageUrl`: text, optional; send empty string to clear the image
- `image`: file, optional

Category response shape:

```json
{
  "id": "category_cuid",
  "name": "Works",
  "slug": "works",
  "imageUrl": "https://res.cloudinary.com/your-cloud/image/upload/v123/artisan-marketplace/taxonomy/images/categories/works.jpg",
  "displayOrder": 1,
  "subcategories": [
    {
      "id": "subcategory_cuid",
      "categoryId": "category_cuid",
      "name": "Plumbing",
      "slug": "plumbing",
      "imageUrl": "https://res.cloudinary.com/your-cloud/image/upload/v123/artisan-marketplace/taxonomy/images/subcategories/plumbing.jpg",
      "displayOrder": 1
    }
  ]
}
```

Delete rules:

- A category cannot be deleted while listings or client requests depend on it
- A subcategory cannot be deleted while listings or client requests depend on it
- Deleting an unused category also deletes its unused subcategories

## Important query params

### `GET /api/workers`

- `categoryId`
- `subcategoryId`
- `wilaya`
- `commune`
- `search`
- `minRating`
- `sort=newest|topRated|mostCompleted`
- `page`
- `pageSize`

### `GET /api/listings/services`

Use this for the client flow where the user chooses a category, then a subcategory, and then sees all published services posted by workers in that subcategory.

- `subcategoryId`: required
- `categoryId`: optional safety filter; if sent, the API verifies the subcategory belongs to it
- `wilaya`: optional
- `commune`: optional
- `search`: optional, searches listing title and description
- `minRating`: optional, `0` to `5`
- `sort`: optional, `newest|topRated|mostCompleted|priceLow|priceHigh`
- `page`
- `pageSize`

Example:

```http
GET /api/listings/services?subcategoryId=subcategory_cuid&page=1&pageSize=10
```

Each item returns the worker service listing with `portfolio` pictures, work areas, category, subcategory, worker public info, worker rating, and `isFavorite` when a client token is sent.

### `GET /api/requests/opportunities`

- `tab=explore|offers|confirmed`
- `categoryId`
- `subcategoryId`
- `wilaya`
- `commune`
- `status`
- `page`
- `pageSize`

## Image fields in read responses

- `GET /api/taxonomy/categories` returns `imageUrl` for each category and subcategory
- Listing reads return `portfolio` with uploaded gallery photos
- Client request reads return `images` with uploaded request photos
- Booking reads include listing `portfolio` and, for request-offer bookings, request `images`
- Worker dashboard opportunities and request-based jobs include request photos
- All uploaded image URLs are Cloudinary-hosted `https://` URLs, not local `/uploads/...` paths

### `GET /api/bookings/my`

- returns bookings where the authenticated user is the client who placed the booking
- use this for the client's own booking history and booking tracking screens
- `status`
- `page`
- `pageSize`

### `GET /api/bookings/incoming`

- returns bookings where the authenticated user is the worker receiving the booking
- use this for the artisan's incoming booking requests and job queue
- `status`
- `page`
- `pageSize`

## Booking modes

### Direct booking

Client sends:

```json
{
  "listingId": "listing_cuid"
}
```

Optional fields:

- `note`
- `contactPhone`
- `wilaya`
- `commune`
- `addressLine`

### Scheduled booking

Client sends:

```json
{
  "listingId": "listing_cuid",
  "scheduledDate": "2026-04-25",
  "slotStart": "09:00",
  "slotEnd": "10:00"
}
```

Optional fields:

- `note`
- `contactPhone`
- `wilaya`
- `commune`
- `addressLine`

Booking read responses include:

- `contactPhone`
- `address.wilaya`
- `address.commune`
- `address.addressLine`

The worker dashboard uses the same booking address and phone fields for recent incoming bookings and upcoming jobs.

## Availability and slot generation

`GET /api/listings/:listingId/available-slots?date=YYYY-MM-DD`:

- uses recurring weekly availability rules
- subtracts worker time off
- subtracts confirmed scheduled bookings
- returns only free slots

## Offer acceptance flow

When a client accepts a worker offer:

1. The selected offer becomes `ACCEPTED`
2. Other pending offers on that request become `REJECTED`
3. The client request becomes `BOOKED`
4. A `Booking` is created with source `REQUEST_OFFER`

## Important assumptions

- `GET /api/requests/explore` and `GET /api/requests/opportunities?tab=explore` both expose worker opportunities for convenience
- Public opportunities remain visible while request status is `OPEN` or `OFFERED`
- Accepting an offer creates a `CONFIRMED` booking immediately because client and worker agreement already exists
- Bookings created from accepted offers are linked to the request and offer, but not forced onto a listing
- Reviews are create-only in the current implementation
- Worker profile extras remain nullable and optional; listings are the source of truth for what the worker offers

## Postman

Postman assets are generated in [docs/postman/artisan-marketplace.postman_collection.json](docs/postman/artisan-marketplace.postman_collection.json) and [docs/postman/artisan-marketplace.postman_environment.json](docs/postman/artisan-marketplace.postman_environment.json).

## Validation and authorization

- Zod validates request body, params, and query
- JWT middleware protects private endpoints
- Role middleware guards `CLIENT`, `WORKER`, and `ADMIN`
- Ownership checks protect listings, bookings, requests, offers, favorites, and reviews

## Useful commands

```bash
npm run prisma:validate
npm run prisma:generate
npm run prisma:push
npm run seed
npm run dev
```
