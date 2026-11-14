# 全站 Theme 與首頁改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 加入可切換的三套 theme（soft／dark／paper），把設定面板的控制元件和首頁改成有設計感的樣式，Widget 本體與 Display mode 維持原樣。

**Architecture:**
- `<html data-theme>` 由每頁 `<head>` 中的同步 inline script 在第一次繪製前設定。
- `shared/theme.css` 用 CSS custom properties 定義三套 token。控制元件樣式只引用 token，並限定在「控制範圍」內（`.layout__panel`、`[data-controls]`、首頁 `.catalog`）。
- `shared/theme.ts` 提供 theme 的讀寫與驗證（有測試）；`shared/theme-dom.ts` 提供切換選單（view-only，比照 `i18n-dom.ts`）。

**Tech Stack:** Vite、TypeScript、純 CSS、vitest，不新增任何 dependency。

**Spec:** `.scratch/site-themes/spec.md`

## Global Constraints

- Chromium（含 OBS Browser Source）必須正常運作。
- theme 存在 localStorage，key 為 `mywidgetbox:theme`，值只能是 `soft`、`dark`、`paper`；無效或缺值一律視為 `soft`。
- theme 不寫進 Settings、Preset 或 Share link。
- Display mode（`?display=1`，含 `&transparent=1`）的畫面和改版前逐像素一致。
- theme 樣式不得使用全域的 `button {}`、`input {}`、`select {}` 或 `body { font-family }`。Widget 本體（例如 `#die`、`#wheel`、`#result`、計時器數字）必須維持原樣。
- Widget 頁 stage 的底色由 Appearance 管，theme 不碰。
- 介面文字 en 與 zh-Hant 都要有；程式碼、註解和 commit 用英文。
- 拉桿旁的數值顯示和區塊順序維持不變。
- 觸控螢幕（`pointer: coarse`）的控制元件最小尺寸維持 2.75rem。
- 色值起點參考 spec：soft 強調色 `#2f7d6d`；dark 底色 `#121417`、強調色 `#f0a63a`；paper 底色 `#f6f1e7`、點綴色 `#b5482f`、標題用襯線字。

## Review Focus

1. **localStorage 無法使用**（隱私模式、OBS 的特殊設定）：inline script 不能拋錯中斷頁面，應退回 `soft`。由 Task 1 的 head script 以 try/catch 處理，並在 Task 1 的測試中驗證 head script 的白名單與 `THEMES` 一致。
2. **Display mode 被 theme 改到**：在 Task 0 拍改版前的基準截圖，Task 5 逐張比對。
3. **dark theme 下，原本寫死的深色文字看不清楚**：例如 `wheel__chance` 的 `#555`、面板的 `#222`。Task 2 要把這些改成 token，並在 Task 5 以 dark 截圖確認。
4. **自訂控制元件失去鍵盤焦點提示**：所有控制元件都要有 `:focus-visible` 外框，Task 2 驗收時用 Tab 走一遍。
5. **多個分頁同時開著時切換 theme**：其他分頁不需要即時同步（使用者沒有要求），重新整理後一致即可。不寫測試。

---

### Task 0: 拍改版前的基準截圖

**Files:** 無程式碼變更；截圖存到 scratchpad 的 `baseline/`

- [ ] **Step 1:** 從 `main` 開分支 `feat/site-themes`，執行 `npm run dev -- --host --port 5173`。
- [ ] **Step 2:** 用 agent-browser，在 1280×800 與 390×844 兩種尺寸，各拍下列畫面：
  - 三個 Widget 的 `?display=1`；
  - 三個 Widget 的 `?display=1&transparent=1`；
  - 三個 Widget 的一般模式；
  - 首頁。

  Display mode 的截圖之後要逐像素比對。骰子有物理動畫，等畫面靜止後再拍；轉盤和計時器在初始狀態拍。

### Task 1: theme 核心——讀寫、head script、切換選單

**Files:**
- Create: `shared/theme.ts`、`shared/theme.test.ts`、`shared/theme-dom.ts`
- Modify: `index.html`、`dice/index.html`、`wheel/index.html`、`timer/index.html`（`<head>` 的 inline script）

**Interfaces:**
- Produces:
  - `THEMES: readonly ['soft', 'dark', 'paper']`
  - `type Theme`
  - `THEME_STORAGE_KEY = 'mywidgetbox:theme'`
  - `readTheme(storage: KeyValueStorage): Theme`
  - `writeTheme(storage: KeyValueStorage, theme: Theme): void`
  - `mountThemeSwitcher<K extends string>(i18n: I18n<K>, storage: KeyValueStorage, container: HTMLElement): HTMLSelectElement`

