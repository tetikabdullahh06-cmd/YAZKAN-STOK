# CNC Takımhane Stok Takip — PRD

## Original problem statement
Turkish CNC toolroom web + mobile stock/personnel/machine consumption tracking for 5 users with equal rights. Products (cutter tips, drills, holders, apparatus, measurement tools), stock in/out linked to personnel + machine, critical stock alert with email + dashboard, reports with Excel export (daily/weekly/monthly/custom).

## User personas
- Toolroom operator/technician (5 users, single role, equal permissions)

## Core requirements (static)
- Product / Personnel / Machine CRUD
- Stock IN (supplier, date, qty, price)
- Stock OUT (must bind to personnel + machine; auto-decrement)
- Movement history with filters
- Critical stock: dashboard + email alert (Resend)
- Reports: by product / personnel / machine + Excel .xlsx
- Dashboard: KPIs + top consumers + recent movements
- JWT auth (email + password), Turkish UI
- Industrial dark blue/gray theme, large touch targets

## Implemented (2026-02)
- Full-stack web MVP (Faz 1-4)
- Auth: register, login, logout, /me, JWT (cookie + Bearer)
- Admin seeded: tetikabdullahh06@gmail.com / Admin123!
- Sample data seeded: 8 products, 5 personnel, 4 machines
- All CRUD endpoints (products / personnel / machines)
- Stock IN / OUT endpoints, movement history with filters
- Critical stock endpoint + email via Emergent Resend (6h dedupe)
- Dashboard endpoint (KPIs, top consumers, critical list, recent)
- Reports summary + Excel export (openpyxl, 4 sheets)
- Full frontend: Login, Register, Dashboard, Products (with custom category add),
  Personnel, Machines, StockIn, StockOut, Movements, CriticalStock, Reports
- Sidebar + mobile bottom nav, sonner toasts, Chivo/IBM Plex Sans fonts
- Backend: 22/22 pytest passing; Frontend: all flows validated

## Backlog / P1
- React Native (Expo) mobile app: login, stock-out screen, search, push notifications (Faz 5)
- Barcode / QR scan for fast stock-out via mobile camera
- Daily / weekly email summary report
- Supplier and purchase-order tracking

## P2
- Role-based permissions (admin / operator / viewer)
- ERP / accounting integration
- Advanced brute-force lockout on login
- Split server.py into per-domain routers

## Credentials
See `/app/memory/test_credentials.md`.
