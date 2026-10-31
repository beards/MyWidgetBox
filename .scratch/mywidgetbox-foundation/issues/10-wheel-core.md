# 10: 轉盤核心

Status: resolved
Blocked by: 05, 06, 07

**What to build:** 新增 `/wheel/`。使用者自由輸入文字選項並設定權重與顏色，扇區大小與權重成正比。controller 在動畫前以權重決定 Outcome，轉動動畫讓指針停在中獎扇區，中獎選項放大彈出（數秒或點擊後消失），控制介面顯示最近 20 筆。沿用 Settings / Preset / Share link / Display mode / 外觀 / i18n。

- [x] 選項清單可新增／編輯／刪除，權重為正數，各扇區顏色可自訂
- [x] 扇區角度與權重成正比
- [x] 轉動停在 Outcome 扇區並彈出結果；`Space` / 點擊觸發，動畫中重複觸發被忽略
- [x] 目錄頁列出轉盤
- [x] 測試：固定亂數下 Outcome 正確；權重影響機率（統計檢定）；Settings / Share link 往返

## Answer

Built `/wheel/` (registered in `vite.config.ts` and the catalog page). `wheel/controller.ts` is the headless controller: entries `{ id, label, weight, color }` in `WheelSettings` (with appearance + animation), weighted Outcome `{ entryId, label, color, angle }` decided before the animation (pointer angle inside the inner 80% of the winning sector), `sectorsFor()` for proportional sectors, spin/finishAnimation lock, 20-entry in-memory history.
The view renders the wheel as SVG (`wheel/scene.ts`, rAF quartic ease-out; `wheel/geometry.ts` `landingRotation()` makes the Outcome stop under the top pointer); the result pops up for 4 s or until clicked. Space / click on the wheel spins, R resets history.
Reuses Settings/Presets, Share link, Display mode, appearance (+ `labelColor`, `pointerColor`), i18n and export/import exactly like dice. Tests cover fixed-random Outcomes, proportional sectors, entry editing/validation, animation lock, chi-square weight test, Settings/Preset/Share link/export round trips.
Verified in agent-browser: weighted wheel (5/1/2/1 and 1/1/6/2) lands on the Outcome sector with the pop-up; Display mode + Space works; catalog lists the wheel.
