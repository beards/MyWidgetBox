# MyWidgetBox

A growing collection of small, single-purpose browser Widgets for live streaming (OBS Browser Source) and everyday use. Static site, deployed to <https://beards.github.io/MyWidgetBox/>.

Vocabulary (Widget, Settings, State, Outcome, ...) is defined in [GLOSSARY.md](GLOSSARY.md); architecture decisions live in [docs/adr/](docs/adr/).

## Browser support

- **Hard support:** current Chrome / Edge (Chromium) and the OBS Browser Source (Chromium-based). Every feature must work there.
- **Best effort:** current Firefox, Safari, iOS Safari and Android Chrome. The main flows (roll, spin, start a timer, Settings and Presets, Share links, Display mode) work; the features below may degrade.

On touch screens the controls grow to finger size and narrow layouts reflow; desktop and OBS keep the compact layout.

| Feature | Where it degrades | What happens |
| --- | --- | --- |
| Screen Wake Lock (timer keeps the screen on while running) | Browsers without the API (older Safari < 16.4, Firefox < 126), low-battery mode, hidden tab | The lock is skipped silently; the screen may turn off, the timer keeps counting. |
| Shake to roll (dice, `DeviceMotionEvent`) | Desktop browsers have no motion sensor; iOS Safari asks for permission | "Not supported" / "denied" is shown under the option. On iOS permission can only be asked from a tap: turning the option on asks right away; a page loaded with it already on asks on the first tap. |
| Sound (Web Audio built-ins, custom sound URL) | Browsers block audio until the user has interacted with the page | A page nobody has clicked (e.g. a timer alert in an untouched tab) may stay silent; one click or key press unlocks it. OBS Browser Source plays audio without interaction. A custom URL that fails to load falls back to the built-in sound. |
| 3D dice (WebGL via three.js) | WebGL unavailable (GPU disabled, blocked by policy, very old devices) | The dice roll as flat colored tiles showing each value; the Outcome, history and timing are unchanged. |
| Appearance scale (CSS `zoom`) | Firefox < 126 | The scale setting has no effect. |
| Copy Share link (Clipboard API) | Insecure origins, permission refused | "Copy failed" is shown and the link text is selected for copying by hand. |

## Local development

Requires Node 26 and npm.

```sh
npm install
npm run dev        # dev server at http://localhost:5173/MyWidgetBox/ (catalog), .../dice/, ...
npm test           # run tests once (npm run test:watch to watch)
npm run typecheck
npm run lint
npm run build      # production build into dist/ (base path /MyWidgetBox/)
npm run preview    # serve the production build
```

## Deployment

Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml): typecheck, lint, test and build must all pass before the site is deployed to GitHub Pages.

## Project structure

```
index.html          catalog page at the site root
vite.config.ts      multi-page build: one entry per Widget
shared/             opt-in modules any Widget may use
  env.ts            Env interface + production Env (crypto, Date.now, localStorage, location)
  test-env.ts       deterministic Env for tests (fixed random sequence, manual clock, memory storage)
  random.ts         unbiased random integers (rejection sampling)
  i18n.ts           UI text: message tables, language resolution (?lang= > saved choice > browser)
  i18n-dom.ts       binds data-i18n attributes and mounts the language switcher
  share-link.ts     Share link encoding/decoding (?s=, display, transparent, lang)
  display-mode.ts   Display mode: hides [data-controls] elements
  appearance.ts     appearance Settings baseline (background solid/transparent/image, font, size, scale); Widgets extend it
  appearance-dom.ts applies an appearance to the page and mounts the appearance panel
dice/               one directory per Widget, served at /<name>/
  index.html        page entry
  main.ts           view layer: DOM, animation, sound
  controller.ts     headless controller: pure logic, no DOM
  controller.test.ts
```

### Controller + Env pattern

Each Widget is split into two layers:

- **Headless controller** (`controller.ts`): holds Settings, State and Outcome, exposes actions (e.g. `roll()`) plus `getState()` / `subscribe()`. It never touches browser globals; everything from the outside world (random source, clock, storage, URL) comes from the `Env` passed to its factory.
- **View layer** (`main.ts`): creates the controller with `createBrowserEnv()`, renders on every state change, and calls actions in response to user input.

Tests exercise the controller only, injecting `createTestEnv()` and asserting on public state. Random Outcomes are always decided by the controller before any animation; the view only shows them.

Per [ADR-0002](docs/adr/0002-widgets-are-technologically-independent.md), Widgets are technologically independent: anything under `shared/` is opt-in, and a Widget may use a different stack as long as it lives in its own directory.

## Adding a Widget

1. Create a directory named after the Widget's URL, e.g. `wheel/` for `/wheel/`, with `index.html`, `main.ts`, `controller.ts` and `controller.test.ts` (copy `dice/` as a template).
2. Write the controller test-first against `createTestEnv()`; keep DOM code in `main.ts`.
3. Add the directory name to the `widgets` list in `vite.config.ts`.
4. Add a link to it in the root `index.html` catalog.

No other Widget needs to change.

## License

[MIT](LICENSE)
