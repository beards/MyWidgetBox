# 08: Settings JSON 匯出／匯入

Status: resolved
Blocked by: 04

**What to build:** 可把單一 Widget 的所有 Preset 匯出為 JSON 檔，並從 JSON 檔匯入；匯入走與載入相同的驗證與遷移。作為 Safari 清除資料或換電腦時的備份手段。以骰子實作，模組可被其他 Widget 選用。

- [x] 匯出下載 JSON 檔，包含所有 Preset 與版本號
- [x] 匯入後 Preset 還原；無效檔案給出錯誤訊息且不破壞現有 Settings（下載／檔案選擇的瀏覽器行為 needs manual verification）
- [x] 測試：匯出再匯入往返相同；舊版匯出檔可遷移；無效檔案不改變現有 Settings

## Answer

- `SettingsStore` (`shared/settings.ts`) gained `exportFile()` (pretty JSON `{ namespace, version, presets, selectedPresetId }`) and `importFile(text): boolean`.
- Import reuses the storage parsing path (`parseSettings`: migrate + fill + validate) in strict mode: wrong namespace, unreadable JSON, or any unreadable Preset rejects the whole file and changes nothing. A successful import replaces all Presets and leaves URL mode.
- Dice controller exposes `exportSettings()` / `importSettings(text)`; the view adds an Export button (Blob download) and an Import file input with a localized error message.
- Tests: round-trip, old-version migration, invalid files leave Settings and storage untouched.
