# Yazkan Döküm Takımhane Stok Takip — PRD

## Original problem statement
Turkish factory (Yazkan Döküm) takımhane stok/personel/tezgah/tutucu sarfiyat takibi. B2B SaaS dashboard, PWA.

## Personas
- **Yönetici (admin)**: takimhane@yazkan.com.tr — CRUD + all mutations
- **Görüntüleme (viewer)**: kayıt olan diğer kullanıcılar — read only

## Core requirements
- Ürünler: auto `YZK00001` kod, Konum/Kalite/Marka, `is_special` (Özel Takım), fiyatsız
- Personel + Tezgah + Suppliers + Orders (kısmi teslim, manuel kalem → auto ürün)
- **Takım Tutucular**: Ad/Marka/Tip/Boy/Çap + stok. Giriş=Takımhane, Çıkış=Tezgah (machine_id zorunlu).
- **Toplu Tutucu İçe Aktarma**: Excel şablon indir + preview + commit (name+brand+type ile eşleşme)
- Stok In/Out, QR/barkod, Raporlar (Excel export)
- **Kritik stok**: Ana Panel'de en üstte belirgin kırmızı uyarı bandı gösterilir; **otomatik e-posta gönderimi devre dışı** (kullanıcı isteği)
- Günlük 08:00 TR özet e-postası (APScheduler) — hâlâ aktif
- RBAC (admin=mutate, viewer=view)
- Şifremi unuttum (e-posta linki, 1 saat)
- **Uygulama içi şifre değiştirme**: `/ayarlar` sayfası, `/api/auth/change-password`
- **Marka**: YAZKAN DÖKÜM TAKIMHANE, Y-monogram SVG logo (sidebar/mobile/login/register/forgot/reset)
- PWA
- `/api/admin/wipe-all` + seed guard flag

## Implemented
### Iter 1-6 [2026-02]
MVP, PWA, QR, Suppliers, Orders (kısmi teslim, manuel), Excel import, Msg 100 pivot, RBAC (79/79), rebrand + forgot password, Takım Tutucular + Özel Takım + wipe-all (97/97).

### Iter 7 — Import + Password Change + Logo + Prominent Critical Alert [2026-02-12]
- POST /api/auth/change-password (mevcut şifre doğrulanır, aynı olamaz, ≥6 karakter)
- GET /api/toolholders/import/template + POST /api/toolholders/import (preview/commit, name+brand+type eşleşme)
- Kritik stok e-posta çağrısı `stock_out` endpoint'inden kaldırıldı — sadece Dashboard'da gösterim
- Dashboard'a en üstte gradient kırmızı "Kritik Stok Uyarıları · N kalem" bandı eklendi (data-testid dashboard-critical-alert), her satır dashboard-critical-row-<code>
- Wrench yerine YazkanLogo (SVG Y-monogram) — Layout sidebar+mobil header, Login/Register/ForgotPassword/ResetPassword brand slot'ları
- Yeni `/ayarlar` sayfası (Settings.jsx) — hesap özeti + şifre değişimi + forced re-login on success
- TakimTutucular sayfasına "Excel'den İçe Aktar" butonu eklendi

## Backlog
### P1
- USB barkod tabancası (klavye emülasyonu)
- Tezgah bakım takvimi + hatırlatma
- Admin panelinde kullanıcı yönetimi
- Real logo file upload — swap out YazkanLogo.jsx SVG when the user provides the official image

### P2
- Multi-admin, Native mobile, Ürün resmi yükleme, Envanter sayım modu
- server.py bölme (auth/products/toolholders/orders/reports/admin router modülleri)

## Credentials
Admin: `takimhane@yazkan.com.tr` / `123456`

## Tech stack
React + Tailwind + Shadcn UI • FastAPI + Motor + APScheduler • JWT (cookie+Bearer) • Resend via Emergent Email Key (daily digest only) • html5-qrcode • openpyxl • bcrypt
