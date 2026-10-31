# 06: 外觀客製化共同基準

**What to build:** 在骰子上建立共用（opt-in）的外觀設定：背景（純色／透明／圖片網址）、主要物件顏色（骰子本體與點數）、字型與字級、整體縮放。外觀屬於 Settings，隨 Preset 與 Share link 一起保存與分享。

**Blocked by:** 04

**Status:** resolved

- [x] 背景可選純色、透明、圖片網址
- [x] 骰子本體與點數顏色、字型、字級、整體縮放可調並即時預覽
- [x] 外觀隨 Preset 保存、隨 Share link 帶出
- [x] 模組可被其他 Widget 選用並擴充各自的項目
- [x] 測試：外觀 Settings 的保存、遷移與 Share link 往返

## Answer

- `shared/appearance.ts`: `Appearance` baseline (`background: { kind: 'solid'|'transparent'|'image', color, imageUrl }`, `fontFamily`, `fontSize`, `textColor`, `scale`), defaults and `isAppearance()`; Widgets extend the interface with their own items.
- `shared/appearance-dom.ts`: `applyAppearance()` (sole owner of the page background; `forceTransparent` serves the Share link `transparent` Display-mode flag) and `mountAppearancePanel()` with live preview and extra Widget color fields; text in `shared/appearance-messages.ts`.
- Dice: `DiceSettings.appearance` adds `dieColor` / `pipColor` (passed live to the three.js scene via `scene.setColors()`), `setAppearance()` validates; old Settings get the default appearance by default-filling (no version bump).
- Tests through the dice controller: defaults, persistence, per-Preset, invalid values ignored, old/partial stored Settings filled, Share link round trip without writing storage.
- Verified in the browser with agent-browser (image/solid/transparent background, font, colors, scale from a Share link, Display mode + transparent). OBS overlay itself still needs manual verification.
