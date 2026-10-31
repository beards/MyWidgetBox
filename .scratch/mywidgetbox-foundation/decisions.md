# MyWidgetBox 共識摘要（grilling 結果，2026-10-31）

用語見 `GLOSSARY.md`；架構決定見 `docs/adr/`。

## 整體
- 目的：一系列供直播與日常使用的 **Widget**，隨時可增加。
- 硬性限制：Chrome 系列（含 OBS Browser Source）必須能用；Firefox / Safari / mobile 為盡量支援（最新版有測、明顯問題會修、做不到可降級）。
- 交付：靜態網站，GitHub Pages，push main 由 GitHub Actions 部署；公開 repo + MIT。
- 首頁 `/` 為簡單目錄；每個 Widget 一個網址（`/dice/`、`/wheel/`、`/timer/`）。
- 技術：預設 TypeScript + Vite 多頁、無 UI 框架、3D 用 three.js；每個 Widget 可自由選技術，共用模組 opt-in（ADR-0002）。
- 直播：同頁操作與顯示；**Display mode**（隱藏控制、可透明背景）透過 URL 參數開啟；不做控制端／顯示端分離（ADR-0001）。

## Outcome 與互動
- Outcome 以 `crypto.getRandomValues` 在動畫前決定，動畫只負責演出。
- 觸發：按鈕／點擊物件／`Space`；`R` 重置；動畫中重複觸發忽略。
- 動畫長度可調（約 1–10 秒）；預設遵守 `prefers-reduced-motion`，可覆寫為永遠完整動畫。
- 音效：三個 Widget 都有，預設開，可關可調音量。
- 結果歷史：骰子與轉盤顯示最近 20 筆，只在控制介面，不跨頁保存。

## 各 Widget
- **骰子**：預設 1d6；可設定 d4/d6/d8/d10/d12/d20/d100、多顆、混合種類、加減固定值（組合式 UI，非表達式輸入）；3D 動畫；顯示總和與明細；手機可選「搖手機擲骰」（預設關）。
- **轉盤**：自由文字選項、權重（扇區大小反映權重）、可開關「抽中後移除」；指針停在中獎扇區並放大彈出結果。
- **計時器**：倒數（時長 or 倒數到某時刻）+ 碼表；多組並排、各自控制，Display mode 可經 URL 只顯示其中一組；格式自動 `mm:ss`/`hh:mm:ss`，小數秒可選；時間到提示音數秒 + 畫面效果至停止或指定秒數；手機用 Wake Lock 保持螢幕亮。

## Settings / State / 儲存
- **Settings** 各 Widget 獨立（無全域主題）；支援多組具名 **Preset**。
- 外觀共同基準：背景（純色／透明／圖片網址）、主要物件顏色、字型與字級、整體縮放；各 Widget 可再擴充。
- 不支援上傳檔案；圖片／音效以網址填入。
- 儲存：`localStorage`，包一層薄介面；另提供 JSON 匯出／匯入（因應 Safari 7 天清除）。
- **Share link** 把 Settings（+ Display mode、語言）編進 URL；載入優先序：URL > `localStorage` > 預設。
- Settings 帶版本號，舊版逐步遷移，缺欄補預設、未知欄位忽略，舊 Share link 永遠可開。
- **State**（計時器進度、已抽掉的選項）重新整理後保留（以時間戳記錄），有重置鈕；不進 Share link。

## 語言
- 正體中文 + 英文，可擴充更多語言；文字集中管理。
- 預設依 `navigator.language`，可手動切換並記住，`?lang=` 可強制指定（給 OBS）。

## 品質
- 單元測試：Outcome 產生（分布、權重）、Settings 編解碼與遷移、載入優先序。
- 動畫與畫面靠手動檢查。
- CI：typecheck + lint + test 通過才部署。
