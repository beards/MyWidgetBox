import type { MessageTables } from './shared/i18n';

export type CatalogMessageKey = 'title' | 'widget.dice';

export const messages: MessageTables<CatalogMessageKey> = {
  en: { title: 'MyWidgetBox', 'widget.dice': 'Dice' },
  'zh-Hant': { title: 'MyWidgetBox', 'widget.dice': '骰子' },
};
