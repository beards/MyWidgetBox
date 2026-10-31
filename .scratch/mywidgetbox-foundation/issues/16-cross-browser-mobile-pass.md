# 16: 跨瀏覽器與手機驗收

Status: resolved
Blocked by: 11, 13, 14, 15

**What to build:** 在最新版 Firefox、Safari 與手機（iOS Safari、Android Chrome）實際走過三個 Widget 與目錄頁，修掉明顯問題，並記錄降級的功能。Chrome 系列與 OBS 為硬性支援，再確認一次。

- [ ] Chrome 與 OBS Browser Source：所有功能可用 (Chromium verified via Playwright; OBS needs manual verification)
- [ ] Firefox、Safari、iOS Safari、Android Chrome：主要流程可用，明顯問題已修 (Firefox, WebKit and iPhone/Pixel emulation pass and found issues are fixed; real Safari and devices need manual verification)
- [x] 降級功能清單寫入 README

## Answer

Ran a Playwright smoke pass (Chromium, Firefox, WebKit, plus iPhone 13 / iPhone SE / Pixel 7 emulation with touch) over the catalog and all three Widgets: load without console errors, roll / spin / start, Settings persisting across reload, Share link plus Display mode, no horizontal overflow, and tap target sizes. The first run passed 163 of 180 checks and the final run passed all 180.
Fixes: the dice now fall back to flat tiles when WebGL is unavailable (before this, the page broke). On touch screens the controls are finger-sized and the timer digits shrink to fit the width. Narrow screens no longer overflow sideways, and the language switcher no longer covers the Widget.
README has a new "Browser support" section: hard support (Chromium/OBS) vs best effort, plus a list of the features that degrade (Wake Lock, DeviceMotion/iOS permission, audio unlock, WebGL fallback, CSS zoom, Clipboard).
Real OBS, Safari and phone hardware were not available, so the first two criteria still need manual verification.
