// View layer: owns the DOM, subscribes to the controller, and calls its actions.
import { createBrowserEnv } from '../shared/env';
import { createDiceController } from './controller';

const dice = createDiceController(createBrowserEnv());

const die = document.querySelector<HTMLButtonElement>('#die')!;
const rollButton = document.querySelector<HTMLButtonElement>('#roll')!;

dice.subscribe(({ outcome }) => {
  die.textContent = outcome ? String(outcome.total) : '?';
});

die.addEventListener('click', () => dice.roll());
rollButton.addEventListener('click', () => dice.roll());
