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

> **Diqqat:** hozirgi `assets/img/*.jpg` — vaqtinchalik past sifatli nusxalar. To‘liq o‘lchamli suratlar bilan
> almashtirilishi kerak (bir xil fayl nomlari, 1536×864 yoki kattaroq).

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
