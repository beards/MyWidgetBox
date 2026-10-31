import type { MessageTables } from '../shared/i18n';

export type DiceMessageKey =
  | 'title'
  | 'roll'
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
  | 'exportSettings'
  | 'importSettings'
  | 'importError';

export const messages: MessageTables<DiceMessageKey> = {
  en: {
    title: 'Dice · MyWidgetBox',
    roll: 'Roll',
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
    exportSettings: 'Export',
    importSettings: 'Import',
    importError: 'This file could not be imported. Your Settings were not changed.',
  },
  'zh-Hant': {
    title: '骰子 · MyWidgetBox',
    roll: '擲骰',
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
    exportSettings: '匯出',
    importSettings: '匯入',
    importError: '無法匯入此檔案，現有 Settings 未變更。',
  },
};
