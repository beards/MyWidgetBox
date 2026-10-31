import type { MessageTables } from '../shared/i18n';

export type DiceMessageKey =
  | 'title'
  | 'roll'
  | 'reset'
  | 'animationDuration'
  | 'seconds'
  | 'alwaysFullAnimation'
  | 'diceSet'
  | 'addDie'
  | 'removeDie'
  | 'count'
  | 'modifier'
  | 'history'
  | 'dieLabel'
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
  | 'importError';

export const messages: MessageTables<DiceMessageKey> = {
  en: {
    title: 'Dice · MyWidgetBox',
    roll: 'Roll',
    reset: 'Reset',
    animationDuration: 'Animation length',
    seconds: '{seconds} s',
    alwaysFullAnimation: 'Always play the full animation (ignore reduced motion)',
    diceSet: 'Dice set',
    addDie: 'Add',
    removeDie: 'Remove {label}',
    count: 'Number of {label}',
    modifier: 'Modifier',
    history: 'Recent rolls',
    dieLabel: 'd{sides}',
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
  },
  'zh-Hant': {
    title: '骰子 · MyWidgetBox',
    roll: '擲骰',
    reset: '重置',
    animationDuration: '動畫長度',
    seconds: '{seconds} 秒',
    alwaysFullAnimation: '永遠播放完整動畫（忽略「減少動態效果」）',
    diceSet: '骰組',
    addDie: '加入',
    removeDie: '移除 {label}',
    count: '{label} 的數量',
    modifier: '修正值',
    history: '最近結果',
    dieLabel: 'd{sides}',
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
  },
};
