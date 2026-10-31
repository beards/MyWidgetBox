# 11: 轉盤「抽中後移除」與 State

**What to build:** 可開關「抽中後移除」：中獎選項從下一輪排除；已抽掉的選項為 State，重新整理後保留、不進 Share link，有重置鈕。全部抽完時 spin 不可用並提示重置。選項清單變更時調和 State。加入轉動時的「喀喀」音效。

**Blocked by:** 10, 09

**Status:** resolved

- [x] 開啟後抽中的選項不再被抽中且在畫面上標示
- [x] 重新整理後已抽掉的選項仍在；重置鈕恢復完整清單
- [x] 全部抽完時明確提示
- [x] 轉動時有隨扇區通過指針的「喀喀」聲（以自訂音效網址觀察到每次扇區通過都發出請求；實際聽感 needs manual verification）
- [x] 測試：抽中後移除與重置；全部抽完狀態；刪除選項後 State 調和；重建 controller 後 State 接續；Share link 不含 State

## Answer

- `WheelSettings` gains `removeAfterDraw` (default off) and `sound` (shared `SoundSettings`); both are Settings, so they live in Presets and Share links. Drawn entry ids are State under `mywidgetbox:wheel:state` (`{ version: 1, drawn: [...] }`): kept across reloads, never in Share links, reconciled with the Settings in effect (ids no longer in `entries` are dropped on every Settings change, incl. Preset switch / import).
- A draw is recorded when the view reports the spin finished (`finishAnimation`), so the wheel keeps the sector until it has landed. `state.remainingEntries` = entries minus drawn (while the toggle is on); `allDrawn` disables Spin and shows a notice (also in Display mode). `reset()` (button / R) now also clears the drawn entries. Turning the toggle off keeps the drawn State but ignores it.
- Decision: drawn sectors are **hidden** from the wheel and the spin uses only the remaining entries' geometry (wheel shown = what can be drawn, sector sizes = real odds). Drawn entries are marked in the editor (struck through, "drawn" instead of a chance); an empty wheel is a grey disc.
- Ticks: `sectorUnderPointer()` in `wheel/geometry.ts`; `scene.play(..., { onTick })` fires when the sector under the pointer changes between frames, and the view calls `sound.play('tick', state.sound)`. Verified with agent-browser (removal, reload, all-drawn notice, reset, tick requests via a custom sound URL).
