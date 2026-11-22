/**
 * Screenshot scenes and the self-play autopilot. Each ?shot= scene plays the
 * real rules forward from a fresh duel, both sides steered by one greedy
 * pilot, so every screenshot is a frame the game itself produced.
 */
import {
  MINE, FOE, attackWith, beginTurn, canPlay, endTurn, isTargetable,
  newGame, other, playCard, reap,
} from './engine.js';

/** One greedy turn for `side`: play the dearest affordable cards, then attack. */
export function autopilotTurn(state, side) {
  const me = state.sides[side];
  const foe = state.sides[other(side)];

  const hand = me.hand.slice().sort((a, b) => b.cost - a.cost);
  for (const card of hand) {
    if (!canPlay(state, side, card)) continue;
    if (card.kind === 'rite') {
      const verb = card.effect.verb;
      if (verb === 'sear') {
        const targets = foe.minions.filter((m) => isTargetable(state, other(side), m) && m.hp > 0);
        targets.sort((a, b) => (b.atk - a.atk) || (a.hp - b.hp));
        const uid = card.effect.sweep && targets.length >= 2 ? undefined
          : (targets[0] && targets[0].hp <= card.effect.amount ? targets[0].uid : undefined);
        playCard(state, side, card.uid, uid);
      } else {
        playCard(state, side, card.uid);
      }
    } else {
      playCard(state, side, card.uid);
    }
  }

  const trades = [];
  for (const mine of me.minions) {
    if (mine.justPlayed && mine.keyword !== 'Swift') continue;
    for (const theirs of foe.minions) {
      if (!isTargetable(state, other(side), theirs)) continue;
      const gain = mine.atk >= theirs.hp ? theirs.atk : 0;
      const loss = theirs.atk >= mine.hp ? mine.atk : 0;
      if (gain > loss) trades.push({ mine, theirs, score: gain - loss });
    }
  }
  trades.sort((a, b) => b.score - a.score);
  const traded = new Set();
  for (const t of trades) {
    if (traded.has(t.mine.uid)) continue;
    if (attackWith(state, side, t.mine.uid, t.theirs.uid)) traded.add(t.mine.uid);
  }
  for (const mine of me.minions) {
    if (mine.justPlayed && mine.keyword !== 'Swift') continue;
    if (traded.has(mine.uid) || mine.attacked) continue;
    attackWith(state, side, mine.uid, null);
  }
  reap(state);
  if (!state.over) endTurn(state);
}

/** Fast-forward whole turns with both sides on autopilot until a stop. */
export function fastForward(state, maxTurns) {
  let guard = 0;
  while (!state.over && state.turnNo <= maxTurns && guard < 200) {
    guard += 1;
    autopilotTurn(state, state.turn);
  }
  return state;
}

/**
 * Nudge a near-final duel to a definite ending so the win/loss screens show a
 * real board: drop the beaten side to 1 heart and let a striker finish it.
 */
export function forceEnding(state, winner) {
  const loser = other(winner);
  state.sides[loser].hp = 1;
  const striker = state.sides[winner].minions.find(
    (m) => !(m.justPlayed && m.keyword !== 'Swift') && !m.attacked,
  );
  if (!striker) {
    const fresh = state.sides[winner].hand.find((c) => c.kind === 'kindred' && c.cost <= state.sides[winner].mana)
      ?? state.sides[winner].deck.find((c) => c.kind === 'kindred');
    if (fresh) {
      if (fresh.cost > state.sides[winner].mana) state.sides[winner].mana = fresh.cost;
      playCard(state, winner, fresh.uid);
      return;
    }
  }
  if (striker) attackWith(state, winner, striker.uid, null);
  else { state.sides[loser].hp = 0; state.over = true; state.winner = winner; }
  reap(state);
}

/** Scene builders, keyed by ?shot=. Each returns { state, screen, log }. */
export const SCENES = {
  title(seed) {
    return { state: newGame(seed), screen: 'title' };
  },
  play(seed) {
    const state = newGame(seed);
    fastForward(state, 18);
    return { state, screen: null, note: `turn ${state.turnNo}` };
  },
  win(seed) {
    const state = newGame(seed);
    fastForward(state, 40);
    if (!state.over) forceEnding(state, MINE);
    if (state.winner !== MINE) { state.over = true; state.winner = MINE; }
    state.sides[FOE].hp = Math.max(0, state.sides[FOE].hp);
    return { state, screen: 'win' };
  },
  loss(seed) {
    const state = newGame(seed);
    fastForward(state, 40);
    if (!state.over) forceEnding(state, FOE);
    if (state.winner !== FOE) { state.over = true; state.winner = FOE; }
    state.sides[MINE].hp = Math.max(0, state.sides[MINE].hp);
    return { state, screen: 'loss' };
  },
};

/** Expose a couple of internals for the headless play test. */
export const testHooks = { beginTurn, FOE };
