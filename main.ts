// Catalog page: UI text only, no controller.
import { messages } from './messages';
import { createBrowserEnv } from './shared/env';
import { createI18n } from './shared/i18n';
import { bindStaticText, mountLanguageSwitcher } from './shared/i18n-dom';

const i18n = createI18n(createBrowserEnv(), messages, { browserLanguage: navigator.language });
bindStaticText(i18n);
mountLanguageSwitcher(i18n, document.querySelector<HTMLElement>('#language')!);
