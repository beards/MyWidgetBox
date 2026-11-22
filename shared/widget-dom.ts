// Shared page wiring for the panels every Widget page has: Presets, Share link, Settings file
// export/import and sound. Each mount function finds its elements by the ids the Widget pages
// share (`#preset`, `#share-url`, ...), wires their events to the controller, and returns an
// `update` the page calls from its render.
import type { I18n } from './i18n';
import type { PresetSummary } from './settings';
import type { ShareLinkOptions } from './share-link';
import type { BuiltInSound, SoundPlayer, SoundSettings, SoundSource } from './sound';
import type { SoundMessageKey } from './sound-messages';
import { type SoundFileProblem, type SoundFiles, SoundFileRejected } from './sound-files';

/** Message keys the shared panels need in every page's message tables. */
export type PanelMessageKey =
  | 'sharedPreset'
  | 'unnamedPreset'
  | 'newPresetName'
  | 'sharedPresetName'
  | 'copied'
  | 'copyFailed'
  | 'importError'
  | 'restoreDefaultsConfirm';

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

/**
 * Settings backup: an export (download) button and an import file input with its error message,
 * plus the restore defaults button (asks first: it replaces the selected Preset's Settings).
 */
export function mountSettingsFilePanel(
  i18n: PanelI18n,
  {
    fileName,
    exportSettings,
    importSettings,
    restoreDefaults,
  }: { fileName: string; exportSettings(): string; importSettings(text: string): boolean; restoreDefaults(): void },
) {
  const restoreButton = $<HTMLButtonElement>('#settings-restore');
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
  restoreButton.addEventListener('click', () => {
    if (confirm(i18n.t('restoreDefaultsConfirm'))) restoreDefaults();
  });
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    importError.textContent = importSettings(await file.text()) ? '' : i18n.t('importError');
    importInput.value = '';
  });

  return {
    /** `locked` disables importing and restoring defaults (e.g. while the wheel spins). */
    update({ locked = false } = {}) {
      importInput.disabled = restoreButton.disabled = locked;
    },
  };
}

const SOUND_FILE_PROBLEMS: Record<SoundFileProblem, SoundMessageKey> = {
  tooBig: 'soundFileTooBig',
  unplayable: 'soundFileUnplayable',
  notStored: 'soundFileNotStored',
};

/**
 * Sound on/off and volume (previewed with `preview` when released) from the page's markup, plus the
 * custom sound block built into `#sound-custom`: a switch, then either a file picked from this device
 * or a URL, each with a note on its limits (`files` must be the player's too).
 */
