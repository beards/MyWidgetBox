# 04: Settings 持久化與 Preset

**What to build:** 建立共用（opt-in）的 Settings 流程：薄儲存介面、帶 schema 版本號的 Settings、逐版遷移、載入優先序 URL > 儲存 > 預設，任何一層損壞就落到下一層。骰子的 Settings 重新整理後仍在；可新增、切換、重新命名、刪除具名 Preset。

**Blocked by:** 02

**Status:** resolved

- [x] 骰子 Settings（骰組、修正值、動畫長度等）重新整理後保留（骰組、修正值；動畫長度由 03 加入 `DiceSettings` 後自動保存）
- [x] Preset 可新增／切換／重新命名／刪除，目前選中的 Preset 會被記住
- [x] Settings 帶版本號；遷移時缺欄補預設、未知欄位忽略
- [x] 測試：記憶體儲存下的保存與載入；損壞 JSON → 預設值；舊版 Settings → 遷移後正確；Preset 操作
- [x] Widget 不直接呼叫 `localStorage`

## Answer

Added the opt-in `shared/settings.ts`: `createSettingsStore(env, schema, { readUrl })` with a versioned `SettingsSchema` (namespace, version, defaults, step-by-step `migrations`, `isValid`), recursive fill-from-defaults that drops unknown fields, and the load priority URL > storage > defaults where each failing layer falls through (unreadable Presets are dropped individually; storage exceptions keep the page working from memory).
Presets (create from current Settings / select / rename / delete, last one protected) and the selected Preset are persisted under `mywidgetbox:<namespace>:settings` via `env.storage`.
`readUrl` is the hook for ticket 05: URL Settings stay in memory (`source: 'url'`, `selectedPresetId: null`) until the user creates a Preset from them. `parseSettings` / `serializeSettings` are exported for Share link (05) and import/export (08).
Dice now stores `DiceSettings { diceSet }` through the store; `DiceState` gained `presets` and `selectedPresetId`, plus Preset actions, and the page has a small Preset bar. Migration behaviour is tested with a sample schema in `shared/settings.test.ts` (dice is still at v1, so it has no real legacy data).
