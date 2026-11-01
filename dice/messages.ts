import { type AppearanceMessageKey, appearanceMessages } from '../shared/appearance-messages';
import type { MessageTables } from '../shared/i18n';

export type DiceMessageKey =
  | 'title'
  | 'roll'
  | 'reset'
  | 'skipAnimation'
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
  | 'restoreDefaults'
  | 'restoreDefaultsConfirm'
  | 'panelToggle'
  | 'home'
  | 'dieColor'
  | 'pipColor'
  | 'diceSize'
  | 'showResultText'
  | 'tableBounce'
  | 'specialPips'
  | 'specialPipsFaces'
  | 'specialPipsColor'
  | 'finishFelt';

export const messages: MessageTables<DiceMessageKey | AppearanceMessageKey> = {
  en: {
    ...appearanceMessages.en,
    // The shared text items style the result text only.
    fontFamily: 'Result text font',
    fontSize: 'Result text size',
    textColor: 'Result text color',
    showResultText: 'Show the result text',
    title: 'Dice · MyWidgetBox',
    roll: 'Roll',
    reset: 'Reset',
    skipAnimation: 'Skip animation',
    alwaysFullAnimation: 'Always play the full animation (ignore reduced motion)',
    sound: 'Sound',
    soundEnabled: 'Play a sound when the dice hit the table and each other',
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
    restoreDefaults: 'Restore defaults',
    restoreDefaultsConfirm: 'Replace the Settings of this Preset with the defaults?',
    panelToggle: 'Settings',
    home: '← All widgets',
    dieColor: 'Die color',
    pipColor: 'Pip color',
    diceSize: 'Dice size',
    tableBounce: 'Table bounce',
    specialPips: 'Color some d6 pips differently',
    specialPipsFaces: 'Faces',
    specialPipsColor: 'Their color',
    finishFelt: 'Felt',
  },
  'zh-Hant': {
    ...appearanceMessages['zh-Hant'],
    // The shared text items style the result text only.
    fontFamily: '結果文字字型',
    fontSize: '結果文字大小',
    textColor: '結果文字顏色',
    showResultText: '顯示結果文字',
    title: '骰子 · MyWidgetBox',
    roll: '擲骰',
    reset: '重置',
    skipAnimation: '略過動畫',
    alwaysFullAnimation: '永遠播放完整動畫（忽略「減少動態效果」）',
    sound: '音效',
    soundEnabled: '骰子撞到桌面和彼此時播放音效',
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
    restoreDefaults: '回復預設值',
    restoreDefaultsConfirm: '要把這個 Preset 的設定全部回復成預設值嗎？',
    panelToggle: '設定',
    home: '← 所有工具',
    dieColor: '骰子顏色',
    pipColor: '點數顏色',
    diceSize: '骰子大小',
    tableBounce: '桌面彈性',
    specialPips: '特殊點數塗色',
    specialPipsFaces: '點數',
    specialPipsColor: '塗色',
    finishFelt: '絨布',
  },
};
