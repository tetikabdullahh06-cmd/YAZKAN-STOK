# CNC Takımhane Stok Takip — PRD

## Original problem statement
Turkish CNC toolroom stock/personnel/machine consumption tracking for a small factory. Track cutting tools, inserts, materials. Web + PWA. B2B SaaS style dashboard.

## Personas
- **Yönetici (admin)**: tek yetkili — tüm CRUD, sipariş, stok giriş/çıkış, teslim alma, Excel içe aktarma
- **Görüntüleme (viewer)**: kayıt olan tüm diğer kullanıcılar — yalnızca listeleme, rapor okuma, kritik stok görüntüleme

## Core requirements
- Ürün: otomatik `YZK00001…` kod (opsiyonel manuel), ad, kategori, birim, min/current stok, konum, kalite, marka — fiyat YOK
- Personel: ad, soyad, önceden tanımlı görev (CNC Dik İşlemeci, CNC Tornacı, Üniversal Tornacı, Taşlamacı, Üretim Mühendisi + custom)
- Tezgah: kod, ad, tür (CNC Torna, CNC Freze / Dik İşleme, Üniversal Torna, Taşlama, Delme, Diğer + custom), marka, model, açıklama
- Stok Giriş/Çıkış: fiyatsız; QR/barkod ile ürün seçimi; çıkışta personel+tezgah zorunlu
- Tedarikçi + Sipariş: kalemler kayıtlı ürün ya da manuel; teslim alırken manuel ürün yoksa otomatik YZK kodu ile oluşturulur
- Raporlar: tarih aralığı + tek seçimli (Ürün/Personel/Tezgah bazlı), Excel indirme
- Kritik stok e-postası (Resend via Emergent Email Key), günlük 08:00 TR özet e-postası
- PWA (manifest + service worker)
- **Rol bazlı erişim**: admin=mutate, viewer=read-only. Backend'de `require_admin` dependency ile tüm POST/PUT/DELETE gate'li; GET herkese açık. Frontend'de mutation butonları admin dışında gizli, "Görüntüleme Modu" bannerı gösterilir.

## Implemented
### Iteration 1 — MVP (Faz 1-4)  [2026-02]
JWT auth, admin seed, sample data. CRUD: products, personnel, machines. Stok in/out, movements, kritik stok email, dashboard, raporlar + Excel. Türkçe dark UI. Backend 22/22.

### Iteration 2 — Faz 5-6  [2026-02]
PWA, QR/barkod, APScheduler daily digest, Suppliers CRUD + Orders. Backend 37/37.

### Iteration 3 — Ölçekleme  [2026-02]
Excel toplu ürün içe aktarma, kısmi sipariş teslimatı. Backend 46/46.

### Iteration 4 — Msg 100 Pivot  [2026-02-12]
Fiyat kaldırıldı, Konum/Kalite/Marka eklendi, `YZK#####` auto-code, personel sicil no→görev listesi, tezgah tür alanı, manuel sipariş kalemi → otomatik ürün, raporlar tek seçimli, `close_order` manuel kalemler için düzeltildi. Backend 40/40.

### Iteration 5 — Rol Bazlı Erişim  [2026-02-12]
- Admin email değiştirildi: `takimhane@yazkan.com.tr` (env: ADMIN_EMAIL/OWNER_EMAIL)
- User modeline `role` alanı: `"admin" | "viewer"` (default viewer)
- Startup migration: role'ü olmayanlar viewer'a düşürülür, ADMIN_EMAIL sahibi admin yapılır
- `require_admin` FastAPI Depends → 20 mutation endpoint (products/personnel/machines/suppliers/orders/stock/imports/admin) 
- `/auth/me`, `/login`, `/register` yanıtları `role` içerir; register her zaman viewer
- Frontend: `useAuth().isAdmin`, Layout nav filtreleme (Stok Girişi/Çıkışı admin-only), rol rozeti + "Görüntüleme Modu" bannerı
- Products/Personnel/Machines/Suppliers/Orders sayfalarında Add/Edit/Delete/Receive/Close butonları viewer'a gizli

## Backlog
### P1
- USB barkod tabancası (klavye emülasyonu)
- Tezgah bakım takvimi + hatırlatma
- Admin panelinden viewer kullanıcıları listeleme + rol değiştirme + silme
- Multi-admin: birden fazla yönetici desteği (şu an yalnızca ENV'daki tek admin)

### P2
- Native mobile (Expo)
- Ürün resmi yükleme
- Envanter sayım modu
- Yasal migrations (`unit_price`/`reg_no` cleanup on legacy docs)

## Credentials
Bkz. `/app/memory/test_credentials.md`. Admin: `takimhane@yazkan.com.tr` / `Admin123!`

## Tech stack
React + Vite + TailwindCSS + Shadcn UI • FastAPI + Motor (MongoDB) + APScheduler • JWT (httpOnly cookie + Bearer) • Resend via Emergent Email Key • html5-qrcode • openpyxl
