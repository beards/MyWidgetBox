# 12: 計時器核心

**What to build:** 新增 `/timer/`，單組計時器，模式為倒數時長或碼表。State 以開始時間戳 + 已累積時間 + 是否執行中表示，顯示值由時鐘即時計算，重新整理後接續、背景分頁不漂移。格式不到一小時 `mm:ss`、超過 `hh:mm:ss`。開始／暫停／重置。沿用 Settings / Preset / Share link / Display mode / 外觀 / i18n。

**Blocked by:** 05, 06, 07

**Status:** resolved

- [x] 倒數時長與碼表皆可用，可開始／暫停／繼續／重置
- [x] 重新整理後繼續正確的時間
- [x] 格式自動切換
- [x] 目錄頁列出計時器
- [x] 測試：時鐘推進下的顯示值；暫停／繼續；重建 controller 後接續；倒數到 0 進入時間到狀態

## Answer

Added `/timer/` (registered in `vite.config.ts` and the catalog page). Settings are `{ timers: TimerConfig[], appearance }` with one `{ id, name, mode: 'countdown' | 'stopwatch', duration }` entry today, so ticket 13 only adds list actions; they reuse Presets, Share link, Display mode, appearance (default 96 px text), export/import and i18n like the dice.
State lives apart from Settings under `mywidgetbox:timer:state` as `{ [timerId]: { startedAt, elapsed } }`; `readTimer(timer, env.now())` computes value and status (`idle` / `running` / `paused` / `timeUp`) from the clock, and the view re-reads it every animation frame, so reloads and background tabs never drift.
`formatTimer` gives `mm:ss` / `hh:mm:ss` (countdown rounds up, stopwatch down). Changing mode or duration resets that timer; time up ignores start/pause until reset. The time-up alert is left to ticket 14.
Verified with 25 controller tests (plus mutation checks) and agent-browser: start/pause/resume/reset, reload while running and paused, countdown to 00:00 + "Time's up", Display mode.
