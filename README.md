# IIPS Restaurant — Full-stack college project

A scroll-animated React website and PostgreSQL-backed Express API for a campus restaurant project. The application supports menu browsing, enquiry submission, review moderation, counter-pay order placement, and a private administrator workspace. It is a student project and is **not an official DAVV website**.

## What's included

- React + TypeScript + Vite frontend with the current cinematic scroll showcase and layered-card effects.
- Express REST API, PostgreSQL schema auto-initialization, and clearly labelled demo menu/offers/review content.
- Database-backed orders with server-calculated prices and item snapshots. Checkout records an order only; it does not process a payment. Customers pay at the counter.
- Contact/enquiry form saved to PostgreSQL.
- Review submission saved as pending until an administrator approves it.
- Admin login, menu create/edit/hide/availability actions, order status updates, enquiry tracking, and review moderation.
- Single-service Render deployment option: the Node service serves the built React frontend and `/api` endpoints from the same origin.

## Requirements

- Node.js 20 or newer and npm.
- PostgreSQL for local full-stack development, or a hosted PostgreSQL connection string.

## Local setup

1. Install dependencies from the project root:

   ```bash
   npm install
   npm --prefix server install
   npm --prefix client install
   ```

2. Create a PostgreSQL database named `iips_restaurant`, or obtain a hosted PostgreSQL database URL.

3. Copy the root `.env.example` file to `server/.env` (create the `server` folder file if it does not exist). Set either `DATABASE_URL` or the `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, and `DATABASE_PASSWORD` values. Also set `SESSION_SECRET` to a random secret of at least 32 characters and set `ADMIN_EMAIL` plus a unique, strong `ADMIN_PASSWORD` of at least 12 characters. Never commit `.env`. For local testing, the simplest option is to use your hosted PostgreSQL connection string as `DATABASE_URL`; otherwise, install/start PostgreSQL locally first.

4. Start both API and frontend from the project root:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:5173`. The admin workspace is at `http://localhost:5173/admin`. Vite proxies `/api` requests to the API on port 4000. The first server startup creates the tables and inserts sample menu/offer/review records.

If your local machine does not have PostgreSQL installed, the frontend can still show its clearly labelled fallback demo items, but database-backed checkout and admin features need a reachable PostgreSQL database.

## Admin login

The initial admin row is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD` the first time the database is initialized, if that email is not already present. The sign-in route uses a hashed password and an HTTP-only, signed session cookie. There is no public administrator registration. If changing an admin password after the first creation, update the password hash through a deliberate admin/reset procedure; changing the bootstrap environment variable alone will not overwrite an existing admin account.

Set `SESSION_SECRET` to a random, high-entropy value at least 32 characters long. If you see “Set SESSION_SECRET…” on Render, open the Render web service → Environment and add `SESSION_SECRET` with a unique random value (at least 32 characters), then save and redeploy. If testing locally, ensure `server/.env` exists and contains `SESSION_SECRET=...`. Also set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the same environment, and ensure the database is reachable; the first successful server startup creates the admin row. The admin cookie is marked `Secure` in production and expires after eight hours. Login is rate-limited.

## Order behavior and limitations

- Order totals are calculated from PostgreSQL menu prices, not trusted from the browser. Menu availability is checked again during order submission.
- This project supports payment at the counter only. It does not accept card details, UPI credentials, or online payment, and it must not claim that payment has been processed.
- Orders are not tied to customer accounts in this student version. Contact information is collected for order follow-up.
- Menu prices/descriptions and the included review/offer records are demo placeholders. Verify real menu details and remove sample content before representing this as a live campus service.
- Public enquiries/reviews/orders are rate-limited and validated, but a real public launch should add further operational safeguards and privacy notices.

## Deploy on Render with a free PostgreSQL database

This is configured for one Render **Web Service** serving both the API and the compiled React app. That means the frontend and API share one origin and do not need separate CORS URLs.

1. Push this folder to a GitHub repository. Do not include any `.env` file or credentials.
2. In Render, create a PostgreSQL database and select the Free plan for the short assignment demo if it is still available for your account/region. Copy its internal connection string or attach the database to the web service so Render provides `DATABASE_URL`. Use the same region for the web service and database.
3. Create a Render Web Service linked to the repo with:
   - **Build command:** `npm install && npm --prefix server install && npm --prefix client install && npm run build`
   - **Start command:** `npm start`
   - **Health check path:** `/api/health`
4. In the service environment, set:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = the PostgreSQL connection string provided by Render
   - `SESSION_SECRET` = a securely generated random string of at least 32 characters
   - `ADMIN_EMAIL` = the admin email you choose
   - `ADMIN_PASSWORD` = a unique strong password, at least 12 characters
5. Deploy. On the first startup, the API creates its tables and sample content, and bootstraps the admin account if that email does not already exist. Open `/api/health` on the deployed URL first; it should report `database: connected`. Then open `/admin` and sign in.
6. Test one counter-pay order, verify it appears in the admin Orders section, change its status, submit an enquiry, approve a review, and confirm they persist after refresh.

### Free tier caveats

Free service limits and plan availability can change. Render free web services can spin down after inactivity, and a free PostgreSQL database is temporary (commonly limited to 30 days). Create the database close to the presentation date, keep a backup of any important demo data, and do not promise uninterrupted availability. If the free database tier is unavailable for your account, stop and reassess rather than enabling a paid plan accidentally.

## Useful endpoints

- `GET /api/health` — API/database health
- `GET /api/menu`, `GET /api/offers`, `GET /api/reviews` — public catalogue/content
- `POST /api/orders`, `POST /api/enquiries`, `POST /api/reviews` — public order and form submissions
- `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/me` — admin session
- `/api/admin/summary`, `/api/admin/menu`, `/api/admin/orders`, `/api/admin/enquiries`, `/api/admin/reviews` — protected admin data/actions

## Visual design

The current build keeps the restaurant's cinematic hero, scroll-progress indicator, horizontal multi-photo story, long pinned layered-card sequence, staggered card reveals, offers, menu search/category filters, and mobile/reduced-motion fallbacks. The scroll animations are custom React/CSS behavior; the project does not claim to use Webflow source or Animmasterlib components.
