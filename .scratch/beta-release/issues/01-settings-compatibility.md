# 01: 測試版完成前不做設定資料相容

Status: needs-triage
Blocked by: None (can start immediately)

**背景：** 網站還沒正式發表。使用者決定（2026-11-01）：在宣布「測試版完成」之前，存在 localStorage、分享連結、匯出檔裡的舊設定可以直接不相容，不寫 Migration、不為舊欄位留轉換邏輯，避免累積只為舊資料存在的程式碼。舊資料讀不進來時，照現有行為回到預設值即可。

**測試版完成時要做的事：**

- [ ] 決定各 Widget 的 Settings schema 從哪個版本開始承諾相容（例如統一重設為 version 1，或維持當時的版本）
- [ ] 確認之後任何改變設定意義或移除欄位的修改，都要附 Migration 與測試（SettingsSchema 的 `migrations`）
- [ ] 檢查並清掉測試版期間留下、只為舊資料存在的邏輯（例如 timer 的 version 1 → 2 Migration 是否保留）

## Comments
