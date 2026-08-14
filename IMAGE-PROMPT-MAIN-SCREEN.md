# Промт для генерации изображения главного экрана THE90

Использовать в Midjourney / Flux / Nano Banana / GPT Image. Основной промт — на английском (модели точнее держат цвета и типографику). Ниже — вариации и негативный промт.

---

## Основной промт

```
A single mobile app screen UI design, shown flat and straight-on as a clean
1:1 pixel screenshot at 390x852 — not a 3D phone mockup, no hands, no desk,
no perspective.

PRODUCT: "THE90" — a football prediction app. Editorial sports-broadcast
visual language, closer to a UEFA or DAZN broadcast graphics package than
to a generic dribbble UI kit.

PALETTE — strict:
- background #0E0E0E, near-black, with a very fine 2% film grain
- card surfaces #151515 and #1C1C1C, separated only by a 1px top edge
  highlight of rgba(255,255,255,0.06)
- one single accent: electric neon green #24FF00, used sparingly and only
  on active states — never as a wash
- supporting green #1FCB72 for passing/positive states
- amber #FFC94A reserved exclusively for coins and points
- red #F05D5D only for a countdown running out
- text #F7FAF8, secondary text at 50% opacity

TYPOGRAPHY: geometric grotesque (Sora / Space Grotesk feel). Uppercase
11px section labels with wide letter-spacing. Large tabular-figure numbers
at 28px bold for points and scores — numbers are the hero of the layout.

SCREEN CONTENT, top to bottom:
1. Compact top bar: "THE90" wordmark left, the 90 in neon green. Right side:
   a small flame streak counter reading 6, an amber coin balance pill
   "10 000", a bell icon with a red notification dot.
2. A thin one-line status strip: "PICKS CLOSE IN 02:14:37" in uppercase,
   with a hairline progress rule underneath.
3. A LIVE SLIP card — dark, with a 1px green edge and a soft green glow only
   along its top edge. Inside: pulsing LIVE dot, minute 67', two club crests
   with score 2–2, and to the right a large green number "+1 240" that is
   clearly a running total. A tiny label reads "your pick is live".
4. A horizontal date strip: seven compact rounded date chips, the active one
   filled dark green #13231A with a thin neon border, the rest flat #1A1A1A.
5. A progress row: a small circular progress ring reading 7/10 next to the
   text "3 matches left", and on the right a league chip "#14 / 128".
6. ONE expanded match card: rounded 24px corners, header area with a
   restrained two-tone duotone gradient built from the two club colours
   (no photographic blur, no busy texture), faint dashed pitch markings at
   very low opacity as a subtle texture only. Two club crests at 40px,
   club names, a league chip and kickoff time. Below: a segmented control
   with three options — Win 1 / Draw / Win 2 — the middle-left one active
   in solid neon green with dark text. Under the segments a thin three-part
   crowd-split bar labelled 58% / 22% / 20%. Below that a compact score
   stepper row and a small "Both to score? Yes / No" toggle.
7. Two collapsed match rows beneath it: 64px tall, crest pair, team names,
   a small green check, a chevron.
8. At the bottom, floating over the content: a single pill-shaped bar with
   "Total points 4 820" on the left and a solid neon green "ACCEPT" button
   on the right, and below it a rounded dark navigation bar with four icons,
   the active one green.

CRAFT: tight 8px grid, generous negative space around numbers, everything
aligned to a shared baseline. Depth comes from a 1px light edge on the top
of each card and from real elevation, not from heavy drop shadows or
frosted-glass panels everywhere. Restrained, expensive, quiet — the neon
green appears on only two or three elements in the entire screen.
```

---

## Негативный промт

```
3D phone mockup, hand holding phone, perspective, desk scene, glossy
reflections, iridescent mesh gradient, purple and blue AI gradient, glassy
3D orbs, chrome blobs, floating bubbles, neon glow on everything, lens
flare, bokeh, generic dribbble style, oversized rounded blobs, fake
lorem-ipsum garbage text, distorted letterforms, misspelled words,
duplicate UI elements, cluttered layout, drop shadows everywhere,
watermark, signature, logo overlay, low contrast mush
```

---

## Настройки

| Модель | Параметры |
|---|---|
| Midjourney | `--ar 9:19.5 --style raw --stylize 150 --v 7` |
| Flux / Nano Banana | guidance 3.5–4, разрешение 832×1792 |
| GPT Image | добавить в конец: `output a flat UI screenshot, portrait, no device frame` |

`--style raw` и низкий stylize принципиальны — именно они убирают «ИИ-шность».

---

## Вариации

**А. Только состояние результата** — заменить пункты 2–3 на:

```
2. A results recap card at the top: "YESTERDAY" label, a large amber number
   "+1 240", the line "7 of 10 correct · 1 exact score", and below it
   "You moved #14 → #9 in Office League" with a small upward arrow.
   Two quiet ghost buttons: "Review round" and "Share".
```

**Б. Свайп-колода вместо списка** — заменить пункты 6–7 на:

```
6. A stacked card deck: one match card in front, two more peeking behind it
   offset by 8px and slightly scaled down and dimmed, suggesting a swipeable
   deck. A "3 / 10" counter sits above the stack.
```

**В. Светлая тема** — фон `#F4F6F5`, карточки `#FFFFFF`, текст `#0E0E0E`, зелёный заменить на более глубокий `#00C24A` (чистый `#24FF00` на белом нечитаем).

---

## Как не получить «ИИ-шный» результат

Пять правил, которые дают основной эффект:

1. **Одна акцентная точка на экран.** Модели по умолчанию заливают неоном всё. В промте прямо написано «appears on only two or three elements» — эту фразу не убирать.
2. **Запрет на 3D-мокап.** Формулировка «flat straight-on screenshot, no device frame» обязательна, иначе получится рендер телефона на столе.
3. **`--style raw` / низкий stylize.** Художественная интерпретация — главный источник «ИИ-шности».
4. **Фактура вместо блеска.** «Fine 2% film grain» и «1px top edge highlight» вместо frosted glass и градиентов.
5. **Референс не из UI, а из вещания.** «UEFA / DAZN broadcast graphics» уводит модель от шаблонных дизайнерских дашбордов.

И главное: текст в интерфейсе ни одна модель не отрисует корректно. Картинку стоит воспринимать как мудборд направления, а финальные подписи собирать в Figma поверх.