- [ ] **Step 1: 寫失敗的測試** `shared/theme.test.ts`，使用 `createTestEnv()`（`shared/test-env.ts`）的 storage：
  - `readTheme` 在沒有值時回傳 `'soft'`；
  - 存了 `'paper'` 時回傳 `'paper'`；
  - 存了 `'neon'` 時回傳 `'soft'`；
  - `writeTheme(storage, 'dark')` 之後，`storage.getItem('mywidgetbox:theme')` 等於 `'dark'`；
  - **head script 一致性**：用 `node:fs` 讀四個 `index.html`，各自含有 `data-theme-boot` 的 `<script>`，且字串中包含 `THEMES` 的每個值和 `THEME_STORAGE_KEY`。
- [ ] **Step 2:** 執行 `./node_modules/.bin/vitest run shared/theme.test.ts`，預期 FAIL（模組不存在）。
- [ ] **Step 3:** 實作 `shared/theme.ts`，並在四個 `index.html` 的 `<head>` 最前面（stylesheet 之前）加上：
  ```html
  <script data-theme-boot>
    // Set the theme before first paint (shared/theme.ts owns the list and the key).
    try { var t = localStorage.getItem('mywidgetbox:theme'); } catch (e) {}
    document.documentElement.dataset.theme = ['soft', 'dark', 'paper'].indexOf(t) >= 0 ? t : 'soft';
  </script>
  ```
- [ ] **Step 4:** 再次執行測試，預期 PASS。
- [ ] **Step 5:** 實作 `shared/theme-dom.ts` 的 `mountThemeSwitcher`，比照 `mountLanguageSwitcher`：
  - 選項名稱與 aria-label 用模組內的 `Record<Locale, …>` 表：zh-Hant 為「柔和／深色／紙本」，aria「主題」；en 為「Soft／Dark／Paper」，aria「Theme」。
  - change 時呼叫 `writeTheme`，並設定 `document.documentElement.dataset.theme`。
  - 這個檔案依 i18n-dom 慣例，不寫測試。
- [ ] **Step 6:** 執行 `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint . && ./node_modules/.bin/vitest run`，全部通過後 commit：`feat(shared): theme storage, boot script and switcher`。

### Task 2: theme token 與控制元件樣式

**Files:**
- Create: `shared/theme.css`
- Modify: `shared/layout.css`（`--layout-panel-color`、`#222`、把手和語言列的配色改用 token）、四個 `index.html`（在 `layout.css` 之前 link `theme.css`；首頁直接 link）

**Interfaces:**
- Produces: token 名稱，供 Task 3、4 使用：
  - 顏色：`--theme-bg`（首頁頁面底色）、`--theme-surface`（面板／卡片）、`--theme-surface-2`（輸入框底色）、`--theme-border`、`--theme-text`、`--theme-muted`、`--theme-accent`、`--theme-accent-text`（強調色上的文字）
  - 形狀與字體：`--theme-radius`、`--theme-shadow`、`--theme-font`、`--theme-heading-font`
  - 主要按鈕 class：`.theme-primary`

- [ ] **Step 1:** 在 `shared/theme.css` 定義 `html[data-theme='soft' | 'dark' | 'paper']` 三組 token。值依 mockup `.superpowers/brainstorm/1745-1793543505/content/visual-style.html` 的 A／B／C。
- [ ] **Step 2:** 在控制範圍內寫元件樣式。控制範圍的 selector 為 `:is(.layout__panel, [data-controls], .catalog)`，涵蓋：
  - `button`，以及 `.theme-primary`；
  - `input`（text、url、number）；
  - `select`；
  - checkbox，使用 `appearance: none` 加自畫勾選；
  - range，包含 track 與 thumb 的 webkit pseudo-element；
  - color，包含 swatch 的 pseudo-element；
  - file 的 `::file-selector-button`；
  - `:focus-visible` 外框；
  - `:disabled` 的半透明樣式。

  另外，面板的 `h2` 改成小字、大寫、加字距的分段標題，上方加細線分隔。paper theme 的 `h2` 使用 `--theme-heading-font`。
- [ ] **Step 3:** 修改 `shared/layout.css`：
  - `--layout-panel-color` 改成引用 `var(--theme-surface)`；
  - 面板的 `color: #222` 改成 `var(--theme-text)`，字體改成 `var(--theme-font)`；
  - 把手和語言列沿用 panel color，把手的陰影改用 `--theme-shadow`。
- [ ] **Step 4:** 清除三個 Widget `style.css` 裡寫死、在 dark theme 下會看不清楚的顏色（例如 `wheel__chance` 的 `#555`），改用 `var(--theme-muted)`。只動控制範圍內的顏色，Widget 本體的顏色不動。
- [ ] **Step 5:** 用 agent-browser 在轉盤頁一般模式，分別以 soft／dark／paper 截圖。確認：
  - 沒有殘留的原生樣式；
  - 文字可讀；
  - 按 Tab 時看得到焦點外框。
