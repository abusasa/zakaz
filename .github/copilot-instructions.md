# Repo guidance for AI coding agents

- This repository is a personal collection of static gift site variants, not a single monolithic app. Most work lives in subfolders like `temp/aruzhan`, `aizere`, and `aizere-sorry`.
- There is no root build system or test suite. The only npm script is in `temp/aruzhan/package.json` for local preview via `npm install` and `npm start`.
- `temp/aruzhan` is a simple animated birthday page. Key files:
  - `temp/aruzhan/index.html` — markup with `data-node-name` placeholders.
  - `temp/aruzhan/customize.json` — text/content override values.
  - `temp/aruzhan/script/main.js` — injects `customize.json` into DOM and runs GSAP animation.
- `aizere` and most `temp/*` subfolders are interactive gift pages using Firebase auth and external API/websocket integration.
  - `aizere/index.html` loads `lang.js`, `jscp/*.js`, and Firebase scripts.
  - `aizere/lang.js` contains translations for `ru`, `vi`, and `en` and is the main source of localizable UI text.
  - `aizere/jscp/settings.js` contains page settings, pricing, and music/book options.
  - `aizere/jscp/ui.js` contains visual/UI helpers and animation helpers.
- In `aizere` and related variants, auth/payment logic is mostly hidden in obfuscated scripts like `jscp/auth.obf.js` and `jscp/voucher.obf.js`. Prefer small changes in visible files first (e.g. `lang.js`, `settings.js`, `ui.js`, `index.html`).
- For translation or content changes in the simple template, update `customize.json` keys to match `data-node-name` attributes. For the interactive gift page, update `lang.js` values.
- External integration points:
  - Firebase auth loaded from `https://www.gstatic.com/firebasejs/8.10.1/...`
  - Backend login API at `https://api.deargift.online/api/auth/login`
  - Socket.io endpoint at `https://api.deargift.online`
  - GSAP animation from CDN in `temp/aruzhan/index.html`
- Keep modifications small and consistent with existing static HTML/CSS/JS structure. Avoid introducing a new bundler, transpiler, or framework without explicit need.
- When editing `index.html`, preserve the existing script order at the bottom of the page; this is important for initialization.
- If you need to debug behavior, use the browser devtools console and inspect network calls from `auth.obf.js`, socket events in `settings.js`, and `customize.json` injection in `temp/aruzhan/script/main.js`.

> Если этот файл недостаточно подробный, скажите, какие части проекта нужно описать глубже.