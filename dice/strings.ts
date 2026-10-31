// Every user-facing string of the dice view, in one place so i18n can replace this table.
export const strings = {
  roll: 'Roll',
  reset: 'Reset',
  diceSet: 'Dice set',
  addDie: 'Add',
  removeDie: (label: string) => `Remove ${label}`,
  count: (label: string) => `Number of ${label}`,
  modifier: 'Modifier',
  history: 'Recent rolls',
  animationDuration: 'Animation length',
  seconds: (seconds: number) => `${seconds} s`,
  alwaysFullAnimation: 'Always play the full animation (ignore reduced motion)',
  dieLabel: (sides: number) => `d${sides}`,
};
