# ProximityMap AI — Indoor Navigation & Proximity Marketing

## Problem statement
"help me with ESP32 compatibility and I wanted to build Indoor Navigation and Proximity Marketing. the scenario will be the customer will be guided through floor plan in the web application in their smartphone going to the product aisle. I already have four ESP32-S3. and i have smartphone. help me also to setup in my windows 10 computer because I want to run it locally. I already install arduino IDE"

## User personas
- **Store Manager (Admin)** — uploads floor plan, places beacons, defines aisles & products with discounts
- **Shopper (Customer)** — opens web app on phone, sees self on map, searches a product, follows arrow + turn-by-turn, receives proximity promo popups

## User choices
- Hybrid BLE + Wi-Fi positioning (4× ESP32-S3 beacons)
- Custom floor plan upload (PNG/JPG)
- Proximity = product info + discount when near a specific product
- Pure-local deployment on Windows 10
- Customer features: live "you are here" dot + product search + routing arrow + proximity promos + turn-by-turn

## Architecture
- React 19 + Tailwind + shadcn/ui + framer-motion + react-zoom-pan-pinch
- FastAPI + Motor (Mongo) backend, all routes under `/api`
- Positioning: weighted RSSI centroid (BLE & Wi-Fi, BLE weighted higher)
- Routing: A* on 20px grid with turn-by-turn instruction generation
- ESP32-S3 sketch: BLE iBeacon + Wi-Fi SoftAP + HTTP heartbeat to backend

## Implemented (2026-02)
- Backend: floorplans CRUD + activate, beacons CRUD + heartbeat, aisles CRUD, products CRUD, positioning scan, proximity check, routing, stats — 16/16 tests pass
- Frontend: Landing, Admin (Overview, Floor Plan upload, Beacon placement, Aisle drawing, Products+Promos), Setup Guide (Windows 10 + Arduino tabs + downloadable sketch), Customer mobile view (zoom-pan map, search modal, route + steps, proximity promo toast, simulate mode, Web Bluetooth toggle)
- Arduino sketch at `/app/arduino_sketches/ESP32_S3_Beacon/ESP32_S3_Beacon.ino`

## Backlog (P1–P2)
- P1: Replace A* on empty grid with shelf-aware grid (aisle interiors as obstacles) so paths bend around shelves
- P1: Persist last positions per visitor for analytics (heatmap of foot traffic)
- P2: Background task to flip `beacon.online=false` server-side (currently only computed at read time)
- P2: DELETE endpoints return 404 on unknown id
- P2: Admin analytics dashboard (top searched products, promo conversions)
- P2: Coupon redemption flow (QR code at checkout)
- P2: Multi-floor support

## Next tasks
- Run end-to-end with real ESP32-S3 hardware in user's Windows 10 environment
- Optionally migrate floor plan storage from base64-in-Mongo to object storage if floor plans get large
