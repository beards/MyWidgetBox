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
  | 'stopAlert'
  | 'alert'
  | 'alertSoundSeconds'
  | 'alertEffectSeconds'
  | 'soundEnabled'
  | 'soundVolume'
  | 'soundUrl'
  | 'mode'
  | 'modeCountdown'
  | 'modeStopwatch'
  | 'modeTargetTime'
  | 'targetTime'
  | 'timerName'
  | 'numberedTimer'
  | 'addTimer'
  | 'removeTimer'
  | 'timers'
  | 'showFraction'
  | 'shareTimer'
  | 'shareAllTimers'
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
  | 'importError'
  | 'restoreDefaults'
  | 'restoreDefaultsConfirm'
  | 'home';

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
    stopAlert: 'Stop alert',
    alert: "Time's up alert",
    alertSoundSeconds: 'Sound length (seconds)',
    alertEffectSeconds: 'Flash length (seconds, 0 = until stopped)',
    soundEnabled: "Play a sound when time's up",
    soundVolume: 'Volume',
    soundUrl: 'Custom sound URL (empty = built-in)',
    mode: 'Mode',
    modeCountdown: 'Countdown',
    modeStopwatch: 'Stopwatch',
    modeTargetTime: 'Countdown to a time',
    targetTime: 'Time',
    timerName: 'Name',
    numberedTimer: 'Timer {n}',
    addTimer: 'Add timer',
    removeTimer: 'Remove',
    timers: 'Timers',
    showFraction: 'Show hundredths of a second',
    shareTimer: 'Display mode shows',
    shareAllTimers: 'All timers',
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
    restoreDefaults: 'Restore defaults',
    restoreDefaultsConfirm: 'Replace the Settings of this Preset with the defaults?',
    home: '← All widgets',
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
    stopAlert: '停止提示',
    alert: '時間到提示',
    alertSoundSeconds: '提示音長度（秒）',
    alertEffectSeconds: '閃爍長度（秒，0＝直到停止）',
    soundEnabled: '時間到時播放提示音',
    soundVolume: '音量',
    soundUrl: '自訂音效網址（留空＝內建音效）',
    mode: '模式',
    modeCountdown: '倒數',
    modeStopwatch: '碼表',
    modeTargetTime: '倒數到時刻',
    targetTime: '時刻',
    timerName: '名稱',
    numberedTimer: '計時器 {n}',
    addTimer: '新增計時器',
    removeTimer: '刪除',
    timers: '計時器',
    showFraction: '顯示小數秒（百分之一秒）',
    shareTimer: 'Display mode 顯示',
    shareAllTimers: '全部計時器',
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
    restoreDefaults: '回復預設值',
    restoreDefaultsConfirm: '要把這個 Preset 的設定全部回復成預設值嗎？',
    home: '← 所有工具',
  },
};
