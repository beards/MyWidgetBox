# MyWidgetBox

A growing collection of small, single-purpose browser Widgets for live streaming (OBS Browser Source) and everyday use. Static site, deployed to <https://beards.github.io/MyWidgetBox/>.

Vocabulary (Widget, Settings, State, Outcome, ...) is defined in [GLOSSARY.md](GLOSSARY.md); architecture decisions live in [docs/adr/](docs/adr/).

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
