# 01: 測試版完成前不做設定資料相容

Status: needs-triage
Blocked by: None (can start immediately)

**背景：** 網站還沒正式發表。使用者決定（2026-11-01）：在宣布「測試版完成」之前，存在 localStorage、分享連結、匯出檔裡的舊設定可以直接不相容，不寫 Migration、不為舊欄位留轉換邏輯，避免累積只為舊資料存在的程式碼。舊資料讀不進來時，照現有行為回到預設值即可。

**測試版完成時要做的事：**

- [ ] 決定各 Widget 的 Settings schema 從哪個版本開始承諾相容（目前全部是 version 1，State 存檔也是）
- [ ] 把 Migration 機制加回 `shared/settings.ts`（2026-11-01 清理時已整個拿掉：現在只讀與 schema 版本完全相同的資料），之後任何改變設定意義或移除欄位的修改都要附 Migration 與測試
- [ ] 檢查並清掉測試版期間留下、只為舊資料存在的邏輯

**2026-11-01 已清理：** 共用 Migration 機制、timer 的 v1→v2 Migration、timer / wheel State 讀 version 1 格式的邏輯、骰子沒用到的 `scale` 欄位、骰子的 `tableFinish`（背景改成直接存 `background.kind`，含 `felt`），以及只為舊資料存在的測試。保留缺欄位從預設值補上（fillFromDefaults），那是通用機制。

## Comments
