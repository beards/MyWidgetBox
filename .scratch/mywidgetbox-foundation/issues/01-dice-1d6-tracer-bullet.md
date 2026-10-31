# 01: 骰子 1d6 tracer bullet（骨架到部署）

**What to build:** 建立專案骨架（Vite 多頁、TypeScript、Vitest、lint），根網址目錄頁與 `/dice/`。骰子的 headless controller 接受注入 env（亂數來源、時鐘、儲存、URL），在動畫前決定 1d6 的 Outcome；畫面層以最簡 2D 顯示結果。CI 在 push main 時跑 typecheck + lint + test，通過才部署到 GitHub Pages。這張建立整個 repo 後續沿用的 controller + env 接縫模式。

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] `git init` 並建立公開 GitHub repo、MIT 授權（建立公開 repo 前先向使用者確認）
- [x] 根網址目錄頁列出骰子並可點進 `/dice/`
- [x] 按鈕或點擊骰子產生 1d6 Outcome 並顯示
- [x] controller 的 Outcome 由 env 的亂數來源決定，正式環境用 `crypto.getRandomValues` 並避免取模偏差
- [x] 測試：注入固定亂數序列得到預期 Outcome；統計檢定 1–6 分布均勻
- [ ] GitHub Actions：typecheck、lint、test 全過才部署；部署後網址可在 Chrome 打開（workflow added; needs manual verification after first push to main）
- [x] README 說明如何本機開發、測試、新增 Widget

## Answer

Scaffolded a Vite multi-page TypeScript project (Vitest, ESLint flat config, `base: /MyWidgetBox/`, `appType: mpa`): root catalog `index.html` plus one directory per Widget (`dice/`), registered in the `widgets` list in `vite.config.ts`.
Opt-in shared modules live in `shared/`: `env.ts` (Env interface: `randomUint32`, `now`, `storage`, `url`; production `createBrowserEnv()`), `test-env.ts` (deterministic Env), `random.ts` (`randomBelow`, rejection sampling).
`dice/controller.ts` is the headless controller (`getState`/`subscribe`/`roll`) deciding the 1d6 Outcome from the injected random source; `dice/main.ts` is a minimal 2D view (click the die or the Roll button).
Tests cover fixed-sequence Outcomes, modulo-bias rejection, subscribe/unsubscribe, and a chi-square uniformity check with `crypto.getRandomValues`. Catalog → `/dice/` → roll was smoke-tested in Chrome via `vite preview`.
`.github/workflows/deploy.yml` runs typecheck + lint + test + build on push to main, then deploys with `upload-pages-artifact` + `deploy-pages`. README documents dev/test and the "add a Widget" steps.
