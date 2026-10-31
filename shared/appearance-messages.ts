import type { MessageTables } from './i18n';

/** UI text of the shared appearance panel; a page spreads these into its own message tables. */
export type AppearanceMessageKey =
  | 'appearance'
  | 'background'
  | 'backgroundSolid'
  | 'backgroundTransparent'
  | 'backgroundImage'
  | 'backgroundColor'
  | 'imageUrl'
  | 'fontFamily'
  | 'fontFamilyDefault'
  | 'fontSize'
  | 'scale';

export const appearanceMessages: MessageTables<AppearanceMessageKey> = {
  en: {
    appearance: 'Appearance',
    background: 'Background',
    backgroundSolid: 'Solid color',
    backgroundTransparent: 'Transparent',
    backgroundImage: 'Image URL',
    backgroundColor: 'Background color',
    imageUrl: 'Image URL',
    fontFamily: 'Font',
    fontFamilyDefault: 'Default',
    fontSize: 'Text size (px)',
    scale: 'Scale',
  },
  'zh-Hant': {
    appearance: '外觀',
    background: '背景',
    backgroundSolid: '純色',
    backgroundTransparent: '透明',
    backgroundImage: '圖片網址',
    backgroundColor: '背景顏色',
    imageUrl: '圖片網址',
    fontFamily: '字型',
    fontFamilyDefault: '預設',
    fontSize: '字級（px）',
    scale: '縮放',
  },
};
