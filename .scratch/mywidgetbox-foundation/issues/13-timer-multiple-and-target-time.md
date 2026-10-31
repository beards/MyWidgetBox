# 13: 多組計時器與倒數到時刻

Status: resolved
Blocked by: 12

**What to build:** 同一頁並排多組計時器，每組可命名、各自選模式並各自控制。新增「倒數到某時刻」模式（例如 21:00）與小數秒顯示選項。Display mode 可經 URL 指定只顯示其中一組。

- [x] 可新增／刪除／命名多組計時器，各自獨立運作
- [x] 倒數到時刻模式正確（目標時刻已過時有明確行為）
- [x] 小數秒可開關
- [x] URL 參數可讓 Display mode 只顯示指定一組
- [x] 測試：多組獨立；倒數到時刻在時鐘推進下的值；指定單組顯示

## Answer

- Controller: `addTimer()` / `removeTimer(id)` (last one kept) / `renameTimer(id, name)`; new ids skip ids that have a stored run, so a new timer never inherits progress. Every action still takes a timer id.
- New mode `targetTime` with `TimerConfig.target` (`HH:MM`, local, 24 h). It follows the clock (no start/pause/reset), so it works in OBS from a Share link with no State. Past-target rule (`targetDeadline`): it counts to the first local occurrence of the target later than one hour ago, i.e. **time up for one hour after the target time, then counts to the next day's occurrence**; a target earlier in the day than now (beyond that hour) is tomorrow. Ticket 14's time-up alert fires for it too (once per daily occurrence, via `run.alertUpAt`).
- `TimerSettings.showFraction` (default off) shows hundredths (`01:04.99`; countdowns round up, stopwatches down).
- Display mode single timer: `?timer=<id>` together with `display=1` (`visibleTimers()`; unknown id or no Display mode = all timers); the Share link panel has a "Display mode shows" select. Only the shown timer sounds its alert on such a page.
- Settings schema bumped to version 2 with a Migration adding `target` to stored timers; frozen ticket-12 Share link and stored Presets are tested to still open.
