# MyWidgetBox

A growing collection of small, single-purpose browser utilities for live streaming and everyday use. Each one runs in a Chromium-based browser (including the OBS Browser Source) with nothing else installed.

## Language

**Widget**:
A standalone, single-purpose utility opened at its own URL, such as the dice, the wheel, or the timer.
_Avoid_: Tool, app, gadget, 小工具

**Display mode**:
A way of showing a Widget with its controls hidden (and optionally a transparent background), so it can be overlaid on a stream.
_Avoid_: Overlay mode, OBS mode

**Settings**:
The choices a user deliberately makes for a Widget (appearance, dice set, wheel entries); remembered in the browser and carried by a Share link.
_Avoid_: Config, options, state

**Preset**:
A named, saved set of Settings for one Widget that the user can switch between.
_Avoid_: Profile, template, save slot

**State**:
What accumulates while a Widget is being used (a running timer, wheel entries already drawn); survives a reload but is never carried by a Share link.
_Avoid_: Settings, session

**Share link**:
A URL that encodes a Widget's Settings (and optionally Display mode and language), used to reproduce the same setup elsewhere, such as in OBS.
_Avoid_: OBS link, export URL

**Outcome**:
The result of a random action (a roll or a spin), decided before its animation starts; the animation only shows it.
_Avoid_: Result (when meaning the random draw)
