# 09: 音效

**What to build:** 建立共用（opt-in）的音效模組：開關、音量、音效來源可填網址。先做骰子落地音效。音效設定屬於 Settings。

**Blocked by:** 03

**Status:** resolved

- [x] 骰子落地時播放音效，與 3D 動畫同步（聽感需手動驗證）
- [x] 可開關、可調音量，可填入自訂音效網址
- [x] 音效設定隨 Preset 與 Share link
- [ ] OBS 中可被擷取為音訊（手動驗證）；瀏覽器自動播放限制下不會出錯 — needs manual verification (OBS); autoplay/output failures are swallowed and covered by a unit test

## Answer

- New opt-in `shared/sound.ts`: `SoundSettings { enabled, volume 0–1, url }`, `soundDefaults` (on, 0.7, built-in), `isSoundSettings`, and `createSoundPlayer(output?)` with `play(sound, settings)` and `repeat(sound, settings, { interval, duration }) => stop` for wheel ticks / timer alerts.
- Built-in sounds (`diceLand`, `tick`, `alert`) are synthesized with Web Audio (no assets, no network). A custom URL plays through an `<audio>` element (no CORS needed) and falls back to the built-in sound if it cannot load; autoplay blocks stay silent; the player never throws.
- `DiceSettings.sound` (no version bump) is persisted per Preset, carried by Share links and exposed as `state.sound`; `setSound(partial)` rejects invalid values.
- Dice view plays `diceLand` in the scene's `onDone` (when the dice land, also for the reduced-motion reveal); controls: on/off, volume slider (previews on release), custom URL field.
