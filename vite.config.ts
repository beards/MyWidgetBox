import { resolve } from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

// One directory per Widget, each with its own index.html entry.
// Adding a Widget = adding its directory name here (see README).
const widgets = ['dice', 'wheel', 'timer'];

export default defineConfig({
  // Relative base: the same build works from a site root (https://mywidgetbox.github.io/)
  // and from a sub-path (a project Pages site such as /MyWidgetBox/).
  base: './',
  // Multi-page: serve each directory's index.html instead of falling back to the root page.
  appType: 'mpa',
  // Agent worktrees live under .claude/; keep them out of test runs.
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        ...Object.fromEntries(
          widgets.map((name) => [name, resolve(import.meta.dirname, name, 'index.html')]),
        ),
      },
    },
  },
});
