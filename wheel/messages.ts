import { type AppearanceMessageKey, appearanceMessages } from '../shared/appearance-messages';
import type { MessageTables } from '../shared/i18n';

export type WheelMessageKey =
  | 'title'
  | 'spin'
  | 'reset'
  | 'entries'
  | 'addEntry'
  | 'newEntryLabel'
  | 'entryLabel'
  | 'entryWeight'
  | 'entryColor'
  | 'entryChance'
  | 'removeEntry'
  | 'animationDuration'
  | 'seconds'
  | 'alwaysFullAnimation'
  | 'history'
  | 'dismissResult'
  | 'presets'
  | 'presetName'
  | 'unnamedPreset'
  | 'newPreset'
  | 'newPresetName'
  | 'deletePreset'
  | 'sharedPreset'
  | 'sharedNotice'
  | 'saveAsPreset'
  | 'sharedPresetName'
  | 'shareLink'
  | 'shareDisplay'
  | 'shareTransparent'
  | 'copyShareLink'
  | 'copied'
  | 'copyFailed'
  | 'exportSettings'
  | 'importSettings'
  | 'importError'
  | 'labelColor'
  | 'pointerColor';

export const messages: MessageTables<WheelMessageKey | AppearanceMessageKey> = {
  en: {
    ...appearanceMessages.en,
    title: 'Wheel · MyWidgetBox',
    spin: 'Spin',
    reset: 'Reset',
    entries: 'Entries',
    addEntry: 'Add entry',
    newEntryLabel: 'Entry {n}',
    entryLabel: 'Text of entry {n}',
    entryWeight: 'Weight of entry {n}',
    entryColor: 'Color of entry {n}',
    entryChance: '{percent}%',
    removeEntry: 'Remove entry {n}',
    animationDuration: 'Spin length',
    seconds: '{seconds} s',
    alwaysFullAnimation: 'Always play the full animation (ignore reduced motion)',
    history: 'Recent spins',
    dismissResult: 'Close result',
    presets: 'Presets',
    presetName: 'Preset name',
    unnamedPreset: 'Default',
    newPreset: 'Save as new',
    newPresetName: 'Preset {n}',
    deletePreset: 'Delete',
    sharedPreset: 'From Share link (not saved)',
    sharedNotice: 'Opened from a Share link. Changes are not saved.',
    saveAsPreset: 'Save as Preset',
    sharedPresetName: 'From Share link',
    shareLink: 'Share link',
    shareDisplay: 'Display mode (hide controls)',
    shareTransparent: 'Transparent background',
    copyShareLink: 'Copy Share link',
    copied: 'Copied',
    copyFailed: 'Copy the link below',
    exportSettings: 'Export',
    importSettings: 'Import',
    importError: 'This file could not be imported. Your Settings were not changed.',
    labelColor: 'Entry text color',
    pointerColor: 'Pointer color',
  },
  'zh-Hant': {
    ...appearanceMessages['zh-Hant'],
    title: '轉盤 · MyWidgetBox',
    spin: '轉動',
    reset: '重置',
    entries: '選項',
    addEntry: '新增選項',
    newEntryLabel: '選項 {n}',
    entryLabel: '選項 {n} 的文字',
    entryWeight: '選項 {n} 的權重',
    entryColor: '選項 {n} 的顏色',
    entryChance: '{percent}%',
    removeEntry: '移除選項 {n}',
    animationDuration: '轉動長度',
    seconds: '{seconds} 秒',
    alwaysFullAnimation: '永遠播放完整動畫（忽略「減少動態效果」）',
    history: '最近結果',
    dismissResult: '關閉結果',
    presets: 'Preset',
    presetName: 'Preset 名稱',
    unnamedPreset: '預設',
    newPreset: '另存新 Preset',
    newPresetName: 'Preset {n}',
    deletePreset: '刪除',
    sharedPreset: '來自 Share link（未保存）',
    sharedNotice: '以 Share link 開啟，變更不會被保存。',
    saveAsPreset: '保存為 Preset',
    sharedPresetName: '來自 Share link',
    shareLink: 'Share link',
    shareDisplay: 'Display mode（隱藏控制介面）',
    shareTransparent: '透明背景',
    copyShareLink: '複製 Share link',
    copied: '已複製',
    copyFailed: '請複製下方連結',
    exportSettings: '匯出',
    importSettings: '匯入',
    importError: '無法匯入此檔案，現有 Settings 未變更。',
    labelColor: '選項文字顏色',
    pointerColor: '指針顏色',
  },
};
