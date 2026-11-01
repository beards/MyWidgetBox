import type { MessageTables } from './shared/i18n';

export type CatalogMessageKey =
  | 'title'
  | 'tagline'
  | 'widget.dice'
  | 'widget.dice.desc'
  | 'widget.wheel'
  | 'widget.wheel.desc'
  | 'widget.timer'
  | 'widget.timer.desc';

export const messages: MessageTables<CatalogMessageKey> = {
  en: {
    title: 'MyWidgetBox',
    tagline: 'Handy tools for everyday life and games, also ready to drop into an OBS stream',
    'widget.dice': 'Dice',
    'widget.dice.desc': 'Roll dice, build dice sets',
    'widget.wheel': 'Wheel',
    'widget.wheel.desc': 'Weighted spinning wheel',
    'widget.timer': 'Timer',
    'widget.timer.desc': 'Countdown, stopwatch, target time',
  },
  'zh-Hant': {
    title: 'MyWidgetBox',
    tagline: '生活中和遊戲時用得到的小工具，也適合直接放進 OBS 直播',
    'widget.dice': '骰子',
    'widget.dice.desc': '擲骰、自訂骰組',
    'widget.wheel': '轉盤',
    'widget.wheel.desc': '加權抽選轉盤',
    'widget.timer': '計時器',
    'widget.timer.desc': '倒數、碼錶、指定時間',
  },
};
