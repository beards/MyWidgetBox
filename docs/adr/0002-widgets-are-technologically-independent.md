# Widgets are technologically independent

Each Widget is its own page and may use whatever technology best fits it; the default stack (TypeScript, Vite multi-page build, no UI framework, three.js where 3D is needed) is a starting point, not a mandate. Shared code is opt-in, so a Widget can drop or replace any shared module, or use a different framework entirely, without forcing changes on other Widgets.
