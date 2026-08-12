# CNC Takımhane Stok Takip — PRD

## Original problem statement
Turkish CNC toolroom web + mobile stock/personnel/machine consumption tracking for 5 users with equal rights.

## User personas
- Toolroom operator/technician (5 users, single role)

## Core requirements
- Product / Personnel / Machine / Supplier / Order CRUD
- Stock IN (supplier, qty, price) — Stock OUT (personnel + machine)
- Critical stock: dashboard + email alert
- Reports: by product / personnel / machine / supplier + Excel export
- Dashboard: KPIs + top consumers + recent movements
- Daily digest email at 08:00 Europe/Istanbul
- QR / barcode scan on stock in & out
- PWA (install to home screen)

## Implemented (2026-02)
### Iteration 1 (MVP - Faz 1-4)
- JWT auth (register / login / me / logout), admin seeded
- Sample data (8 products, 5 personnel, 4 machines)
- Full CRUD: products (with custom category), personnel, machines
- Stock in/out with movement history + filters
- Critical stock endpoint + email (6h dedupe, Resend)
- Dashboard, reports summary, Excel export
- Turkish industrial dark UI (Chivo + IBM Plex Sans)
- Backend: 22/22 pytest passing

### Iteration 2 (Faz 5-6)
- **PWA**: manifest.json + service worker, "install to home screen" ready
- **QR / Barkod tarama**: html5-qrcode ile stok girişi + çıkışı ekranlarında kamera butonu
- **Günlük özet e-postası**: APScheduler cron 08:00 Europe/Istanbul, dünkü giriş/çıkış detay HTML tablosu
- **Tedarikçiler**: CRUD + tedarikçi kartları + toplam alım tutarı
- **Siparişler**: Sipariş oluşturma (kalemler, teslim tarihi), açık/kapalı filtresi, "Kapat & Stoğa İşle" akışı otomatik stok girişi yaratır
- Stok girişi ekranı tedarikçi dropdown ile bağlı
- Rapor: tedarikçi bazlı toplam alım (`/api/reports/by-supplier`)
- Manuel test için `/api/admin/send-daily-digest`
- Backend: 37/37 pytest passing

## Backlog / P1
- Barkod fiziksel scanner (USB) girişi
- Toplu sipariş içe aktarma (CSV/Excel)
- Sipariş kapatırken kısmi teslimat desteği
- Native mobile (Expo) — Emergent yayın desteklediğinde

## P2
- Rol bazlı yetki (admin / operatör / görüntüleyici)
- Muhasebe / ERP entegrasyonu
- Advanced brute-force lockout
- Router modularization (server.py splitting)

## Credentials
`/app/memory/test_credentials.md`
