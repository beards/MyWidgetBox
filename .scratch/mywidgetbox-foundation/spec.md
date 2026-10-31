Status: ready-for-agent

# Spec：MyWidgetBox 基礎建設與首批 Widget（骰子、轉盤、計時器）

用語依 `GLOSSARY.md`（Widget、Display mode、Settings、Preset、State、Share link、Outcome）。架構約束見 `docs/adr/0001-no-remote-control.md`、`docs/adr/0002-widgets-are-technologically-independent.md`。決策來源：`.scratch/mywidgetbox-foundation/decisions.md`。

## Problem Statement

直播主（以及日常使用者）常需要一些小型互動工具：擲骰決定事情、轉盤抽人或抽選項、倒數開台或計時活動。現有的線上工具通常有廣告、不能客製外觀、不能乾淨地疊進 OBS 直播畫面、每次打開都要重新設定，而且散落在各處網站。使用者想要一個自己的、可持續增加的 Widget 集合：只要有 Chrome 系列瀏覽器就能用、能放進 OBS、外觀可調、設定會被記住。

## Solution

一個公開部署在 GitHub Pages 的靜態網站 MyWidgetBox。根網址是 Widget 目錄，每個 Widget 有自己的網址。首批提供三個 Widget：

- **骰子**：3D 擲骰動畫，預設 1d6，可組合 d4/d6/d8/d10/d12/d20/d100、多顆、混合種類與加減固定值。
- **轉盤**：自訂文字選項與權重，扇區大小反映權重，可開關「抽中後移除」。
- **計時器**：倒數（時長或倒數到某時刻）與碼表，多組並排。

每個 Widget 都可以客製外觀（背景、物件顏色、字型、縮放）、存多組 Preset、自動記住 Settings、透過 Share link 把同一套設定帶進 OBS，並可用 Display mode 隱藏控制介面、使用透明背景疊在直播畫面上。介面提供正體中文與英文。Outcome 一律在動畫前以密碼學亂數決定，動畫只負責演出。

## User Stories

### 目錄與通用

1. As a 使用者, I want 在根網址看到所有 Widget 的目錄, so that 我能快速找到並打開需要的 Widget
2. As a 使用者, I want 每個 Widget 有固定、好記的網址, so that 我能加書籤或直接分享
3. As a 使用者, I want 只用 Chrome 系列瀏覽器、不安裝任何東西就能使用所有 Widget, so that 在任何電腦上都能立刻使用
4. As a 使用者, I want Widget 在最新版 Firefox 與 Safari 上也能正常使用, so that 我不被綁在單一瀏覽器
5. As a 手機使用者, I want Widget 在手機上排版合適且可觸控操作, so that 我能在手機上擲骰、轉盤或計時
6. As a 開發者（repo 擁有者）, I want 新增一個 Widget 不需要修改其他 Widget, so that 我能隨時想到就加
7. As a 開發者, I want 每個 Widget 可以自由選用最適合的技術, so that 不會被一開始的技術選擇綁住

### 直播（OBS）

8. As a 直播主, I want 把 Widget 的網址加到 OBS Browser Source 就能顯示, so that 觀眾能看到擲骰、轉盤或計時
9. As a 直播主, I want 透過 URL 參數開啟 Display mode 隱藏所有控制介面, so that 直播畫面上只有 Widget 本身
10. As a 直播主, I want Display mode 可選透明背景, so that Widget 能疊在遊戲畫面上
11. As a 直播主, I want 在 OBS 的 Interact 視窗中仍能用點擊或鍵盤觸發, so that 我不用離開 OBS 就能操作
12. As a 直播主, I want 用 `Space` 觸發擲骰／轉動、用 `R` 重置, so that 操作快速
13. As a 直播主, I want 動畫進行中重複觸發會被忽略, so that 誤按不會中斷或重來
14. As a 直播主, I want 在一般 Chrome 調好設定後一鍵複製 Share link, so that 貼進 OBS 就是同一套設定（OBS 讀不到 Chrome 的儲存）
15. As a 直播主, I want Share link 可同時帶 Display mode 與語言, so that 一條網址就完成 OBS 設定
16. As a 直播主, I want 幾個月前貼進 OBS 的 Share link 在網站更新後仍能打開, so that 直播不會突然壞掉
17. As a 直播主, I want 整體縮放可調, so that Widget 在 OBS 畫面中大小剛好

### 外觀客製化

18. As a 使用者, I want 設定背景為純色、透明或圖片網址, so that 符合我的直播或個人風格
19. As a 使用者, I want 設定主要物件的顏色（骰子本體與點數、轉盤扇區、計時器數字）, so that 配色一致
20. As a 使用者, I want 設定文字字型與字級, so that 易讀且符合風格
21. As a 使用者, I want 各 Widget 的外觀互不影響, so that 骰子與計時器可用不同配色
22. As a 使用者, I want 以網址指定圖片與音效, so that 能用自己的素材且 Share link 仍能完整帶到 OBS

