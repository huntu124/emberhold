/**
 * Vexa's mind: a readable opponent. She values a trade by what her minion
 * survives, spends rites where they hurt most, and goes face when the line
 * is clear — so her choices can be read and countered.
 */
import {
  FOE, MINE, BOARD_LIMIT, attackWith, canPlay, endTurn, findMinion, isTargetable,
  other, playCard, reap,
} from './engine.js';

/**
 * One AI turn. Each action resolves immediately; the callback paints between
 * actions so the player can follow what she does.
 * @param {object} state   engine state (state.turn must be FOE)
 * @param {number} seedGap unused placeholder for symmetry with scenes
 * @param {Function} paint called after each action
 */
export function runFoeTurn(state, paint) {
  return new Promise((resolve) => {
    const acts = planTurn(state);
    let i = 0;
    const step = () => {
      if (i >= acts.length || state.over) {
        if (!state.over) endTurn(state);
        resolve();
        return;
      }
      const act = acts[i];
      act(state);
      i += 1;
      paint();
      setTimeout(step, 650);
    };
    setTimeout(step, 650);
  });
}

/**
 * Read the board and choose a full plan up front. Because the plan is decided
 * before acting, later draws are not peeked at — she plays only what she sees.
 */
export function planTurn(state) {
  const acts = [];
  const me = state.sides[FOE];
  const foe = state.sides[MINE];

  const trades = [];
  for (const mine of me.minions) {
    if (mine.justPlayed && mine.keyword !== 'Swift') continue;
    for (const theirs of foe.minions) {
      if (!isTargetable(state, MINE, theirs)) continue;
      const worth = mine.atk >= theirs.hp ? theirs.atk : 0;
      const loss = theirs.atk >= mine.hp ? mine.atk : 0;
      trades.push({ mine, theirs, score: worth - loss });
    }
  }
  trades.sort((a, b) => b.score - a.score);
  const wanted = new Set(trades.filter((t) => t.score > 0).map((t) => t.mine.uid));

  const hand = me.hand.slice().sort((a, b) => b.cost - a.cost);
  for (const card of hand) {
    if (!canPlay(state, FOE, card)) continue;
    if (card.kind === 'rite') {
      const verb = card.effect.verb;
      if (verb === 'sear' && !card.effect.sweep) {
        // pick the enemy minion her attack cannot finish, or stockpile for face
        const hurtiest = foe.minions
          .filter((m) => isTargetable(state, MINE, m) && m.hp > 0)
          .sort((a, b) => (b.atk - a.atk) || (a.hp - b.hp))[0];
        const uid = hurtiest && hurtiest.hp <= card.effect.amount ? hurtiest.uid
          : (hurtiest && hurtiest.atk >= 4 ? hurtiest.uid : null);
        acts.push((s) => playCard(s, FOE, card.uid, uid));
      } else if (verb === 'sear' && card.effect.sweep && foe.minions.length >= 2) {
        acts.push((s) => playCard(s, FOE, card.uid));
      } else if (verb === 'mend' && me.hp <= 12) {
        acts.push((s) => playCard(s, FOE, card.uid));
      } else if (verb === 'bless' && me.minions.length >= 2) {
        acts.push((s) => playCard(s, FOE, card.uid));
      } else if (verb === 'draw' && me.hand.length <= 4) {
        acts.push((s) => playCard(s, FOE, card.uid));
      }
    } else {
      acts.push((s) => playCard(s, FOE, card.uid));
    }
  }

  // attacks: trades she marked, then everything else at the queen
  for (const mine of me.minions) {
    if (mine.justPlayed && mine.keyword !== 'Swift') continue;
    const trade = trades.find((t) => t.mine.uid === mine.uid && wanted.has(mine.uid));
    if (trade) {
      acts.push((s) => attackWith(s, FOE, mine.uid, trade.theirs.uid));
    } else {
      acts.push((s) => attackWith(s, FOE, mine.uid, null));
    }
  }

  return acts.filter((fn) => fn !== undefined);
}

export const foeConstants = { FOE, MINE, BOARD_LIMIT, other, findMinion, reap };
