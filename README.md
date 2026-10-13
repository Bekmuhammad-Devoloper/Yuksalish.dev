# Yuksalish.dev

Brend landing sahifasi. Konsepsiya — **yuksalish = cho‘qqiga ko‘tarilish**: skroll qilganda kamera
Chimyon tog‘lari bo‘ylab Katta Chimyon cho‘qqisiga (3 309 m) ko‘tariladi, manzara esa to‘rt fasldan o‘tadi.

| Bo‘lim | Fasl | Balandlik | Manzara |
|---|---|---|---|
| Bosh sahifa, manifest | Navro‘z (bahor) | 1 600 m | tongi tuman, yengil yomg‘ir, o‘rik gullari, kamalak ranglari |
| Xizmatlar | Saraton (yoz) | 2 100 m | baland quyosh, qaldirg‘ochlar, quyosh zarralari |
| Ishlar | Mezon (kuz) | 2 700 m | oltin soat, shamol, chinor barglari, mo‘ridan tutun |
| Aloqa | Chilla (qish) | 3 309 m | kechki osmon, oy va yulduzlar, qor, uyda chiroq |

Orqa fon — bitta kompozitsiyadagi 4 ta fotorealistik surat (`assets/img/bahor|yoz|kuz|qish.jpg`), skroll bilan
bir-biriga o‘tadi. Ustida `canvas`da real ob-havo: chuqurlikka ega yomg‘ir va qor (bokeh), aylanib tushayotgan
barglar, gulbarglar, suzuvchi vodiy tumani, quyosh nurlari.


Interaktivlik: sichqoncha parallaksi, bo‘sh joyga bosganda faslga mos zarrachalar, o‘ng tomonda
altimetr, so‘zma-so‘z ochiladigan manifest, gorizontal portfolio galereyasi, email nusxalash.

## Ishga tushirish

Node.js 18+ kerak, `npm install` shart emas (tashqi kutubxona yo‘q):

```bash
ADMIN_PASSWORD="kuchli-parol" SESSION_SECRET="uzun-tasodifiy-satr" npm start
# sayt:  http://localhost:3000
# admin: http://localhost:3000/admin
```

| O‘zgaruvchi | Vazifasi |
|---|---|
| `ADMIN_PASSWORD` | Admin panel paroli. Berilmasa, admin panelga kirib bo‘lmaydi. |
| `SESSION_SECRET` | Sessiya imzosi. Berilmasa, har qayta ishga tushganda admin qayta kirishi kerak bo‘ladi. |
| `PORT` | Port, standart `3000`. |
| `COOKIE_SECURE=1` | Sayt HTTPS orqali ishlaganda yoqing. |

Serverda PM2 bilan: `ADMIN_PASSWORD=... pm2 start server.js --name yuksalish`.

## Admin panel

`/admin` — parol bilan kiriladi.

- **Loyihalar:** qo‘shish, tahrirlash, o‘chirish, faol/nofaol qilish, tartibini o‘zgartirish, muqova rasmini tanlash yoki yuklash.
- **Jamoa:** xodim qo‘shish, tahrirlash, o‘chirish, faol/nofaol qilish, tartib, rasm yuklash, ko‘rsatkichlar, ko‘nikmalar va havolalar.

Ma’lumotlar `data/db.json` faylida saqlanadi (birinchi ishga tushishda `data/db.seed.json` dan yaratiladi),
yuklangan rasmlar `assets/uploads/` papkasida. Ikkalasi ham git’ga kirmaydi — serverda zaxira nusxasini oling.
Server ishlamasa (masalan, `index.html` to‘g‘ridan-to‘g‘ri ochilsa), sahifadagi statik kontent ko‘rsatiladi.

## Tahrirlash

- Loyihalar va jamoa — admin panel orqali. Boshqa matnlar va aloqa ma’lumotlari — `index.html`.
- Fasl ranglari, harorat, ob-havo kuchi — `assets/js/world.js` dagi `PAL`, `NUM`, `TYPES`.
- Forma `mailto:` orqali yuboradi — `sendForm()` funksiyasida o‘zgartirish mumkin (masalan, Telegram bot API).

## Brend

- Logotip: `assets/brand/logo-mark.svg` (qush), `assets/brand/logo-wordmark.svg` (yozuv), `assets/brand/favicon.svg`.
  Asl rasmdan vektorlashtirilgan; dizaynerdan asl vektor fayl olinsa, shu fayllarni almashtirish kifoya.
- Ranglar: navy `#13265a`, shampan-oltin `#c9b48a` (saytda `--navy`, `--gold`).

## Jamoa

`index.html` dagi `#jamoa` bo‘limi. Rasmlar: `assets/team/bekmuhammad.jpg`, `assets/team/ziyodulloh.jpg` (4:5 portret).
Rasm topilmasa, o‘rnida bosh harflar ko‘rsatiladi.
