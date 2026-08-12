# CNC Takımhane Stok Takip — PRD

## Original problem statement
Turkish CNC toolroom stock/personnel/machine consumption tracking for 5 users.

## Implemented (2026-02)
### Iteration 1 — MVP (Faz 1-4)
JWT auth, admin seeded, sample data. CRUD: products (custom category), personnel, machines. Stock in/out, movements, critical stock email, dashboard, reports + Excel. Turkish dark UI. Backend 22/22.

### Iteration 2 — Faz 5-6
PWA (manifest+SW). QR/barkod tarama (stock in & out). APScheduler daily digest 08:00 Europe/Istanbul. Suppliers CRUD + Orders (line items, delivery, "Kapat & Stoğa İşle"). Report by supplier. Backend 37/37.

### Iteration 3 — Ölçekleme
**Excel toplu ürün içe aktarma** — şablon indir, dosya yükle, önizleme (create/update/skip stats), tek tıkla uygula. Yeni/güncelle otomatik ayırt edilir. **Kısmi sipariş teslimatı** — sipariş kalemleri için ayrı ayrı teslim miktarı girme, `received_qty` takibi, statü `open → partial → closed`, `Tamamını Kapat` sadece kalanı stoğa işler. Backend 46/46.

## Backlog / P1
- USB barkod tabancası desteği
- Bakım takvimi (tezgah kalibrasyon)
- Native mobile (Expo) — platform destek verdiğinde
- Rol bazlı yetki

## Credentials
`/app/memory/test_credentials.md` — Admin: tetikabdullahh06@gmail.com / Admin123!
