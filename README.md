# Yuksalish.dev

Brend landing sahifasi. Konsepsiya — **yuksalish = cho‘qqiga ko‘tarilish**: skroll qilganda kamera
Chimyon tog‘lari bo‘ylab Katta Chimyon cho‘qqisiga (3 309 m) ko‘tariladi, manzara esa to‘rt fasldan o‘tadi.

| Bo‘lim | Fasl | Balandlik | Manzara |
|---|---|---|---|
| Bosh sahifa, manifest | Navro‘z (bahor) | 1 600 m | tongi tuman, yengil yomg‘ir, o‘rik gullari, kamalak ranglari |
| Xizmatlar | Saraton (yoz) | 2 100 m | baland quyosh, qaldirg‘ochlar, quyosh zarralari |
| Ishlar | Mezon (kuz) | 2 700 m | oltin soat, shamol, chinor barglari, mo‘ridan tutun |
| Aloqa | Chilla (qish) | 3 309 m | kechki osmon, oy va yulduzlar, qor, uyda chiroq |

Manzara `canvas`da protsedur tarzda chiziladi: 6 qatlamli tog‘ tizmalari, havo perspektivasi,
qor chizig‘i, vodiy tumani, daraxtlar va uy. Ustida ob-havo zarrachalari.

Interaktivlik: sichqoncha parallaksi, bo‘sh joyga bosganda faslga mos zarrachalar, o‘ng tomonda
altimetr, so‘zma-so‘z ochiladigan manifest, gorizontal portfolio galereyasi, email nusxalash.

## Ishga tushirish

Build kerak emas:

```bash
npx serve .
```

## Tahrirlash

- Matnlar, aloqa ma’lumotlari va portfolio — `index.html` (Telegram, email, telefon va loyihalar hozircha namunaviy).
- Fasl ranglari, harorat, ob-havo kuchi — `assets/js/world.js` dagi `PAL`, `NUM`, `TYPES`.
- Forma `mailto:` orqali yuboradi — `sendForm()` funksiyasida o‘zgartirish mumkin (masalan, Telegram bot API).
