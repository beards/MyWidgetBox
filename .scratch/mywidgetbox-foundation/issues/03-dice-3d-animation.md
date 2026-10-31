# 03: 3D 骰子動畫

**What to build:** 以 three.js 演出各種多面體的滾動，並停在 controller 事先決定的 Outcome 面上（不以物理模擬決定落點）。動畫長度可調（約 1–10 秒）。動畫中重複觸發被忽略。支援 `Space` 擲骰、`R` 重置、點擊骰子擲骰。預設遵守 `prefers-reduced-motion`（縮短為快速呈現），可覆寫為永遠完整動畫。

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] d4/d6/d8/d10/d12/d20/d100 皆有 3D 模型且停在正確的面（d100 可用兩顆 d10 或等效呈現）
- [ ] 多顆骰同時滾動不重疊到難以辨識
- [ ] controller 有「動畫中」狀態，畫面層演出完成後回報；動畫中觸發被忽略（有測試）
- [ ] `Space` / `R` / 點擊骰子可用
- [ ] reduced-motion 預設生效且可覆寫
- [ ] 在 OBS Browser Source 中流暢運作（手動驗證）
