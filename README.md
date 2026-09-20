INE Price Tracker

A full-stack product price and stock tracking application developed for the INE Software Engineer Intern assignment.

Live Application

Frontend: https://ine-price-tracker-1-jalj.onrender.com

Backend API: https://ine-price-tracker-j8p0.onrender.com

GitHub: https://github.com/ylosifer/INE-price-tracker

Features

Search products by partial or complete name

Track products

Persist tracked products using Supabase PostgreSQL

Scrape current price and stock

Retry failed scraping attempts

Record every scraping attempt

Store successful price and stock observations

Display price history

Display scraping logs

Manually trigger a scrape

Scheduled scraping through an external scheduler

Playwright-based browser scraping

React frontend

Node.js/Express backend

Architecture

React + Vite Frontend
        |
        | REST API
        v
Node.js + Express Backend
      /           \
     /             \
    v               v
Supabase        Playwright
PostgreSQL        Scraper
                    |
                    v
              INE Mock Store

cron-job.org
      |
      v
POST /api/scrape/all

Technology Stack

Frontend

React

Vite

Axios

Recharts

CSS

Backend

Node.js

Express.js

Playwright

Supabase JavaScript Client

CORS

dotenv

Database

Supabase

PostgreSQL

Scheduler

cron-job.org

Database Design

tracked_products

Stores products selected for tracking.

Important fields:

id

store_product_id

product_name

product_url

created_at

is_active

price_history

Stores successfully validated price and stock observations.

Important fields:

id

tracked_product_id

original_price

current_price

stock

scraped_at

A history record is created only after price and stock have been successfully extracted and validated.

scrape_logs

Stores every scraping attempt.

Important fields:

id

tracked_product_id

attempted_at

status

attempt_number

response_time_ms

error_type

error_message

Possible statuses:

success

retried

failed

Scraping Strategy

The provided INE mock store intentionally introduces difficulties for scraping. Product prices are dynamically revealed and may not be immediately available after the initial page load. The store can also introduce slow responses and temporary failures.

The application therefore uses Playwright for the browser interaction required to retrieve the rendered price.

The scraping workflow is:

Open Product Page
       |
       v
Wait for Page Elements
       |
       v
Interact with Price / Reveal Control
       |
       v
Wait for Rendered Price
       |
       v
Extract Original Price
       |
       v
Extract Current Price
       |
       v
Extract Stock Status
       |
       v
Validate Data
       |
       v
Successful?
   /       \
 Yes        No
  |          |
  v          v
Store      Retry
History

Retry and Failure Handling

Each product scrape can make up to three attempts.

Example:

Attempt 1 -> Failed
Attempt 2 -> Failed
Attempt 3 -> Success

Every attempt is recorded in scrape_logs.

An unsuccessful scrape is not represented as a successful price observation.

Only a successful scrape containing valid price and stock information is inserted into price_history.

The scraper records:

Attempt number

Timestamp

Response time

Status

Error type

Error message

If one tracked product fails, the overall scraping cycle can continue processing the other active tracked products.

Data Validation

A scrape is considered successful only when the required information is available.

The application checks:

Current price exists

Stock status exists

The expected product page was reached

The rendered price was successfully obtained

If the required information cannot be obtained, the attempt is treated as a failure rather than guessing a value.

API Endpoints

Health Check

GET /api/health

Example:

{
  "status": "ok"
}

Product Search

GET /api/products

Returns products from the provided INE mock store.

Get Tracked Products

GET /api/tracked-products

Track Product

POST /api/tracked-products

Scrape Product

POST /api/scrape/product/:trackedProductId

Scrape All Active Products

POST /api/scrape/all

Runs the scraper for all active tracked products. This endpoint is intended to be triggered by the external scheduler and is protected using a cron secret.

Price History

GET /api/history/:trackedProductId

Scrape Logs

GET /api/history/:trackedProductId/logs

Scheduled Scraping

The application uses an external scheduler to trigger periodic scraping.

The scheduler sends:

POST /api/scrape/all

The intended schedule is every 2 hours.

The endpoint is protected using the request header:

x-cron-secret

An external scheduler is used because free-tier backend services can sleep or restart. An in-process timer would therefore not provide reliable periodic execution.

Environment Variables

Backend

Create backend/.env:

PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
CRON_SECRET=your_cron_secret

The Supabase service-role key must remain server-side.

Frontend

Create frontend/.env:

VITE_API_URL=http://localhost:5000/api

For production:

VITE_API_URL=https://ine-price-tracker-j8p0.onrender.com/api

Local Development

Backend

cd backend
npm install
npm start

Backend:

http://localhost:5000

Frontend

In another terminal:

cd frontend
npm install
npm run dev

Production Deployment

Backend

Render root directory:

backend

Build command:

npm install && PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium

Start command:

node src/server.js

Frontend

Render root directory:

