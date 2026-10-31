import type { MessageTables } from './shared/i18n';

export type CatalogMessageKey = 'title' | 'widget.dice' | 'widget.wheel';

export const messages: MessageTables<CatalogMessageKey> = {
  en: { title: 'MyWidgetBox', 'widget.dice': 'Dice', 'widget.wheel': 'Wheel' },
  'zh-Hant': { title: 'MyWidgetBox', 'widget.dice': '骰子', 'widget.wheel': '轉盤' },
};
