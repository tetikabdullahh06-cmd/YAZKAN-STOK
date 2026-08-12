# Yazkan Döküm Takımhane Stok Takip — PRD

## Original problem statement
Turkish factory (Yazkan Döküm) takımhane stok/personel/tezgah sarfiyat takibi. B2B SaaS dashboard, PWA. Marka: YAZKAN DÖKÜM TAKIMHANE.

## Personas
- **Yönetici (admin)**: takimhane@yazkan.com.tr — tek CRUD yetkili
- **Görüntüleme (viewer)**: kayıt olan diğer kullanıcılar — yalnızca listeleme/rapor

## Core requirements
- Ürün: auto `YZK00001…` kod, Konum/Kalite/Marka, fiyatsız
- Personel: ad/soyad + önceden tanımlı görev
- Tezgah: kod/ad/tür (CNC Torna, CNC Freze/Dik İşleme, vb.) + marka/model
- Stok Giriş/Çıkış, QR/barkod tarama, Suppliers + Orders (kısmi teslimat, manuel ürün otomatik oluşturma)
- Raporlar (Ürün/Personel/Tezgah tek seçim), Excel export
- Kritik stok e-postası, günlük 08:00 TR özet e-postası (Resend via Emergent Email Key)
- PWA
- RBAC: admin=mutate, viewer=read-only. Backend `require_admin` + Frontend UI gating
- **Şifremi unuttum**: e-posta ile 1 saatlik tek kullanımlık token → yeni şifre belirleme

## Implemented
### Iter 1-3 [2026-02]
MVP, PWA, QR, Suppliers, Orders (kısmi teslimat), Excel import.

### Iter 4 — Msg 100 Pivot [2026-02-12]
Fiyat kaldırıldı, `YZK#####` auto-code, Konum/Kalite/Marka, personel görev listesi, tezgah tür, manuel sipariş kalemleri → otomatik ürün. Backend 40/40.

### Iter 5 — RBAC [2026-02-12]
`role` (admin|viewer), `require_admin` dependency (20 endpoint), startup migration, UI gating + rol rozeti + "Görüntüleme Modu" banner. Backend 79/79.

### Iter 6 — Rebranding + Şifre Sıfırlama [2026-02-12]
- Marka değişimi: "CNC Takımhane" → "YAZKAN DÖKÜM TAKIMHANE" (Login/Register/Layout başlıkları, index.html title, manifest.json, meta tags, e-posta from_name)
- Admin şifre: `Admin123!` → `123456` (env)
- Şifremi unuttum akışı:
  - POST /api/auth/forgot-password (enumeration-safe — her zaman 200)
  - E-posta gönderimi (Resend via Emergent Email Key, HTML template)
  - Token: `secrets.token_urlsafe(32)`, SHA-256 hash olarak DB'de, 1 saat geçerli, tek kullanımlık
  - POST /api/auth/reset-password (token + yeni şifre)
  - Frontend: /sifremi-unuttum + /sifre-sifirla?token= sayfaları
  - E2E test: kullanılan token 400, süresi dolan 400, invalid 400 ✓

## Backlog
### P1
- USB barkod tabancası (klavye emülasyonu)
- Tezgah bakım takvimi + hatırlatma
- Admin panelinde kullanıcı yönetimi (viewer listeleme/silme, rol atama)
- Uygulama içi şifre değiştirme (giriş yapmışken)

### P2
- Multi-admin desteği
- Native mobile (Expo)
- Ürün resmi yükleme
- Envanter sayım modu

## Credentials
Bkz. `/app/memory/test_credentials.md`. Admin: `takimhane@yazkan.com.tr` / `123456`

## Tech stack
React + TailwindCSS + Shadcn UI • FastAPI + Motor (MongoDB) + APScheduler • JWT (httpOnly cookie + Bearer) • Resend via Emergent Email Key • html5-qrcode • openpyxl • bcrypt • secrets/hashlib (password reset tokens)
