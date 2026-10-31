// View layer: owns the DOM, subscribes to the controller, and calls its actions.
import { createBrowserEnv } from '../shared/env';
import { createI18n } from '../shared/i18n';
import { bindStaticText, mountLanguageSwitcher } from '../shared/i18n-dom';
import { createDiceController } from './controller';
import { messages } from './messages';

const env = createBrowserEnv();
const dice = createDiceController(env);
const i18n = createI18n(env, messages, { browserLanguage: navigator.language });
bindStaticText(i18n);
mountLanguageSwitcher(i18n, document.querySelector<HTMLElement>('#language')!);

const die = document.querySelector<HTMLButtonElement>('#die')!;
const rollButton = document.querySelector<HTMLButtonElement>('#roll')!;

dice.subscribe(({ outcome }) => {
  die.textContent = outcome ? String(outcome.total) : '?';
});

die.addEventListener('click', () => dice.roll());
rollButton.addEventListener('click', () => dice.roll());
