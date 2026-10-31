# 10: 轉盤核心

**What to build:** 新增 `/wheel/`。使用者自由輸入文字選項並設定權重與顏色，扇區大小與權重成正比。controller 在動畫前以權重決定 Outcome，轉動動畫讓指針停在中獎扇區，中獎選項放大彈出（數秒或點擊後消失），控制介面顯示最近 20 筆。沿用 Settings / Preset / Share link / Display mode / 外觀 / i18n。

**Blocked by:** 05, 06, 07

**Status:** ready-for-agent

- [ ] 選項清單可新增／編輯／刪除，權重為正數，各扇區顏色可自訂
- [ ] 扇區角度與權重成正比
- [ ] 轉動停在 Outcome 扇區並彈出結果；`Space` / 點擊觸發，動畫中重複觸發被忽略
- [ ] 目錄頁列出轉盤
- [ ] 測試：固定亂數下 Outcome 正確；權重影響機率（統計檢定）；Settings / Share link 往返