### Settings、Preset、State

23. As a 使用者, I want 我的 Settings 自動被記住（同一個瀏覽器 profile）, so that 下次打開不用重新設定
24. As a 使用者, I want 為一個 Widget 存多組具名 Preset 並切換, so that 例如轉盤能在「今晚吃什麼」與「抽觀眾」間切換
25. As a 使用者, I want 新增、重新命名、刪除 Preset, so that 能管理我的設定
26. As a 使用者, I want 匯出 Settings（含所有 Preset）為 JSON 檔並能匯入, so that Safari 清除網站資料時能還原，或搬到另一台電腦
27. As a 使用者, I want 打開 Share link 時以連結中的 Settings 為準, so that 看到的就是分享者的設定
28. As a 使用者, I want 打開 Share link 不會悄悄覆蓋我原本存的 Settings（除非我選擇保存）, so that 不會弄丟自己的設定
29. As a 使用者, I want 重新整理頁面後計時器與「已抽掉的選項」能接續, so that 不小心重整或 OBS 重載來源也不會失去進度
30. As a 使用者, I want 一個重置按鈕清除 State, so that 能重新開始
31. As a 使用者, I want 損壞或看不懂的已存資料不會讓頁面壞掉, so that 最差情況也能以預設值開啟

### 語言

32. As a 使用者, I want 介面預設依瀏覽器語言顯示正體中文或英文, so that 開箱即可讀
33. As a 使用者, I want 手動切換語言並被記住, so that 不受瀏覽器設定影響
34. As a 直播主, I want 以 `?lang=` 強制指定語言, so that OBS 中的語言與我預期一致

### 動畫、音效、無障礙

35. As a 使用者, I want 調整動畫長度（約 1–10 秒）, so that 配合節奏
36. As a 使用者, I want 每個 Widget 都有音效，可關閉與調音量, so that 直播時能控制聲音
37. As a 有動暈困擾的使用者, I want 系統開啟「減少動態效果」時 Widget 自動縮短動畫, so that 不會不舒服
38. As a 直播主, I want 能覆寫為「永遠完整動畫」, so that 不論系統設定都有完整演出

### 骰子

39. As a 使用者, I want 打開骰子時預設就是 1d6, so that 最常見的情況零設定
40. As a TRPG 玩家, I want 加入 d4、d6、d8、d10、d12、d20、d100, so that 能擲任何常見骰子
41. As a TRPG 玩家, I want 一次擲多顆並混合種類（例如 1d20 + 2d6）, so that 一次完成檢定
42. As a TRPG 玩家, I want 加減固定修正值（例如 +5）, so that 結果直接包含加值
43. As a 使用者, I want 以組合式介面（加入 N 顆某種骰、設定修正值）建立骰組, so that 不需要記表達式語法
44. As a 使用者, I want 看到 3D 骰子滾動並停在對應的面, so that 擲骰有臨場感
45. As a 使用者, I want 看到總和與明細（例如 `17 = 12 + 3 + 2`）, so that 結果一目了然
46. As a 使用者, I want 點擊骰子本身也能擲骰, so that 操作直覺
47. As a 使用者, I want 在控制介面看到最近 20 次 Outcome, so that 能回顧剛才的結果
48. As a 手機使用者, I want 可選擇開啟「搖手機擲骰」, so that 像真的擲骰一樣
49. As a 使用者, I want 結果真正隨機且公平, so that 大家信任結果

### 轉盤

50. As a 使用者, I want 自由輸入文字選項清單, so that 轉盤可用於任何主題
51. As a 使用者, I want 為選項設定權重, so that 某些選項更容易被抽中
52. As a 觀眾, I want 扇區大小反映權重, so that 機率是透明的
53. As a 直播主, I want 開啟「抽中後移除」, so that 能不重複地輪流抽人或抽獎
54. As a 直播主, I want 重置已抽掉的選項, so that 新一輪能從完整清單開始
55. As a 使用者, I want 指針停在中獎扇區且中獎選項放大彈出, so that 結果醒目
56. As a 使用者, I want 結果彈出在數秒後或點擊後消失, so that 能繼續下一次
57. As a 使用者, I want 轉動時有「喀喀」聲, so that 有緊張感
58. As a 使用者, I want 每個扇區顏色可自訂, so that 符合配色
59. As a 使用者, I want 在控制介面看到最近 20 次 Outcome, so that 能回顧抽過什麼
60. As a 使用者, I want 所有選項都被抽完時有明確提示, so that 我知道要重置

