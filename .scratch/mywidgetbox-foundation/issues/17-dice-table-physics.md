# 17: 骰子擲到桌上滾動的物理動畫

Status: resolved
Blocked by: None (can start immediately)

**What to build:** 取代目前「原地懸浮空轉」的 3D 動畫：骰子從桌面上方直接落下，彈跳、碰撞、滾動後自然停下，停下時朝上的面就是 controller 事先決定的 Outcome。做法見 ADR-0003：先在畫面外以 cannon-es 完整模擬並記錄軌跡，依停下時朝上的面重新對應各面標籤，再播放軌跡。

- [x] 物理引擎用 cannon-es（ADR-0002 允許骰子獨立加依賴）；模擬與面對應邏輯可在無 DOM／無 WebGL 下測試
- [x] 從桌面中央上方散開直接落下（不擲、不上拋），帶隨機姿勢與翻轉；畫面四周隱形牆，骰子不會出界；骰子之間會碰撞
- [x] 外觀有「桌面彈性」拉桿（0–1.5，預設 0.6，旁邊顯示數值）；超過 1 時彈跳展示時間依比例延長
- [x] 鏡頭斜上方約 45–60°，停下後不移動
- [x] 一般模式有可見桌面，顏色可在外觀設定調整，並提供幾個質感預設（例如木紋、絨布）；透明背景時桌面隱形、只保留骰子陰影
- [x] 停下後骰子留在原地；朝上面短暫高亮或浮出點數；總和與明細照舊
- [x] 所有骰種（d4/d6/d8/d10/d12/d20/d100）停下時朝上面（d4 依其讀數慣例）與 Outcome 一致，含多顆、20 顆以上
- [x] 骰子不再有「動畫長度」設定：物理用固定的自然參數；不設動畫時間上限，靠彈性逐漸衰減、收尾阻尼與原地抖動偵測自然停下（僅保留 30 秒防呆）；改提供「略過動畫」選項（開啟時骰子直接停在 Outcome 面上、無落下與碰撞聲，仍有朝上面高亮，總和／明細／歷史立即顯示，優先於其他動畫設定）
- [x] reduced-motion 維持快速呈現；「永遠完整動畫」覆寫仍有效
- [x] 碰撞聲依撞擊力道播放（桌面／牆／骰子互撞），音量與力道成正比並限制同時播放數；沿用共用音效模組與設定
- [x] 外觀新增欄位不需版本升級（缺欄補預設），舊 Share link 仍可開啟（凍結連結測試）
- [x] WebGL 不可用時仍走既有 fallback
- [x] 測試：給定 Outcome 與亂數種子，模擬 + 面對應後每顆骰朝上面等於 Outcome；最大彈性時仍會自行停下、不出界，原地抖動不會拖長結束時間；Settings 往返
- [ ] 在 OBS 中流暢運作（needs manual verification）

## Answer

Dice are now thrown onto a walled table: `dice/physics.ts` simulates the throw off-screen with cannon-es (convex hulls from `dice/geometry.ts`, invisible walls, from a random edge), records every frame and the impacts, and `faceRemap` (a pure function in `geometry.ts`: a rotation symmetry of the die) relabels each die so the Outcome ends on top; `dice/scene.ts` plays the recording back with a spot-lit table, soft shadows and glossy dice, then lights up the top faces.
d4 is read at its top corner (each face shows its three corner numbers). The physics uses one fixed tuning (what the former 3 s animation length gave; the dice have no animation length setting any more); past 3 s, damping brings the dice to rest. A "skip animation" option shows the dice at rest on the Outcome at once. Above 80 die bodies the dice are set down without physics.
Appearance gains `tableColor` and `tableFinish` (felt / wood / plain), filled from defaults for old Settings and Share links; a transparent background hides the table but keeps the shadows. Impacts play the new built-in `diceHit` sound at a volume proportional to how hard they were, at most 4 at once.
Tests: face remap for every kind / landing / label, seeded simulations ending on the Outcome (all kinds, 24 dice), frame limit, walls, impacts, sound limiting, table Settings round trip and the frozen v1 Share link. OBS smoothness needs manual verification.

Follow-up tuning on the feature branch (before merge): the dice are dropped straight down from above the middle of the table instead of thrown from an edge. A table bounce setting (0–1.5, default 0.6, value shown next to the slider) maps to a table restitution of 0.1 + 0.8 × bounce; die-to-die restitution is 0.75. Above a bounce of 1 the bounce easing and the wind-down start later (2.6 s per unit above 1). There is no animation time limit any more: the table's bounce eases to 0.3 over the wind-down and is zero after it, a die that only jitters in place for 0.2 s is set down (tipped over if not flat, laid as it is once tipping is given up), and a 30 s guard only protects against a looping bug.
