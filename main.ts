// Catalog page: UI text only, no controller.
import { messages } from './messages';
import { createBrowserEnv } from './shared/env';
import { createI18n } from './shared/i18n';
import { bindStaticText, mountLanguageSwitcher } from './shared/i18n-dom';
import { mountThemeSwitcher } from './shared/theme-dom';

const env = createBrowserEnv();
const i18n = createI18n(env, messages, { browserLanguage: navigator.language });
bindStaticText(i18n);
const language = document.querySelector<HTMLElement>('#language')!;
mountLanguageSwitcher(i18n, language);
mountThemeSwitcher(i18n, env.storage, language);
