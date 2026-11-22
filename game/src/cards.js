/**
 * Emberhold card pool. Two schools of small gods:
 *  - kindreds (minions) bear attack, health and a keyword: Guard, Swift or Burn.
 *  - rites (spells) act once and vanish: sear, mend, bless or draw.
 * Every name, line of flavour text and number here is original to Emberhold.
 */

/** Keyword badges and their css classes, in the order a card shows them. */
export const KEYWORDS = {
  Guard: { hint: 'Enemies must fight this first.', css: 'kw-guard' },
  Swift: { hint: 'Strikes the turn it arrives.', css: 'kw-swift' },
  Burn: { hint: 'Sears the enemy queen for 2 when played.', css: 'kw-burn' },
};

/** One ember kindred (minion). */
function kindred(name, cost, atk, hp, keyword, flavour) {
  return { name, cost, atk, hp, keyword, flavour, kind: 'kindred' };
}

/** One ember rite (spell). */
function rite(name, cost, effect, flavour) {
  return { name, cost, effect, flavour, kind: 'rite' };
}

/**
 * The pool the decks draw from. `effect` rites name one of RITES' verbs
 * (sear/mend/bless/draw) with a magnitude, applied by the engine.
 */
export const CARDS = [
  kindred('Cinder Pup', 1, 2, 1, null, 'It sleeps in the flue and dreams of arson.'),
  kindred('Hearth Rat', 1, 1, 3, 'Guard', 'Small, stubborn, always in the way.'),
  kindred('Tinder Imp', 2, 3, 2, 'Burn', 'Bought a candle, lost a house.'),
  kindred('Ashling Scout', 2, 2, 3, 'Swift', 'Runs the chimney lane at dusk.'),
  kindred('Soot Knight', 3, 2, 5, 'Guard', 'Armour of yesterday\'s fires.'),
  kindred('Grate Warden', 3, 4, 3, null, 'Keeps the bars and the tempers.'),
  kindred('Flue Serpent', 3, 3, 3, 'Swift', 'It waits where the smoke thickens.'),
  kindred('Bellows Giant', 4, 4, 5, 'Guard', 'One breath stokes a street.'),
  kindred('Ember Drake', 4, 5, 3, 'Burn', 'Hatched in a baker\'s ruin.'),
  kindred('Forge Sister', 5, 5, 5, null, 'Two hammers, one rhythm.'),
  kindred('Pyre Colossus', 6, 7, 6, 'Guard', 'It remembers every fire it fed.'),
  kindred('Kiln Titan', 7, 8, 8, 'Burn', 'The oven that outlived the bakery.'),

  rite('Spark Lash', 2, { verb: 'sear', amount: 3 }, 'A whip of struck flint.'),
  rite('Warm Loaf', 2, { verb: 'mend', amount: 4 }, 'Bread heals what fire ruins.'),
  rite('Coax the Coals', 3, { verb: 'bless', amount: 2 }, 'Every ember, one size larger.'),
  rite('Chimney Wind', 3, { verb: 'sear', amount: 2, sweep: true }, 'A draught that touches every foe.'),
  rite('Read the Flames', 2, { verb: 'draw', amount: 2 }, 'The fire tells you what comes next.'),
  rite('Kindle Storm', 5, { verb: 'sear', amount: 5 }, 'The night the hearth stood up.'),
];

/**
 * A fresh 20-card deck: one of each rare sight and weighted copies of the
 * cheap workhorses, so early turns always offer a play.
 */
export function buildDeck() {
  const weights = {
    'Cinder Pup': 2, 'Hearth Rat': 2, 'Tinder Imp': 2, 'Ashling Scout': 2,
    'Soot Knight': 2, 'Grate Warden': 2, 'Flue Serpent': 2, 'Bellows Giant': 1,
    'Ember Drake': 1, 'Forge Sister': 1, 'Pyre Colossus': 1, 'Kiln Titan': 1,
    'Spark Lash': 1, 'Warm Loaf': 1, 'Coax the Coals': 1, 'Chimney Wind': 1,
    'Read the Flames': 1, 'Kindle Storm': 1,
  };
  const deck = [];
  for (const [name, count] of Object.entries(weights)) {
    for (let i = 0; i < count; i += 1) deck.push(CARDS.find((c) => c.name === name));
  }
  return deck;
}
