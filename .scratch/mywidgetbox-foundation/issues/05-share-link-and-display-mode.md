# 05: Share link 與 Display mode

**What to build:** 一鍵複製 Share link：把目前 Preset 的 Settings 編碼進 URL，可附 Display mode（隱藏控制介面）與透明背景。以 Share link 開啟時 Settings 只在記憶體生效，使用者明確選擇才寫入儲存。以骰子驗證，並實際貼進 OBS 測試。

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] 「複製 Share link」按鈕，可勾選是否含 Display mode / 透明背景
- [ ] Display mode 下控制介面完全隱藏，仍可用 `Space` / 點擊觸發
- [ ] 以 Share link 開啟得到相同 Settings，且不覆寫既有儲存；提供「保存為 Preset」
- [ ] 測試：Share link 往返得到相同 Settings；舊版 Share link 遷移後可開；URL 優先於儲存；開啟不寫入儲存
- [ ] 在 OBS Browser Source 以透明背景疊加驗證（手動）
