import { resolve } from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

// One directory per Widget, each with its own index.html entry.
// Adding a Widget = adding its directory name here (see README).
const widgets = ['dice'];

export default defineConfig({
  // GitHub Pages serves the site from https://beards.github.io/MyWidgetBox/;
  // dev and preview use the same base so URLs match production.
  base: '/MyWidgetBox/',
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
