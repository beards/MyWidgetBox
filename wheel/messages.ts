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
  | 'restoreDefaults'
  | 'restoreDefaultsConfirm'
  | 'home'
  | 'labelColor'
  | 'labelDirection'
  | 'labelDirectionAcross'
  | 'labelDirectionAlong'
  | 'limitLabelSize'
  | 'resultFontSize'
  | 'maxLabelSize'
  | 'pointerColor'
  | 'removeAfterDraw'
  | 'drawn'
  | 'allDrawn'
  | 'sound'
  | 'soundEnabled'
  | 'soundVolume'
  | 'soundUrl';

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
    restoreDefaults: 'Restore defaults',
    restoreDefaultsConfirm: 'Replace the Settings of this Preset with the defaults?',
    home: '← All widgets',
    labelColor: 'Wheel text color',
    labelDirection: 'Entry text direction',
    labelDirectionAcross: 'Across the sector',
    labelDirectionAlong: 'Along the radius',
    limitLabelSize: 'Limit entry text size',
    resultFontSize: 'Result pop-up text size (px)',
    maxLabelSize: 'Largest entry text size',
    pointerColor: 'Pointer color',
    removeAfterDraw: 'Remove entries after they are drawn',
    drawn: 'drawn',
    allDrawn: 'All entries have been drawn. Reset to start over.',
    sound: 'Sound',
    soundEnabled: 'Tick while the wheel spins',
    soundVolume: 'Volume',
    soundUrl: 'Custom tick sound URL (empty = built-in)',
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
    restoreDefaults: '回復預設值',
    restoreDefaultsConfirm: '要把這個 Preset 的設定全部回復成預設值嗎？',
    home: '← 所有工具',
    labelColor: '轉盤文字顏色',
    labelDirection: '選項文字方向',
    labelDirectionAcross: '橫跨扇形',
    labelDirectionAlong: '沿著半徑',
    limitLabelSize: '限制選項文字大小',
    resultFontSize: '結果彈窗文字大小（px）',
    maxLabelSize: '選項文字大小上限',
    pointerColor: '指針顏色',
    removeAfterDraw: '抽中後移除',
    drawn: '已抽',
    allDrawn: '所有選項都已抽完，請按「重置」重新開始。',
    sound: '音效',
    soundEnabled: '轉動時播放喀喀聲',
    soundVolume: '音量',
    soundUrl: '自訂喀喀聲網址（留空＝內建音效）',
  },
};
