# 02: 完整骰組（多種骰、多顆、修正值、歷史）

Status: resolved
Blocked by: 01

**What to build:** 骰子支援 d4、d6、d8、d10、d12、d20、d100，可一次擲多顆並混合種類，可加減固定修正值。以組合式介面建立骰組（加入 N 顆某種骰、設定修正值），不做表達式輸入。結果顯示總和與明細（例如 `17 = 12 + 3 + 2`），控制介面顯示最近 20 筆 Outcome（只在記憶體）。預設骰組仍為 1d6。

- [x] 組合式介面可新增／移除骰種、調整顆數、設定修正值
- [x] Outcome 包含每顆骰點數、修正值、總和；畫面顯示總和與明細
- [x] 最近 20 筆歷史顯示於控制介面，超過時捨棄最舊
- [x] 測試：固定亂數序列下混合骰組與修正值的 Outcome 正確；各面數分布均勻（統計檢定）

## Answer

- `dice/controller.ts`: dice set is a list of `{ sides, count }` groups (d4–d100, one group per kind, insertion order) plus an integer modifier; default 1d6. Actions `addDie`, `removeDie`, `setCount` (0 removes; 1–99; last group can't be removed), `setModifier` (invalid input ignored).
- Outcome is `{ rolls: { sides, value }[], modifier, total }`; `formatOutcome()` renders `17 = 12 + 3 + 2` / `-2 = 1 - 3`.
- State carries `history`: the 20 most recent Outcomes, newest first, memory only.
- `dice/main.ts` + `index.html`: composer UI (per-kind count inputs with remove buttons, kind picker + Add, modifier input), breakdown line, recent-rolls list. UI strings gathered in `dice/strings.ts` for ticket 07.
- Tests: fixed-sequence mixed set + modifier, negative modifier, composer edge cases, history cap, formatting, and a chi-square uniformity test per die kind with the production RNG.
