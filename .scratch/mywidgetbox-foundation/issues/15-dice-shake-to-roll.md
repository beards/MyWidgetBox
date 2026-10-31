# 15: 搖手機擲骰

**What to build:** 手機上可選開啟「搖手機擲骰」（預設關）。在 iOS 上需使用者觸發授權 `DeviceMotion`；不支援或拒絕授權時優雅降級。

**Blocked by:** 03

**Status:** resolved

- [x] 設定中可開啟，預設關閉
- [ ] 開啟後搖動手機觸發擲骰，動畫中搖動被忽略 (logic tested; device feel needs manual verification)
- [ ] iOS 授權流程可用；拒絕或不支援時給出提示且其他功能不受影響 (needs manual verification on iOS/Android)

## Answer

- `DiceSettings.shakeToRoll` (default false, per Preset, carried by Share links, no version bump); controller `setShakeToRoll()`.
- `dice/shake.ts`: pure `createShakeDetector()` (|delta acceleration| >= 20 m/s², 1 s cooldown) unit-tested with synthetic samples, plus thin `listenForShakes()` that requests iOS `DeviceMotionEvent.requestPermission()` and returns 'unsupported' / 'denied'.
- `dice/main.ts`: checkbox toggles it (the change event is the user gesture for iOS); on reload with it on, iOS waits for the first tap. Denied/unsupported show a status message; nothing else is affected.
- Shakes during an animation are ignored because `roll()` already ignores rolls while animating.
