# 03: 3D 骰子動畫

**What to build:** 以 three.js 演出各種多面體的滾動，並停在 controller 事先決定的 Outcome 面上（不以物理模擬決定落點）。動畫長度可調（約 1–10 秒）。動畫中重複觸發被忽略。支援 `Space` 擲骰、`R` 重置、點擊骰子擲骰。預設遵守 `prefers-reduced-motion`（縮短為快速呈現），可覆寫為永遠完整動畫。

**Blocked by:** 02

**Status:** resolved

- [x] d4/d6/d8/d10/d12/d20/d100 皆有 3D 模型且停在正確的面（d100 可用兩顆 d10 或等效呈現）
- [x] 多顆骰同時滾動不重疊到難以辨識
- [x] controller 有「動畫中」狀態，畫面層演出完成後回報；動畫中觸發被忽略（有測試）
- [x] `Space` / `R` / 點擊骰子可用
- [x] reduced-motion 預設生效且可覆寫
- [ ] 在 OBS Browser Source 中流暢運作（手動驗證） — needs manual verification in OBS

## Answer

- Controller (`dice/controller.ts`) gained an `animating` State: `roll()` decides the Outcome and starts animating, `finishAnimation()` is called by the view when the dice land; `roll()`/`reset()` are ignored meanwhile. `reset()` clears Outcome and history. Animation length (1–10 s, default 3 s) and the always-full-animation override are stored in `DiceSettings.animation`, so they persist per Preset and travel in Share links (old links fall back to the defaults); `animationFor(state, prefersReducedMotion)` picks the full or the 300 ms reduced-motion reveal.
- `dice/geometry.ts` (pure three.js math, unit-tested): polyhedra for d4/d6/d8/d10(pentagonal trapezohedron)/d12/d20 with labelled faces (opposite faces pair like real dice), d100 = tens d10 (00–90) + units d10, and `landingQuaternion()` that turns any face to the viewer, upright.
- `dice/scene.ts` (three.js view, no controller knowledge): grid layout sized to the stage so many dice never overlap at rest; each die tumbles with decaying spin onto its predetermined face. `main.ts` wires it up: `Space` rolls and `R` resets (one document-level listener), clicking the dice rolls; the breakdown and newest history entry are hidden until the dice land.
- Verified in a browser (agent-browser screenshots): all seven kinds and 25 dice at once land on the faces matching the breakdown; reduced motion shortens the animation and the override restores it. OBS smoothness still needs manual verification.
