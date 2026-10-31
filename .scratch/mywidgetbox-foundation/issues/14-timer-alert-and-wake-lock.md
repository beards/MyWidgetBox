# 14: 計時器時間到提示與 Wake Lock

**What to build:** 時間到時播放提示音（數秒後停止）並顯示畫面效果，持續到使用者停止或指定秒數後。手機上計時執行中使用 Wake Lock 保持螢幕亮著，不支援時略過。提示音與效果時長屬於 Settings。

**Blocked by:** 12, 09

**Status:** resolved

- [x] 時間到提示音播放設定秒數後停止，可用自訂音效網址
- [x] 畫面效果持續到停止或設定秒數
- [ ] 支援 Wake Lock 的手機瀏覽器在計時時螢幕不熄；不支援時無錯誤 (needs manual verification on a phone)
- [x] 測試：時間到狀態與效果結束時間的判定

## Answer

- Widget-level Settings `alert: { soundSeconds (1–60, default 5), effectSeconds (0–3600, default 10; 0 = until stopped) }` and `sound: SoundSettings`; old stored Settings load with defaults (no version bump). Controls in the timer panel; `setAlert` / `setSound`.
- Time-up moment is derived from timestamps (`timeUpAt` = startedAt + duration - elapsed). `takeDueAlerts()` marks the run `alert: 'fired'` in the State (optional field), so each time up alerts once and a reload never replays it; a time up whose sound window passed while closed is marked silently. `stopAlert(id)` sets `'stopped'`.
- Pure `readAlert(timer, now, alert)` decides the flash effect from timestamps; the view plays `sound.repeat('alert', ...)` for the remaining sound time and shows a Stop button while alerting.
- `shared/wake-lock.ts`: holds a screen Wake Lock while any timer runs, re-acquires on visibility change, silently skipped when unsupported/refused (not unit-tested). Smoke-tested in a desktop browser via agent-browser; phone Wake Lock needs manual verification.