export function mountSoundInputs(
  controller: { getState(): { sound: SoundSettings }; setSound(next: Partial<SoundSettings>): void },
  player: SoundPlayer,
  preview: BuiltInSound,
  { i18n, files }: { i18n: I18n<SoundMessageKey>; files: SoundFiles },
) {
  const enabled = $<HTMLInputElement>('#sound-enabled');
  const volume = $<HTMLInputElement>('#sound-volume');
  const volumeValue = $('#sound-volume-value');

  enabled.addEventListener('change', () => controller.setSound({ enabled: enabled.checked }));
  volume.addEventListener('input', () => controller.setSound({ volume: Number(volume.value) / 100 }));
  volume.addEventListener('change', () => player.play(preview, controller.getState().sound));

  const { t } = i18n;
  const relabels: (() => void)[] = [];
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: SoundMessageKey) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) relabels.push(() => (node.textContent = t(text)));
    return node;
  }
  /** A checkbox or radio button with its text. */
  function choice(type: 'checkbox' | 'radio', text: SoundMessageKey, value = '') {
    const input = element('input');
    input.type = type;
    if (type === 'radio') {
      input.name = 'sound-source';
      input.value = value;
    }
    const label = element('label', 'sound-custom__choice');
    label.append(input, element('span', '', text));
    return { input, label };
  }

  const custom = choice('checkbox', 'customSound');
  const fromFile = choice('radio', 'soundSourceFile', 'file');
  const fromUrl = choice('radio', 'soundSourceUrl', 'url');
  const browse = element('button', '', 'soundFileBrowse');
  browse.type = 'button';
  const picker = element('input');
  picker.type = 'file';
  picker.accept = 'audio/*';
  picker.hidden = true;
  const fileName = element('span');
  const clear = element('button', '', 'soundFileClear');
  clear.type = 'button';
  const url = element('input');
  url.type = 'url';
  url.placeholder = 'https://';
  url.spellcheck = false;
  const status = element('p', 'theme-note sound-custom__note');
  status.setAttribute('role', 'status');

  const fileRow = element('div', 'sound-custom__row');
  fileRow.append(fromFile.label, browse, picker, fileName, clear);
  const urlRow = element('div', 'sound-custom__row');
  urlRow.append(fromUrl.label, url);
  // A fieldset, so turning the custom sound (or all sound) off disables everything in it at once.
  const options = element('fieldset', 'sound-custom__options');
  options.append(
    fileRow,
    status,
    element('p', 'theme-note sound-custom__note', 'soundFileNote'),
    urlRow,
    element('p', 'theme-note sound-custom__note', 'soundUrlNote'),
  );
  $('#sound-custom').append(custom.label, options);

  /** The file id shown, and why the last picked file was not stored. */
  let shownFile = '';
  let problem: SoundMessageKey | null = null;
  function showFile(id: string) {
    shownFile = id;
    clear.hidden = id === '';
    if (id === '') {
      fileName.textContent = t('soundFileNone');
      return;
    }
    fileName.textContent = '…';
    void files.nameOf(id).then((name) => {
      if (shownFile === id) fileName.textContent = name ?? t('soundFileMissing');
    });
  }
  function relabel() {
    relabels.forEach((apply) => apply());
    status.textContent = problem ? t(problem) : '';
    showFile(shownFile);
  }
  relabel();
  i18n.subscribe(relabel);

  /** Deletes picked files nothing uses any more (a replaced or removed one, or one of a deleted Preset). */
  const pruneFiles = () => void files.pruneUnused([controller.getState().sound.file]);
  pruneFiles();

  custom.input.addEventListener('change', () => controller.setSound({ custom: custom.input.checked }));
  for (const { input } of [fromFile, fromUrl]) {
    input.addEventListener('change', () => controller.setSound({ source: input.value as SoundSource }));
  }
  browse.addEventListener('click', () => picker.click());
  picker.addEventListener('change', () => {
    const picked = picker.files?.[0];
    picker.value = '';
    if (!picked) return;
    problem = null;
    status.textContent = '';
    files.add(picked).then(
      (id) => {
        // Picking a file means using it.
        controller.setSound({ file: id, source: 'file' });
        player.play(preview, controller.getState().sound);
        pruneFiles();
      },
      (error: unknown) => {
        problem = SOUND_FILE_PROBLEMS[error instanceof SoundFileRejected ? error.problem : 'notStored'];
        status.textContent = t(problem);
      },
    );
  });
  clear.addEventListener('click', () => {
    controller.setSound({ file: '' });
    pruneFiles();
  });
  url.addEventListener('change', () => {
    controller.setSound({ url: url.value.trim() });
    // An invalid URL was ignored: show the one still in effect.
    url.value = controller.getState().sound.url;
  });

  return {
    update(sound: SoundSettings) {
      enabled.checked = sound.enabled;
      volume.value = String(Math.round(sound.volume * 100));
      volumeValue.textContent = `${volume.value}%`;
      volume.disabled = custom.input.disabled = !sound.enabled;
      custom.input.checked = sound.custom;
      options.disabled = !sound.enabled || !sound.custom;
      fromFile.input.checked = sound.source === 'file';
      fromUrl.input.checked = sound.source === 'url';
      if (document.activeElement !== url) url.value = sound.url;
      if (sound.file !== shownFile) showFile(sound.file);
    },
  };
}