### 計時器

61. As a 直播主, I want 設定一段時長倒數（例如 5 分鐘）, so that 計時活動
62. As a 直播主, I want 倒數到某個時刻（例如 21:00）, so that 顯示開台倒數
63. As a 使用者, I want 碼表（往上計時）, so that 記錄經過時間
64. As a 使用者, I want 在同一頁並排多組計時器且各自啟動、暫停、重置, so that 同時追蹤多件事
65. As a 直播主, I want 以 URL 指定 Display mode 只顯示其中一組, so that 不同計時器能放在 OBS 不同位置
66. As a 使用者, I want 不到一小時顯示 `mm:ss`、超過顯示 `hh:mm:ss`, so that 格式恰當
67. As a 使用者, I want 可選顯示小數秒, so that 需要精確時能看到
68. As a 使用者, I want 時間到有提示音（數秒後停止）, so that 不會錯過
69. As a 使用者, I want 時間到有畫面效果，持續到我按停止或指定秒數後, so that 觀眾也看得到
70. As a 使用者, I want 計時在分頁背景或重新整理後仍然準確, so that 不會因節流或重載而漂移
71. As a 手機使用者, I want 計時器執行時螢幕保持亮著, so that 隨時看得到剩餘時間
72. As a 使用者, I want 為每組計時器命名, so that 分辨用途

## Implementation Decisions

### 架構
- 靜態網站，Vite 多頁建置；每個 Widget 是獨立 entry 與網址（`/dice/`、`/wheel/`、`/timer/`），根網址為目錄頁。
- 預設技術：TypeScript、無 UI 框架、骰子 3D 用 three.js。依 ADR-0002，這只是預設；任何 Widget 可改用其他技術，共用模組為 opt-in。
- 部署：GitHub Pages（公開 repo、MIT 授權），push 到 main 時以 GitHub Actions 執行 typecheck、lint、test，全部通過才部署。
- 依 ADR-0001，不做控制端／顯示端分離；同一頁操作並顯示。

### Widget 兩層結構（測試接縫）
- 每個 Widget 拆為 **headless controller** 與 **畫面層**。
  - controller：純邏輯、無 DOM 依賴；持有 Settings、State、Outcome；暴露動作（例如 roll、spin、start/pause/reset、選擇／新增／刪除 Preset、更新 Settings、產生 Share link、匯出／匯入）與可訂閱的對外狀態。
  - 畫面層：DOM、three.js、動畫、音效；只訂閱 controller 狀態並呼叫動作。
- controller 建立時注入 **env**：亂數來源、時鐘（現在時間）、儲存（key-value）、目前 URL。正式環境分別為 `crypto.getRandomValues`、`Date.now`、`localStorage`、`location`。
- 換技術的 Widget 只需提供同形狀的 controller 介面。

### Outcome
- 由 controller 在動畫前以注入的亂數來源決定（正式環境為 `crypto.getRandomValues`，以 rejection sampling 避免取模偏差）。
- 畫面層收到 Outcome 後演出動畫並停在該結果；3D 骰子需能「演」到指定面，不以物理模擬決定落點。
- 動畫進行中的觸發被忽略（controller 有「動畫中」狀態，由畫面層在演出結束時回報完成）。

### Settings 與儲存（共用模組，opt-in）
- Settings 為各 Widget 獨立的可序列化物件，帶 **schema 版本號**；每個 Widget 定義預設值與逐版遷移函式。
- 載入流程：URL 中的 Share link Settings > 儲存中的 Settings > 預設值；任何一層解析或驗證失敗即落到下一層，絕不讓頁面壞掉。遷移時缺欄補預設、未知欄位忽略。
- 由 Share link 開啟時，Settings 先只在記憶體生效；使用者明確選擇才寫入儲存。
- 儲存以每個 Widget 一個命名空間，內容為所有 Preset 與目前選中的 Preset；透過薄的儲存介面存取，Widget 不直接呼叫 `localStorage`。
- 匯出／匯入：單一 Widget 的全部 Preset 以 JSON 檔匯出入；匯入走同一套驗證與遷移。
- Share link：把目前 Preset 的 Settings 編碼進 URL（URL-safe 的壓縮或 base64 編碼），可附 Display mode、語言、（計時器）指定顯示哪一組的參數。
- 不支援上傳檔案；圖片與音效以網址填入。

### 外觀共同基準
- 背景（純色／透明／圖片網址）、主要物件顏色、字型與字級、整體縮放、動畫長度、音效開關與音量、reduced-motion 覆寫。各 Widget 可擴充。

