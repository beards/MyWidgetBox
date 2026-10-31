import { type AppearanceMessageKey, appearanceMessages } from '../shared/appearance-messages';
import type { MessageTables } from '../shared/i18n';

export type TimerMessageKey =
  | 'title'
  | 'unnamedTimer'
  | 'start'
  | 'resume'
  | 'pause'
  | 'reset'
  | 'timeUp'
  | 'mode'
  | 'modeCountdown'
  | 'modeStopwatch'
  | 'duration'
  | 'hours'
  | 'minutes'
  | 'seconds'
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

export const messages: MessageTables<TimerMessageKey | AppearanceMessageKey> = {
  en: {
    ...appearanceMessages.en,
    title: 'Timer · MyWidgetBox',
    unnamedTimer: 'Timer',
    start: 'Start',
    resume: 'Resume',
    pause: 'Pause',
    reset: 'Reset',
    timeUp: "Time's up",
    mode: 'Mode',
    modeCountdown: 'Countdown',
    modeStopwatch: 'Stopwatch',
    duration: 'Duration',
    hours: 'Hours',
    minutes: 'Minutes',
    seconds: 'Seconds',
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
    ...appearanceMessages['zh-Hant'],
    title: '計時器 · MyWidgetBox',
    unnamedTimer: '計時器',
    start: '開始',
    resume: '繼續',
    pause: '暫停',
    reset: '重置',
    timeUp: '時間到',
    mode: '模式',
    modeCountdown: '倒數',
    modeStopwatch: '碼表',
    duration: '時長',
    hours: '時',
    minutes: '分',
    seconds: '秒',
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
