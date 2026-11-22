# Stored formats stay readable

Starting with the release that publishes the reworked sound settings (a custom sound switch choosing a picked file or a URL; late November 2026), everything the site writes outside the running page must stay readable by every later version, so a user never loses Presets, State or a Share link to an update. Until that release, formats may still change without migrations. That covers:

- each Widget's Presets in `localStorage` (`mywidgetbox:<widget>:settings`) and its export file;
- Share links (`?s=` with the versioned Settings, plus `display`, `transparent`, `lang` and the timer's `timer`);
- State (`mywidgetbox:wheel:state`, `mywidgetbox:timer:state`, see `shared/scoped-state.ts`);
- sound files picked from the device (IndexedDB database `mywidgetbox`, store `soundFiles`, see `shared/sound-files.ts`);
- the site-wide `mywidgetbox:lang` and `mywidgetbox:theme`.

Adding a field is free: give it a default and old data is filled from it (inside array items too), with no version bump. Anything else — renaming, removing or retyping a field, narrowing what validation accepts, changing a storage key or URL parameter — needs a version bump plus a migration that turns the old form into the new one; never just drop data written by an earlier version. Unknown fields are already ignored, so an older page reading newer data degrades instead of failing.
