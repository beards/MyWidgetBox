# 04: Settings 持久化與 Preset

**What to build:** 建立共用（opt-in）的 Settings 流程：薄儲存介面、帶 schema 版本號的 Settings、逐版遷移、載入優先序 URL > 儲存 > 預設，任何一層損壞就落到下一層。骰子的 Settings 重新整理後仍在；可新增、切換、重新命名、刪除具名 Preset。

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] 骰子 Settings（骰組、修正值、動畫長度等）重新整理後保留
- [ ] Preset 可新增／切換／重新命名／刪除，目前選中的 Preset 會被記住
- [ ] Settings 帶版本號；遷移時缺欄補預設、未知欄位忽略
- [ ] 測試：記憶體儲存下的保存與載入；損壞 JSON → 預設值；舊版 Settings → 遷移後正確；Preset 操作
- [ ] Widget 不直接呼叫 `localStorage`
