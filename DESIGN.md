# Design

## Visual system

Restrained, Apple-inspired light theme: `#f5f5f7` background, white cards with thin borders, `#1d1d1f` ink, `#0071e3` accent, large tight headlines.

## Multilingual typography

- Japanese and Chinese use system CJK fonts (Hiragino / Noto Sans JP / Yu Gothic; PingFang SC / Noto Sans SC / Microsoft YaHei), wider line height, and smaller headline sizes than English. Rules are scoped with `body.lang-ja` / `body.lang-zh`.
- The language switcher is a segmented pill at the top right; on mobile it stays beside the logo and the navigation scrolls horizontally below.

## Page structure

Home: hero → services → process and stack → strengths → own products → articles → FAQ → inquiry form → contact.

## Anti-patterns

- No fastener or hardware content.
- No fake logos, testimonials, or metrics.
- No mixed-language filler blocks; each language version should read as written for that reader.
