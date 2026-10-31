# 08: Settings JSON 匯出／匯入

**What to build:** 可把單一 Widget 的所有 Preset 匯出為 JSON 檔，並從 JSON 檔匯入；匯入走與載入相同的驗證與遷移。作為 Safari 清除資料或換電腦時的備份手段。以骰子實作，模組可被其他 Widget 選用。

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] 匯出下載 JSON 檔，包含所有 Preset 與版本號
- [ ] 匯入後 Preset 還原；無效檔案給出錯誤訊息且不破壞現有 Settings
- [ ] 測試：匯出再匯入往返相同；舊版匯出檔可遷移；無效檔案不改變現有 Settings
