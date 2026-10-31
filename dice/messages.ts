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
  | 'dieLabel';

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
  },
};