frontend

Build command:

npm install && npm run build

Start command:

npm run preview -- --host 0.0.0.0 --port $PORT

Project Structure

INE-price-tracker/
|
├── backend/
|   ├── src/
|   |   ├── config/
|   |   ├── routes/
|   |   ├── scraper/
|   |   ├── services/
|   |   └── server.js
|   ├── package.json
|   └── .env.example
|
├── frontend/
|   ├── src/
|   |   ├── components/
|   |   ├── pages/
|   |   ├── api.js
|   |   └── App.jsx
|   ├── package.json
|   └── .env.example
|
├── .gitignore
└── README.md

Example Scrape Result

The scraper has been successfully tested against the provided INE mock store.

Example successful observation:

Product ID: 961
Original Price: Rs. 32,093
Current Price: Rs. 13,800
Stock: IN STOCK

The exact price and stock values can change because the mock store intentionally changes product data.

Reliability Demonstration

The scraper is designed to handle:

Slow responses

Temporary request failures

Delayed price rendering

Failed browser interactions

Missing price information

Instead of silently stopping or storing an incorrect value, the scraper:

Records the failed attempt.

Retries the scrape.

Records subsequent attempts.

Validates the final result.

Stores price history only after a successful scrape.

Why Playwright?

The mock store does not expose all required information immediately in the initial HTML response. The price is dynamically revealed through browser interaction.

Playwright was selected because it can:

Launch Chromium

Navigate to the product page

Interact with page elements

Wait for dynamically rendered content

Extract rendered price and stock information

HTTP requests are preferred where sufficient, while browser automation is used where browser interaction is genuinely required.

Why Supabase?

Supabase provides PostgreSQL persistence with a straightforward API.

It stores:

Tracked products

Price history

Stock history

Scraping logs

Foreign keys maintain relationships between tracked products and their history/log records.

Why External Scheduling?

A periodic scraper should not depend on the backend process remaining alive indefinitely. Free-tier hosting environments may sleep or restart services.

The scraping cycle is therefore exposed through:

POST /api/scrape/all

and triggered externally by cron-job.org.

Engineering Trade-offs

Browser Automation vs HTTP

A pure HTTP scraper would be faster and simpler, but the mock store requires browser interaction to reveal dynamically loaded price information. Playwright is therefore used where necessary.

Retry Count

Three attempts balance recovery from temporary failures against excessive requests.

Data Correctness vs Availability

The scraper prioritizes data correctness. If price or stock cannot be confidently obtained, the system records a failure instead of storing a guessed value.

Logging Every Attempt

Recording only successful scrapes would hide important information about scraper reliability. The separate scrape_logs table provides an audit trail for successful and unsuccessful attempts.

AI-Assisted Development

AI assistance was used during development for implementation suggestions, debugging, code generation, API design assistance, deployment troubleshooting, and documentation.

Suggestions were tested against the actual mock store rather than being accepted without validation.

When an approach failed because of browser interaction, dynamic content, or hosting-environment limitations, it was adjusted based on observed behavior.

The final implementation prioritizes:

Explicit retries

Validation

Observable failures

Honest history

Separation of scraping attempts from successful observations

Testing

Backend

Health endpoint

Product retrieval

Tracked product retrieval

Product tracking

Individual product scraping

Scrape retry behavior

Price history retrieval

Scrape log retrieval

Scraper

Product navigation

Dynamic price rendering

Price extraction

Stock extraction

Retry handling

Successful history insertion

Failure logging

Frontend

Product search

Product selection

Product tracking

Price history display

Scrape log display

Manual scraping

Deployment

Render backend deployment

Render frontend deployment

Production API communication

Supabase database connectivity

Future Improvements

Price drop notifications

Email notifications

Configurable scraping frequency

Improved multi-product dashboard

DOM change detection

Additional selector fallbacks

Scraper health monitoring

CI/CD automation

Detailed application metrics

Historical stock availability visualization

Security Considerations

Supabase service-role credentials remain server-side.

Environment files are excluded from Git.

The scraping endpoint is protected using a secret header.

Frontend environment variables contain only public configuration.

No sensitive credentials are committed to the repository.

Assignment Deliverables

Deliverable

Status

Live application

Available

Public GitHub repository

Available

Supabase persistence

Implemented

Product search and tracking

Implemented

Price and stock scraping

Implemented

Retry handling

Implemented

Price history

Implemented

Scrape logs

Implemented

External scheduling

Configured

README

Included

Design note

Included separately

Demo video

Submitted separately

Resume PDF

Submitted separately

Links

Live Application: https://ine-price-tracker-1-jalj.onrender.com

Backend API: https://ine-price-tracker-j8p0.onrender.com

GitHub: https://github.com/ylosifer/INE-price-tracker

Author

Shourya Pachauri

Developed as part of the INE Software Engineer Intern assignment.
