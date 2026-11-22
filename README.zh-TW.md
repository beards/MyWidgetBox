# MyWidgetBox

[English](README.md) | 正體中文

持續增加中的小型瀏覽器 Widget 合集，每個只做一件事，適合直播（OBS Browser Source）和日常使用。

術語（Widget、Settings、State、Outcome 等）定義在 [GLOSSARY.md](GLOSSARY.md)；架構決策記錄在 [docs/adr/](docs/adr/)。

## 瀏覽器支援

- **完整支援：** 最新版 Chrome / Edge（Chromium）及 OBS Browser Source（Chromium 核心）。所有功能都必須能在這些環境運作。
- **盡力支援：** 最新版 Firefox、Safari、iOS Safari 及 Android Chrome。主要流程（擲骰、轉輪盤、啟動計時器、Settings 與 Preset、Share link、Display mode）都能運作；下表列出的功能可能降級。

在觸控螢幕上，控制項會放大到適合手指操作的尺寸，窄版面會重新排列；桌面和 OBS 維持精簡版面。

在寬度至少 900px（`min-width: 56.25em`）的螢幕上，Widget 的顯示區在左，控制項在右側可單獨捲動的欄位裡，任何變更都會立即呈現；較窄的螢幕（手機、直立的平板）則把控制項放在顯示區下方。Display mode 只在頁面上保留顯示區。

| 功能 | 在哪裡降級 | 會發生什麼 |
| --- | --- | --- |
| Screen Wake Lock（計時器執行時保持螢幕常亮） | 不支援此 API 的瀏覽器（較舊的 Safari < 16.4、Firefox < 126）、低電量模式、分頁在背景 | 直接略過，不會提示；螢幕可能會關閉，但計時器會繼續計時。 |
| 搖晃擲骰（骰子，`DeviceMotionEvent`） | 桌面瀏覽器沒有動作感測器；iOS Safari 需要取得權限 | 選項下方會說明裝置不支援或權限被拒。iOS 只能在點擊時請求權限：開啟選項時會立即請求；如果載入頁面時選項已經開著，會在第一次點擊時請求。 |
| 音效（Web Audio 內建音效、自訂音效網址） | 使用者與頁面互動前，瀏覽器會封鎖音訊 | 沒人點過的頁面（例如在沒操作過的分頁裡響起的計時器提示）可能不會發出聲音；點一下或按任一個鍵就能解除。OBS Browser Source 不需要互動就能播放音訊。自訂網址載入失敗時會改用內建音效。 |
| 3D 骰子（透過 three.js 使用 WebGL） | 無法使用 WebGL（GPU 停用、被政策封鎖、非常舊的裝置） | 骰子改用標示點數的平面色塊擲出；Outcome、歷史紀錄和時間都不受影響。 |
| 外觀縮放（CSS `zoom`） | Firefox < 126 | 縮放設定沒有作用。 |
| 複製 Share link（Clipboard API） | 非安全來源、權限被拒 | 顯示「請複製下方連結」，並選取連結文字讓你手動複製。 |

## 本機開發

需要 Node 26 和 npm。

```sh
npm install
npm run dev        # 開發伺服器：http://localhost:5173/（目錄頁）、.../dice/ 等
npm test           # 執行一次測試（npm run test:watch 可持續監看）
npm run typecheck
npm run lint
npm run build      # 正式版建置到 dist/（相對 base：放在任何路徑都能運作）
npm run preview    # 在本機預覽正式版建置
```

## 部署

每次 push 到 `main` 都會執行 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)：typecheck、lint、測試和建置全部通過後，網站才會部署到 GitHub Pages。

## 專案結構

```
index.html          網站根目錄的目錄頁
vite.config.ts      多頁面建置：每個 Widget 一個進入點
shared/             任何 Widget 都可以選用的共用模組
  env.ts            Env 介面 + 正式環境的 Env（crypto、Date.now、localStorage、location）
  test-env.ts       測試用、結果固定的 Env（固定的隨機序列、手動時鐘、記憶體儲存）
  random.ts         無偏差的隨機整數（拒絕取樣）
  i18n.ts           介面文字：訊息表、語言判定（?lang= > 已儲存的選擇 > 瀏覽器）
  i18n-dom.ts       綁定 data-i18n 屬性並掛載語言切換器
  share-link.ts     Share link 編碼／解碼（?s=、display、transparent、lang）
  display-mode.ts   Display mode：隱藏 [data-controls] 元素
  scoped-state.ts   依 Preset 分開存放的 State，共用一個儲存 key（轉盤抽過的項目、計時器進度）
  appearance.ts     外觀 Settings 的共用基礎（背景 純色／透明／圖片、字型；需要的 Widget 再加文字大小與顏色、縮放）；各 Widget 可擴充
  appearance-dom.ts 把外觀套用到頁面，並掛載外觀面板
  layout.css        寬螢幕的並排版面（顯示區在左、控制項在右）
dice/               每個 Widget 一個目錄，網址為 /<name>/
  index.html        頁面進入點
  main.ts           View 層：DOM、動畫、音效
  controller.ts     Headless controller：純邏輯，不碰 DOM
  controller.test.ts
```

### Controller + Env 模式

每個 Widget 分成兩層：

- **Headless controller**（`controller.ts`）：保存 Settings、State 和 Outcome，提供動作（例如 `roll()`）以及 `getState()`／`subscribe()`。它從不直接使用瀏覽器的全域物件；所有來自外部的東西（隨機來源、時鐘、儲存空間、URL）都由傳進 factory 的 `Env` 提供。
- **View 層**（`main.ts`）：用 `createBrowserEnv()` 建立 controller，每次狀態變更時重新繪製，並在使用者操作時呼叫對應的動作。

測試只測 controller：注入 `createTestEnv()`，再檢查公開的 state。隨機的 Outcome 一律在動畫開始前就由 controller 決定好；view 只負責呈現。

依照 [ADR-0002](docs/adr/0002-widgets-are-technologically-independent.md)，各 Widget 在技術上彼此獨立：`shared/` 底下的東西都是選用的，Widget 只要放在自己的目錄裡，也可以用不同的技術。

## 新增 Widget

1. 建立以 Widget 網址命名的目錄，例如 `/wheel/` 就是 `wheel/`，裡面放 `index.html`、`main.ts`、`controller.ts` 和 `controller.test.ts`（可以複製 `dice/` 當範本）。
2. 先寫測試，針對 `createTestEnv()` 實作 controller；DOM 相關程式碼放在 `main.ts`。
3. 把目錄名稱加到 `vite.config.ts` 的 `widgets` 清單。
4. 在根目錄 `index.html` 的目錄頁加上連結。

其他 Widget 都不需要修改。

## 授權

[MIT No Attribution (MIT-0)](LICENSE)
