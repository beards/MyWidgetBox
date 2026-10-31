import type { MessageTables } from '../shared/i18n';

export type DiceMessageKey = 'title' | 'roll';

export const messages: MessageTables<DiceMessageKey> = {
  en: { title: 'Dice · MyWidgetBox', roll: 'Roll' },
  'zh-Hant': { title: '骰子 · MyWidgetBox', roll: '擲骰' },
};
