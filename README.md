# Shop Backend

REST API for an e-commerce store, built with **Node.js, Express, TypeScript, Prisma and PostgreSQL**.
Designed to run fully on your own machine (works offline) and to deploy on free tiers.

## Features

- JWT auth: short-lived access token + httpOnly refresh-token cookie, roles `USER` / `ADMIN`
- Products: search, category filter, price range, sorting, pagination
- Categories, server-side cart, checkout, order history, mock payment
- Stock handled inside database transactions (no overselling, cancelled orders restock)
- Admin API: product/category CRUD, image upload, order status workflow, users, dashboard stats
- Zod validation, centralized error handling, helmet, CORS, rate limiting
- Seed data with offline placeholder images

## Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or Docker)

## Getting started

1. `npm install`
2. Start a database:
   - with Docker: `docker compose up -d`
   - or use your own PostgreSQL / a free cloud database (e.g. Neon) and set `DATABASE_URL` in `.env`
     (the first `npm run setup` creates `.env` from `.env.example`)
3. `npm run setup` (creates the tables and demo data)
4. `npm run dev`

API: http://localhost:4000/api, Swagger docs: http://localhost:4000/api/docs

Demo accounts created by the seed:

| Role  | Email            | Password   |
|-------|------------------|------------|
| Admin | admin@shop.dev   | Admin12345 |
| User  | user@shop.dev    | User12345  |

Useful commands: `npm run db:studio` (browse the database), `npm run db:reset` (wipe and re-seed), `npm run typecheck`.

## API overview

All routes are prefixed with `/api`. Prices are integers in **cents**. Protected routes need `Authorization: Bearer <accessToken>`.

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/health` | public | Health check |
| POST | `/auth/register` | public | Create account |
| POST | `/auth/login` | public | Log in, returns `accessToken` and sets refresh cookie |
| POST | `/auth/refresh` | cookie | New access token |
| POST | `/auth/logout` | public | Clear refresh cookie |
| GET | `/auth/me` | user | Current user |
| GET | `/categories` | public | List categories |
| POST / PATCH / DELETE | `/categories`, `/categories/:id` | admin | Manage categories |
| GET | `/products` | public | Query: `q, category, minPrice, maxPrice, sort, page, limit` |
| GET | `/products/:idOrSlug` | public | Product details |
| POST / PATCH / DELETE | `/products`, `/products/:id` | admin | Manage products (delete = deactivate) |
| GET | `/cart` | user | Current cart with total |
| POST | `/cart/items` | user | `{ productId, quantity }` |
| PATCH / DELETE | `/cart/items/:productId` | user | Change quantity / remove |
| DELETE | `/cart` | user | Empty cart |
| POST | `/orders` | user | Checkout (shipping fields in body) |
| GET | `/orders`, `/orders/:id` | user | Own orders |
| POST | `/orders/:id/pay` | user | Mock payment |
| POST | `/orders/:id/cancel` | user | Cancel a pending order |
| GET | `/admin/stats` | admin | Dashboard numbers |
| GET | `/admin/products` | admin | Products including inactive |
| GET | `/admin/orders`, `/admin/orders/:id` | admin | All orders, filter by `status` |
| PATCH | `/admin/orders/:id/status` | admin | `{ status }` (PENDING → PAID → SHIPPED → DELIVERED, or CANCELLED) |
| GET | `/admin/users` | admin | All users |
| POST | `/admin/uploads` | admin | Multipart field `image`, returns `{ url }` |

Image URLs are returned as `/uploads/...`; prefix them with the API origin in the frontend.

## Frontend notes (Next.js)

- Set `CLIENT_URL` in `.env` to the frontend origin (`http://localhost:3000` locally).
- Send requests with `credentials: "include"` so the refresh cookie is used.
- Keep the access token in memory; call `POST /api/auth/refresh` on page load and on a 401.

## Deploy for free

- **Database:** create a free PostgreSQL database on [Neon](https://neon.tech) and copy its connection string.
- **Create the tables and demo data** from your machine: set `DATABASE_URL` to the Neon string, then run `npx prisma migrate deploy` and `npm run db:seed`.
- **API on Vercel:** import this repository (Express is detected automatically) and set the environment variables
  `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL` (your frontend URL) and `NODE_ENV=production`.
  The disk is read-only there, so image upload is disabled in that deployment (demo product images are generated on the fly).
- **Frontend on Vercel:** set `NEXT_PUBLIC_API_URL` to the API URL.
- Cross-site cookies (two different domains) can be blocked by some browsers such as Safari. If that matters, proxy the API through the frontend domain.

## Project structure

```
prisma/        schema, seed
src/
  app.ts       middleware and route wiring
  server.ts    entry point
  routes/      auth, categories, products, cart, orders, admin
  services/    product listing, order cancellation
  middleware/  auth (JWT, roles), error handling
  utils/       tokens, slugs, async handler
```
