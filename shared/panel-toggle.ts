// DOM helper for the collapsible controls panel (shared/layout.css). View-layer only; untested
// by design (manual check).

/**
 * Wires the panel's toggle button: a click collapses or expands the controls panel by setting
 * `data-panel-collapsed` on the root element; the button's aria-expanded follows it.
 */
export function mountPanelToggle(button: HTMLButtonElement): void {
  const root = document.documentElement;
  button.addEventListener('click', () => {
    const collapsed = root.toggleAttribute('data-panel-collapsed');
    button.setAttribute('aria-expanded', String(!collapsed));
  });
}
