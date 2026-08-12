# Yazkan Döküm Takımhane Stok Takip — PRD

## Original problem statement
Turkish factory (Yazkan Döküm) takımhane stok/personel/tezgah/tutucu sarfiyat takibi. B2B SaaS dashboard, PWA. Marka: YAZKAN DÖKÜM TAKIMHANE.

## Personas
- **Yönetici (admin)**: takimhane@yazkan.com.tr — tek CRUD yetkili
- **Görüntüleme (viewer)**: kayıt olan diğer kullanıcılar — yalnızca listeleme/rapor

## Core requirements
- Ürün: auto `YZK00001…` kod, Konum/Kalite/Marka, `is_special` (Özel Takım işareti), fiyatsız
- Personel: ad/soyad + önceden tanımlı görev
- Tezgah: kod/ad/tür + marka/model
- **Takım Tutucular** (yeni): Adı/Markası/Tipi/Boy/Çap + stok + konum. Giriş=Takımhaneye, Çıkış=Tezgaha (machine_id zorunlu), personel opsiyonel.
- Stok Giriş/Çıkış, QR/barkod tarama, Suppliers + Orders (kısmi teslimat, manuel ürün otomatik oluşturma)
- Raporlar, Excel export
- Kritik stok e-postası, günlük 08:00 TR özet e-postası
- PWA
- RBAC: admin=mutate, viewer=read-only
- Şifremi unuttum → e-posta ile 1 saatlik token
- **Admin Wipe**: `/api/admin/wipe-all` tüm işletme verilerini siler + sample_seeded flag ekleyerek restart'ta reseed'i önler

## Implemented
### Iter 1-5 [2026-02]
MVP, PWA, QR, Suppliers, Orders (kısmi teslim), Excel import, Msg 100 pivot, RBAC (79/79), rebrand + forgot password.

### Iter 6 — Takım Tutucular + Özel Takım + Wipe [2026-02-12]
- Yeni koleksiyon `toolholders` + `toolholder_movements` + endpoint'ler (`/api/toolholders` CRUD + `/in` + `/out`, `/api/toolholder-movements`)
- Frontend `TakimTutucular.jsx` sayfası, nav item, Giriş/Çıkış modalları, hareket geçmişi, RBAC gating
- ProductIn'e `is_special` alanı; Products.jsx'te checkbox + "Özel Takım" rozeti + "özel takım" araması tüm işaretlileri getirir
- `/api/admin/wipe-all` endpoint'i tüm işletme verilerini siler ve `settings.sample_seeded=true` flag'i insert ederek startup reseed'i kapatır
- Backend test: 97/97 PASS + 1 skipped legacy user (Iter 6 test_toolholders.py 19 yeni test)
- Frontend E2E: nav-toolholders, Yeni Tutucu, Giriş/Çıkış modal doğrulandı; Özel Takım checkbox + badge + arama filtresi doğrulandı

## Backlog
### P1
- USB barkod tabancası (klavye emülasyonu)
- Tezgah bakım takvimi + hatırlatma
- Admin panelinde kullanıcı yönetimi (viewer listeleme/silme, rol atama)
- Uygulama içi şifre değiştirme
- Tutucular için kritik stok e-postası & raporda dahil edilmesi

### P2
- Multi-admin, Native mobile, Ürün resmi yükleme, Envanter sayım modu
- server.py 1400+ satır — auth/products/toolholders/orders/reports/admin router modüllerine bölünmesi

## Credentials
Admin: `takimhane@yazkan.com.tr` / `123456`

## Tech stack
React + TailwindCSS + Shadcn UI • FastAPI + Motor (MongoDB) + APScheduler • JWT (httpOnly cookie + Bearer) • Resend via Emergent Email Key • html5-qrcode • openpyxl • bcrypt • secrets/hashlib