- [ ] **Step 6:** 執行 typecheck、lint、test，全部通過後 commit：`style: theme tokens and themed controls`。

### Task 3: Widget 頁接上切換選單與主要按鈕

**Files:**
- Modify:
  - `dice/main.ts`、`wheel/main.ts`、`timer/main.ts`：在 `mountLanguageSwitcher` 之後呼叫 `mountThemeSwitcher(i18n, env.storage, …)`，掛在同一個 `#language` 容器；
  - `dice/index.html`：`#roll` 加上 `theme-primary`；
  - `wheel/index.html`：`#spin` 加上 `theme-primary`；
  - `timer/main.ts`：開始按鈕加上 `theme-primary`；
  - 共用的 `#share-copy`：在三頁的 HTML 中加上 `theme-primary`；
  - 三個 `style.css`：視需要調整。

**Interfaces:**
- Consumes: `mountThemeSwitcher`、`readTheme`（Task 1）；`.theme-primary` 與 token（Task 2）。

- [ ] **Step 1:** 掛上切換選單。語言列中，首頁連結在左，兩個選單在右並排。
- [ ] **Step 2:** 為主要按鈕加上 `theme-primary`。計時器卡片的開始／暫停按鈕依現有程式選定，只有「開始」這個動作用強調色。
- [ ] **Step 3:** 三頁 × 三套 theme × 兩種寬度截圖，確認：
  - 寬螢幕時，疊在 Appearance 背景上的「轉動」「重置」、計時器卡片按鈕都有不透明底色；
  - 窄螢幕的語言列放得下兩個選單。
- [ ] **Step 4:** 執行 typecheck、lint、test，全部通過後 commit：`feat: theme switcher and primary actions on Widget pages`。

### Task 4: 首頁改版

**Files:**
- Modify: `index.html`（新版面與樣式，類別前綴 `catalog__`）、`main.ts`（掛上 `mountThemeSwitcher`）、`messages.ts`
- Create: `public/icons/` 不需要。圖示直接 inline 在 `index.html` 的 SVG 裡，使用 `stroke="currentColor"`。

**Interfaces:**
- Consumes: Task 1、Task 2 的產出。
- Produces: 新的 message key，類型 `CatalogMessageKey` 需要擴充：`tagline`、`widget.dice.desc`、`widget.wheel.desc`、`widget.timer.desc`。

- [ ] **Step 1:** 新增 message 文案：

  | key | zh-Hant | en |
  |---|---|---|
  | `tagline` | 給直播和桌遊用的小工具，可直接放進 OBS。 | Small tools for streams and tabletop games, ready for OBS. |
  | `widget.dice.desc` | 擲骰、自訂骰組 | Roll dice, build dice sets |
  | `widget.wheel.desc` | 加權抽選轉盤 | Weighted spinning wheel |
  | `widget.timer.desc` | 倒數、碼錶、指定時間 | Countdown, stopwatch, target time |

- [ ] **Step 2:** 重寫首頁：
  - `<body class="catalog">`；
  - header 內放標題、tagline，右上角放 `#language`（語言與 theme 兩個選單）；
  - `<ul class="catalog__tiles">` 放三張卡片，各包一個 `<a>`，內容依序為 inline SVG 線條圖示（骰子、轉盤、計時器各一，24×24 viewBox、stroke 1.75，風格一致）、名稱、說明；
  - 卡片使用 `--theme-surface`、`--theme-radius`、`--theme-shadow`，hover 與 focus 時有輕微浮起效果；
  - 寬度 ≥ 40rem 時三欄，以下單欄；
  - 保留現有的 `pointer: coarse` 觸控尺寸規則。
- [ ] **Step 3:** 首頁三套 theme × 兩種寬度截圖檢查。
- [ ] **Step 4:** 執行 typecheck、lint、test、build，全部通過後 commit：`feat(catalog): tile homepage with themes`。

### Task 5: 全面驗收

- [ ] **Step 1:** 重拍 Task 0 的所有 Display mode 截圖，與基準逐像素比對。可用 `cmp`，或在 agent-browser 裡比對 base64。任何差異都要修正到一致。
- [ ] **Step 2:** 切換 theme 後重新整理，確認 theme 保持不變，也沒有閃爍：先錄一段載入過程，或在 head script 之後檢查第一次繪製的 `data-theme`。
- [ ] **Step 3:** 在 DevTools 中讓 localStorage 拋錯（覆寫 `Storage.prototype.getItem`），重新整理後頁面應正常，並套用 `soft`。
- [ ] **Step 4:** 執行 `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint . && ./node_modules/.bin/vitest run && npx vite build`，全部通過。
- [ ] **Step 5:** 把 `.superpowers/` 加進 `.gitignore`。commit 後交給使用者測試，流程依 direct-push 的慣例。
