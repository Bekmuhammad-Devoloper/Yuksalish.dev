# Yuksalish.dev — fasllar landingi

Interaktiv brend landing sahifasi: bitta doimiy manzara (tog‘lar, ko‘l, daraxt, uy) skroll qilinganda
**Bahor → Yoz → Kuz → Qish** bo‘lib almashadi.

| Bo‘lim | Fasl | Ob-havo va manzara |
|---|---|---|
| Biz haqimizda | Bahor | yomg‘ir, gulbarglar, kamalak, gullagan daraxt |
| Xizmatlar | Yoz | yorqin quyosh, qushlar, uchar nurlar |
| Ishlar | Kuz | shamol, to‘kilayotgan barglar, olmalar, qovoqlar, mo‘ridan tutun |
| Aloqa | Qish | qor, muzlagan ko‘l, qorli archalar, qorodam |

Qo‘shimcha interaktivlik: sichqoncha bilan parallaks, bo‘sh joyga bosganda faslga mos “portlash”
(gulbarg / nur / barg / qor), o‘ngdagi fasl navigatsiyasi va pastdagi harorat vidjeti.

## Ishga tushirish

Hech qanday build kerak emas — oddiy statik sayt:

```bash
npx serve .        # yoki index.html ni brauzerda oching
```

## Tahrirlash

- Matnlar va aloqa ma’lumotlari — `index.html` (Telegram, email, telefon hozircha namunaviy).
- Forma `assets/js/scene.js` oxiridagi `mailto:` manziliga yuboradi.
- Fasl ranglari, harorat va ob-havo kuchi — `assets/js/scene.js` dagi `COLORS`, `NUMBERS`, `TYPES`.
- Uslublar — `assets/css/style.css`.
