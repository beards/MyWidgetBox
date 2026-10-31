import type { MessageTables } from './shared/i18n';

export type CatalogMessageKey = 'title' | 'widget.dice' | 'widget.timer';

export const messages: MessageTables<CatalogMessageKey> = {
  en: { title: 'MyWidgetBox', 'widget.dice': 'Dice', 'widget.timer': 'Timer' },
  'zh-Hant': { title: 'MyWidgetBox', 'widget.dice': '骰子', 'widget.timer': '計時器' },
};
