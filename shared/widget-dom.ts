// Shared page wiring for the panels every Widget page has: Presets, Share link, Settings file
// export/import and sound. Each mount function finds its elements by the ids the Widget pages
// share (`#preset`, `#share-url`, ...), wires their events to the controller, and returns an
// `update` the page calls from its render.
import type { PresetSummary } from './settings';
import type { ShareLinkOptions } from './share-link';
import type { BuiltInSound, SoundPlayer, SoundSettings } from './sound';

/** Message keys the shared panels need in every page's message tables. */
export type PanelMessageKey =
  | 'sharedPreset'
  | 'unnamedPreset'
  | 'newPresetName'
  | 'sharedPresetName'
  | 'copied'
  | 'copyFailed'
  | 'importError';

export interface PanelI18n {
  t(key: PanelMessageKey, params?: Record<string, string | number>): string;
  getLocale(): string;
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

export interface PresetState {
  presets: PresetSummary[];
  /** null while Settings opened from a Share link are in effect and not saved. */
  selectedPresetId: string | null;
}

export interface PresetActions {
  getState(): PresetState;
  createPreset(name: string): void;
  selectPreset(id: string): void;
  renamePreset(id: string, name: string): void;
  deletePreset(id: string): void;
}

/** Preset picker, rename, new and delete, plus the "opened from a Share link" notice with its save button. */
export function mountPresetPanel(controller: PresetActions, i18n: PanelI18n) {
  const select = $<HTMLSelectElement>('#preset');
  const name = $<HTMLInputElement>('#preset-name');
  const create = $<HTMLButtonElement>('#preset-new');
  const remove = $<HTMLButtonElement>('#preset-delete');
  const sharedNotice = $('#shared-notice');
  const sharedSave = $<HTMLButtonElement>('#shared-save');
  const { t } = i18n;

  select.addEventListener('change', () => controller.selectPreset(select.value));
  name.addEventListener('change', () => {
    const id = controller.getState().selectedPresetId;
    if (id) controller.renamePreset(id, name.value.trim());
  });
  create.addEventListener('click', () =>
    controller.createPreset(t('newPresetName', { n: controller.getState().presets.length + 1 })),
  );
  remove.addEventListener('click', () => {
    const id = controller.getState().selectedPresetId;
    if (id) controller.deletePreset(id);
  });
  sharedSave.addEventListener('click', () => controller.createPreset(t('sharedPresetName')));

  return {
    /** `locked` disables switching, creating and deleting (e.g. while the wheel spins). */
    update({ presets, selectedPresetId }: PresetState, { locked = false } = {}) {
      select.replaceChildren(
        ...(selectedPresetId === null ? [new Option(t('sharedPreset'), '', false, true)] : []),
        ...presets.map(({ id, name: presetName }) => new Option(presetName || t('unnamedPreset'), id, false, id === selectedPresetId)),
      );
      sharedNotice.hidden = selectedPresetId !== null;
      const selected = presets.find((preset) => preset.id === selectedPresetId);
      name.value = selected?.name ?? '';
      name.disabled = !selected;
      remove.disabled = !selected || presets.length === 1 || locked;
      select.disabled = create.disabled = sharedSave.disabled = locked;
    },
  };
}

/**
 * Share link options (Display mode, transparent), the link field and the copy button.
 * `link` builds the link from the chosen options; call `refresh()` when anything else it
 * depends on changed (a page calls it from render).
 */
export function mountSharePanel(i18n: PanelI18n, link: (options: ShareLinkOptions) => string) {
  const display = $<HTMLInputElement>('#share-display');
  const transparent = $<HTMLInputElement>('#share-transparent');
  const copy = $<HTMLButtonElement>('#share-copy');
  const status = $('#share-status');
  const url = $<HTMLInputElement>('#share-url');

  const current = () => link({ display: display.checked, transparent: transparent.checked, lang: i18n.getLocale() });
  const refresh = () => (url.value = current());

  for (const option of [display, transparent]) option.addEventListener('change', refresh);
  copy.addEventListener('click', async () => {
    const value = refresh();
    try {
      await navigator.clipboard.writeText(value);
      status.textContent = i18n.t('copied');
    } catch {
      // Clipboard refused (insecure context, permission): let the user copy by hand.
      status.textContent = i18n.t('copyFailed');
      url.select();
    }
  });
  url.addEventListener('focus', () => url.select());

  return { refresh };
}

/** How long a downloaded file's object URL is kept; revoking it right after click() can cancel the download. */
const DOWNLOAD_URL_LIFETIME = 10_000;

/** Settings backup: an export (download) button and an import file input with its error message. */
export function mountSettingsFilePanel(
  i18n: PanelI18n,
  { fileName, exportSettings, importSettings }: { fileName: string; exportSettings(): string; importSettings(text: string): boolean },
) {
  const exportButton = $<HTMLButtonElement>('#settings-export');
  const importInput = $<HTMLInputElement>('#settings-import');
  const importError = $('#settings-import-error');

  exportButton.addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([exportSettings()], { type: 'application/json' }));
    link.download = fileName;
    link.click();
    const href = link.href;
    setTimeout(() => URL.revokeObjectURL(href), DOWNLOAD_URL_LIFETIME);
  });
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    importError.textContent = importSettings(await file.text()) ? '' : i18n.t('importError');
    importInput.value = '';
  });

  return {
    /** `locked` disables importing (e.g. while the wheel spins). */
    update({ locked = false } = {}) {
      importInput.disabled = locked;
    },
  };
}

/** Sound on/off, volume (previewed with `preview` when released) and custom sound URL. */
export function mountSoundInputs(
  controller: { getState(): { sound: SoundSettings }; setSound(next: Partial<SoundSettings>): void },
  player: SoundPlayer,
  preview: BuiltInSound,
) {
  const enabled = $<HTMLInputElement>('#sound-enabled');
  const volume = $<HTMLInputElement>('#sound-volume');
  const url = $<HTMLInputElement>('#sound-url');

  enabled.addEventListener('change', () => controller.setSound({ enabled: enabled.checked }));
  volume.addEventListener('input', () => controller.setSound({ volume: Number(volume.value) / 100 }));
  volume.addEventListener('change', () => player.play(preview, controller.getState().sound));
  url.addEventListener('change', () => {
    controller.setSound({ url: url.value.trim() });
    // An invalid URL was ignored: show the one still in effect.
    url.value = controller.getState().sound.url;
  });

  return {
    update(sound: SoundSettings) {
      enabled.checked = sound.enabled;
      volume.value = String(Math.round(sound.volume * 100));
      volume.disabled = !sound.enabled;
      if (document.activeElement !== url) url.value = sound.url;
    },
  };
}
