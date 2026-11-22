import type { MessageTables } from './i18n';

/** UI text of the custom sound block (mountSoundInputs); a page spreads these into its own message tables. */
export type SoundMessageKey =
  | 'customSound'
  | 'soundSourceFile'
  | 'soundSourceUrl'
  | 'soundFileBrowse'
  | 'soundFileClear'
  | 'soundFileNone'
  | 'soundFileMissing'
  | 'soundFileTooBig'
  | 'soundFileUnplayable'
  | 'soundFileNotStored'
  | 'soundFileNote'
  | 'soundUrlNote';

export const soundMessages: MessageTables<SoundMessageKey> = {
  en: {
    customSound: 'Custom sound',
    soundSourceFile: 'Pick a file',
    soundSourceUrl: 'URL',
    soundFileBrowse: 'Browse…',
    soundFileClear: 'Remove',
    soundFileNone: 'None',
    soundFileMissing: 'Not in this browser',
    soundFileTooBig: 'Too big: files up to 5 MB',
    soundFileUnplayable: 'This browser cannot play that file',
    soundFileNotStored: 'The file could not be saved in this browser',
    soundFileNote: 'Kept in this browser only, up to 5 MB. A Share link cannot carry it: whoever opens one hears the URL (or the built-in sound).',
    soundUrlNote: 'Must point straight at a sound file (.mp3, .wav, .ogg) on a site that allows linking to it. Share links carry it too.',
  },
  'zh-Hant': {
    customSound: '自訂音效',
    soundSourceFile: '選擇檔案',
    soundSourceUrl: '外部網址',
    soundFileBrowse: '瀏覽…',
    soundFileClear: '移除',
    soundFileNone: '未選擇',
    soundFileMissing: '這個瀏覽器沒有這個檔案',
    soundFileTooBig: '檔案太大：上限 5 MB',
    soundFileUnplayable: '這個瀏覽器無法播放這個檔案',
    soundFileNotStored: '無法把檔案存進這個瀏覽器',
    soundFileNote: '只存在這個瀏覽器，上限 5 MB。Share link 帶不過去，對方開啟時會改播外部網址（沒填就是內建音效）。',
    soundUrlNote: '要直接指向音檔（.mp3、.wav、.ogg），而且對方網站要允許外連。Share link 也帶得過去。',
  },
};
