# Yazkan Stok — Oturum Devam Notu

Tarih: 2026-08-20

## Son tamamlanan istek

Takım Tutucular için **Hurda / Kullanım Dışı** sayfası geliştirildi. Sayfa; stoktan tutucu seçme, hurda miktarı girme, hurda nedeni seçme, hasar/açıklama yazma, tarih, konum, onaylayan ve tanık/teslim alan bilgilerini kaydetme özelliklerine sahip.

Hurda kaydı oluşturulduğunda takım tutucunun `current_stock` miktarı güvenli biçimde azalıyor. Miktar mevcut stoktan fazla olamıyor. Hurda kaydı ayrıca `toolholder_scraps` koleksiyonuna ve `toolholder_movements` hareket geçmişine yazılıyor.

Her hurda kaydı için **PDF Tutanak** indirme endpointi ve arayüz düğmesi eklendi. Tutanakta tutucu, marka, tip, kesici uç kodu/ismi, ölçüler, miktar, hurda nedeni, açıklama, tarih, konum, işlemi yapan, onaylayan ve tanık/imza alanları bulunuyor. Türkçe karakterler için DejaVuSans kullanılıyor.

## Eklenen dosya ve değişiklikler

- `frontend/src/pages/HurdaTutucular.jsx` oluşturuldu.
- `frontend/src/App.js` içine `/hurda-tutucular` rotası eklendi.
- `frontend/src/components/Layout.jsx` içine **Hurda / Kullanım Dışı** menü bağlantısı eklendi.
- `backend/server.py` içine `ToolHolderScrapIn` modeli eklendi.
- `GET /api/toolholder-scraps`
- `POST /api/toolholders/{tid}/scrap`
- `GET /api/toolholder-scraps/{scrap_id}/pdf`

## Yerel durum

Backend Python sözdizimi başarılı.
Frontend production build başarılı; yalnızca projede önceden bulunan ESLint uyarıları devam ediyor.

Yerel commit:

```text
650473e — Add toolholder scrap tracking and PDF report
```

## Bekleyen tek işlem

GitHub push ve Render deployu tamamlanamadı. GitHub bağlantı panelinde şu hata görülüyor:

```text
[failed_precondition] failed to get GitHub token: internal: refresh token failed: token refresh failed with status: 429
```

GitHub hesabı tarayıcıda açık görünmesine rağmen bağlantı tokenı yenilenemiyor. Kullanıcı, GitHub bağlantısını yapılandırmayı denedi fakat hata devam etti. Kullanıcı isteğiyle işlem yarına bırakıldı.

## Yarın devam planı

Önce GitHub bağlantısındaki 429 token yenileme sorunu tekrar kontrol edilecek. Bağlantı düzelirse:

1. `cd /home/ubuntu/yazkan-stok-live && git push origin main`
2. Render deployunun tamamlanması beklenecek.
3. `https://yazkan-stok.onrender.com/hurda-tutucular` canlıda açılacak.
4. Sol menüde Hurda / Kullanım Dışı bağlantısı kontrol edilecek.
5. Takım tutucu seçimi, hurda nedeni, miktar doğrulaması ve PDF Tutanak düğmesi canlıda kontrol edilecek.
6. Canlı doğrulama sonucu kullanıcıya teslim edilecek.

Kullanıcı bugün devam etmek istemiyor; yarın aynı noktadan devam edilecek.
