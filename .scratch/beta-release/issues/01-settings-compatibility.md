# 01: 測試版完成前不做設定資料相容

Status: resolved
Blocked by: None (can start immediately)

**背景：** 網站還沒正式發表。使用者決定（2026-11-01）：在宣布「測試版完成」之前，存在 localStorage、分享連結、匯出檔裡的舊設定可以直接不相容，不寫 Migration、不為舊欄位留轉換邏輯，避免累積只為舊資料存在的程式碼。舊資料讀不進來時，照現有行為回到預設值即可。

**測試版完成時要做的事：**

- [ ] 決定各 Widget 的 Settings schema 從哪個版本開始承諾相容（目前全部是 version 1，State 存檔也是）
- [ ] 把 Migration 機制加回 `shared/settings.ts`（2026-11-01 清理時已整個拿掉：現在只讀與 schema 版本完全相同的資料），之後任何改變設定意義或移除欄位的修改都要附 Migration 與測試
- [ ] 檢查並清掉測試版期間留下、只為舊資料存在的邏輯

**2026-11-01 已清理：** 共用 Migration 機制、timer 的 v1→v2 Migration、timer / wheel State 讀 version 1 格式的邏輯、骰子沒用到的 `scale` 欄位、骰子的 `tableFinish`（背景改成直接存 `background.kind`，含 `felt`），以及只為舊資料存在的測試。保留缺欄位從預設值補上（fillFromDefaults），那是通用機制。

## Comments

## Answer

2026-11-22 使用者宣布要開始守相容；同日改為：等音效設定改版（自訂音效開關、選擇檔案或外部網址）發佈到正式站之後才開始，在那之前格式仍可直接改。

- **從哪個版本開始承諾相容：** 三個 Widget 的 Settings、兩份 State、Share link、匯出檔，以及 `lang`／`theme` 都從現在的 version 1 開始。規則寫在 [ADR-0004](../../../docs/adr/0004-stored-formats-stay-readable.md)：加欄位只要給預設值；其他改動都要升版號並附 Migration。
- **Migration 機制：** 刻意先不加回去。現在沒有任何 Migration，加回來只會是沒人用的程式碼。第一個需要升版號的改動再加，ADR-0004 已經要求那時一定要附。
- **清掉測試版期間的舊資料邏輯：** 查過了，沒有只為舊資料存在的程式碼。最後一輪整理（在凍結格式前）：
  - 轉盤不再存介面改不到的 `appearance.fontSize`、`appearance.textColor`（共用外觀拆成 `Appearance` 和 `TextAppearance`）
  - 陣列項目（計時器、轉盤項目、骰組）缺的欄位也用預設值補，以後加欄位不用升版號
  - 轉盤和計時器重複的 State 讀寫抽成 `shared/scoped-state.ts`；轉盤刪 Preset 時也會清掉它的 State

