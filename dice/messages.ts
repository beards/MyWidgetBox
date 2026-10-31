import { type AppearanceMessageKey, appearanceMessages } from '../shared/appearance-messages';
import type { MessageTables } from '../shared/i18n';

export type DiceMessageKey =
  | 'title'
  | 'roll'
  | 'reset'
  | 'animationDuration'
  | 'seconds'
  | 'alwaysFullAnimation'
  | 'sound'
  | 'soundEnabled'
  | 'soundVolume'
  | 'soundUrl'
  | 'shakeToRoll'
  | 'shakeUnsupported'
  | 'shakeDenied'
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
  | 'importError'
  | 'dieColor'
  | 'pipColor';

export const messages: MessageTables<DiceMessageKey | AppearanceMessageKey> = {
  en: {
    ...appearanceMessages.en,
    title: 'Dice · MyWidgetBox',
    roll: 'Roll',
    reset: 'Reset',
    animationDuration: 'Animation length',
    seconds: '{seconds} s',
    alwaysFullAnimation: 'Always play the full animation (ignore reduced motion)',
    sound: 'Sound',
    soundEnabled: 'Play a sound when the dice land',
    soundVolume: 'Volume',
    soundUrl: 'Custom sound URL (empty = built-in)',
    shakeToRoll: 'Shake the phone to roll',
    shakeUnsupported: 'This device cannot detect shaking.',
    shakeDenied: 'Motion access was denied, so shaking cannot roll. Allow it in the browser settings and try again.',
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
    dieColor: 'Die color',
    pipColor: 'Pip color',
  },
  'zh-Hant': {
    ...appearanceMessages['zh-Hant'],
    title: '骰子 · MyWidgetBox',
    roll: '擲骰',
    reset: '重置',
    animationDuration: '動畫長度',
    seconds: '{seconds} 秒',
    alwaysFullAnimation: '永遠播放完整動畫（忽略「減少動態效果」）',
    sound: '音效',
    soundEnabled: '骰子落地時播放音效',
    soundVolume: '音量',
    soundUrl: '自訂音效網址（留空＝內建音效）',
    shakeToRoll: '搖手機擲骰',
    shakeUnsupported: '此裝置無法偵測搖動。',
    shakeDenied: '動作感應存取被拒，無法搖動擲骰。請在瀏覽器設定中允許後再試一次。',
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
    dieColor: '骰子顏色',
    pipColor: '點數顏色',
  },
};