### State
- 與 Settings 分開存放，重新整理後保留，不進 Share link。
- 計時器以「開始時間戳 + 已累積時間 + 是否執行中」表示，顯示值由時鐘即時計算（不依賴 interval 累加，避免背景分頁節流造成漂移）。
- 轉盤記錄已抽掉的選項；Settings 的選項清單改變時需調和（已不存在的選項自 State 移除）。
- 結果歷史（最近 20 筆）只存在記憶體，不保存。

### 各 Widget 細節
- **骰子** Settings：骰組（每種骰面數與顆數的清單）、修正值、外觀、可選「搖手機擲骰」（預設關，需要時向 iOS 請求 `DeviceMotion` 權限）。Outcome：每顆骰的點數、修正值、總和。預設骰組為 1d6。
- **轉盤** Settings：選項清單（文字、權重、顏色）、「抽中後移除」開關、外觀。Outcome：中獎選項與其最終指針角度。權重為正數，扇區角度與權重成正比；只對未被抽掉的選項抽籤；可抽選項為空時 spin 不可用並給出提示。
- **計時器** Settings：計時器清單（名稱、模式：倒數時長／倒數到時刻／碼表、時長或目標時刻）、小數秒開關、時間到提示音長度、畫面效果持續秒數、外觀。手機執行中使用 Wake Lock（不支援則略過）。

### 語言（i18n）
- 所有介面文字集中於訊息表，以 key 取用；首批提供 `zh-Hant` 與 `en`，新增語言只需加一份訊息表。
- 決定順序：`?lang=` > 使用者手動選擇（已存） > `navigator.language`（中文系 → `zh-Hant`，其他 → `en`）。

### 跨瀏覽器
- Chrome 系列（含 OBS Browser Source）為硬性支援；Firefox、Safari、mobile 為盡量支援，功能不可用時降級（例如 Wake Lock、DeviceMotion），不擋上線。

## Testing Decisions

- **好的測試只測對外行為**：透過 controller 的公開動作與對外狀態驗證，不檢查內部資料結構、私有函式或儲存的確切格式（Share link 的往返除外：產生後再載入應得到相同 Settings）。
- **唯一接縫：每個 Widget 的 headless controller**。測試建立 controller、注入可控 env（固定序列的亂數、可手動推進的時鐘、記憶體儲存、指定 URL），送出動作並斷言對外狀態與 Outcome。
- 共用的 Settings 流程（載入優先序、遷移、Share link 編解碼、匯出入、損壞資料容錯）透過同一個接縫測試，例如「env 帶舊版 Share link → controller 的 Settings 已遷移為新版」、「儲存中為損壞 JSON → 以預設值開啟」。
- 測試涵蓋：
  - 骰子：給定亂數序列得到預期點數與總和；修正值；各面數的分布均勻（以大量抽樣做統計檢定，使用正式亂數來源）；動畫中重複觸發被忽略。
  - 轉盤：權重影響機率（統計檢定）；抽中後移除與重置；選項全部抽完的狀態；Settings 選項變動時 State 的調和。
  - 計時器：倒數時長、倒數到時刻、碼表在時鐘推進下的顯示值；暫停／繼續；重新建立 controller（模擬重新整理）後接續；時間到狀態。
  - 通用：Preset 新增／切換／刪除；URL > 儲存 > 預設；Share link 開啟不覆寫儲存；語言決定順序。
- 動畫、three.js 畫面、音效、排版：手動檢查，不做截圖比對。
- Prior art：repo 目前無既有測試，此 spec 建立第一批，後續 Widget 沿用同一接縫模式。測試框架預設 Vitest（與 Vite 一致）。

## Out of Scope

- 控制端與顯示端分離、遠端遙控、任何需要伺服器或中繼的功能（ADR-0001）。
- 帳號、雲端同步、跨瀏覽器 profile 共享 Settings（匯出／匯入 JSON 為唯一搬移方式）。
- 上傳圖片或音效檔（僅支援網址）。
- 全域主題（跨 Widget 共用外觀）。
- 骰子的表達式輸入（例如輸入 `2d6+3` 字串）。
- 結果歷史的持久化。
- 截圖比對、端對端自動化測試。
- 離線 PWA、`file://` 開啟。
- 正體中文與英文以外的語言（架構保留擴充空間）。

## Further Notes

- Safari 的 ITP 會在「有使用 Safari 但 7 天未造訪該網站」後清除 script 可寫入的儲存；匯出／匯入與 Share link 是對使用者的備份手段，介面上可適度提示。
- OBS Browser Source 有獨立的儲存，與使用者的 Chrome 不互通；Share link 是把設定帶進 OBS 的主要方式，介面應讓「複製 Share link（含 Display mode）」容易找到。
- 首批三個 Widget 可依序實作；共用模組（Settings 流程、i18n、外觀基準）應在第一個 Widget 中長出來，再由後續 Widget 選用。
