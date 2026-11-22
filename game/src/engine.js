/**
 * The duel engine: state, legality, and everything a play does.
 * Pure state transitions; rendering and animation live elsewhere.
 */
import { buildDeck } from './cards.js';
import { makeRng, shuffle } from './rng.js';

export const MAX_MANA = 8;
export const BOARD_LIMIT = 5;
export const START_HP = 25;
export const HAND_LIMIT = 7;
export const START_HAND = 4;
export const MINE = 'mine';
export const FOE = 'foe';

/** A fresh side of the board: hero, deck, hand and minions. */
function makeSide(rng) {
  return {
    hp: START_HP,
    mana: 0,
    manaCap: 0,
    deck: shuffle(buildDeck(), rng),
    hand: [],
    minions: [],
    fatigue: 0,
  };
}

/** A whole duel: both sides, whose turn it is, and how it ended. */
export function newGame(seed) {
  const rng = makeRng(seed);
  const state = {
    seed,
    rng,
    turn: MINE,
    turnNo: 1,
    over: false,
    winner: null,
    log: [],
    sides: { [MINE]: makeSide(rng), [FOE]: makeSide(rng) },
  };
  drawCards(state, MINE, START_HAND);
  drawCards(state, FOE, START_HAND);
  beginTurn(state, state.turn);
  return state;
}

export function other(side) {
  return side === MINE ? FOE : MINE;
}

/** A card instance on the table: hand cards and minions carry instance ids. */
let nextUid = 1;
export function stamp(card) {
  return { uid: nextUid, ...card, atk: card.atk ?? null, hp: card.hp ?? null };
}

export function drawCards(state, side, count) {
  const me = state.sides[side];
  for (let i = 0; i < count; i += 1) {
    if (me.deck.length === 0) {
      me.fatigue += 1;
      damageHero(state, side, me.fatigue, 'burnout');
      continue;
    }
    const card = stamp(me.deck.pop());
    if (me.hand.length < HAND_LIMIT) me.hand.push(card);
  }
}

export function beginTurn(state, side) {
  state.turn = side;
  const me = state.sides[side];
  me.manaCap = Math.min(MAX_MANA, me.manaCap + 1);
  me.mana = me.manaCap;
  me.minions.forEach((m) => { m.attacked = false; m.justPlayed = false; });
  drawCards(state, side, 1);
  if (side === FOE) me.hand.forEach((c) => { c.revealed = true; });
}

export function endTurn(state) {
  state.turnNo += 1;
  beginTurn(state, other(state.turn));
}

/** Can the acting side legally play this hand card right now? */
export function canPlay(state, side, card) {
  if (state.over || state.turn !== side) return false;
  if (card.cost > state.sides[side].mana) return false;
  if (card.kind === 'kindred') return state.sides[side].minions.length < BOARD_LIMIT;
  return true;
}

/** Everything one play does, in order, with the log lines it speaks. */
export function playCard(state, side, uid, targetUid = null) {
  const me = state.sides[side];
  const index = me.hand.findIndex((c) => c.uid === uid);
  if (index === -1) return false;
  const card = me.hand[index];
  if (!canPlay(state, side, card)) return false;

  me.mana -= card.cost;
  me.hand.splice(index, 1);

  if (card.kind === 'rite') {
    applyRite(state, side, card, targetUid);
  } else {
    summon(state, side, card);
    if (card.keyword === 'Burn') damageHero(state, other(side), 2, 'burn');
  }
  return true;
}

function summon(state, side, card) {
  const minion = stamp(card);
  minion.justPlayed = true;
  minion.attacked = false;
  state.sides[side].minions.push(minion);
  say(state, `${card.name} answers the call.`);
}

export function applyRite(state, side, card, targetUid) {
  const { verb, amount, sweep } = card.effect;
  const foeSide = other(side);
  if (verb === 'sear') {
    if (sweep) {
      state.sides[foeSide].minions.forEach((m) => damageMinion(state, foeSide, m, amount));
      say(state, `${card.name} scours the enemy line.`);
    } else {
      const minion = findMinion(state, foeSide, targetUid) ?? firstTarget(state, foeSide);
      if (minion) {
        damageMinion(state, foeSide, minion, amount);
        say(state, `${card.name} strikes ${minion.name}.`);
      } else {
        damageHero(state, foeSide, amount, 'sear');
        say(state, `${card.name} sears the enemy queen.`);
      }
    }
  } else if (verb === 'mend') {
    state.sides[side].hp = Math.min(START_HP, state.sides[side].hp + amount);
    say(state, `${card.name} mends ${amount} hearts.`);
  } else if (verb === 'bless') {
    state.sides[side].minions.forEach((m) => { m.atk += amount; m.hp += amount; });
    say(state, `${card.name} emboldens your line.`);
  } else if (verb === 'draw') {
    drawCards(state, side, amount);
    say(state, `${card.name} reveals what comes.`);
  }
}

/** Is `minion` a legal attack target? Guard protects the queen and its kin. */
export function isTargetable(state, foeSide, minion) {
  if (minion.keyword === 'Guard') return true;
  return !state.sides[foeSide].minions.some((m) => m.keyword === 'Guard');
}

export function firstTarget(state, foeSide) {
  return state.sides[foeSide].minions.find((m) => isTargetable(state, foeSide, m)) ?? null;
}

/** One minion attacks: a chosen target, or the enemy queen if none left. */
export function attackWith(state, side, uid, targetUid = null) {
  if (state.over || state.turn !== side) return false;
  const me = state.sides[side];
  const minion = me.minions.find((m) => m.uid === uid);
  if (!minion) return false;
  if (minion.justPlayed && minion.keyword !== 'Swift') return false;
  if (minion.attacked) return false;

  const foeSide = other(side);
  let target = null;
  if (targetUid !== null) {
    target = state.sides[foeSide].minions.find((m) => m.uid === targetUid);
    if (target && !isTargetable(state, foeSide, target)) return false;
  }
  if (!target && state.sides[foeSide].minions.some((m) => m.keyword === 'Guard' && !m.justPlayed)) {
    return false; // an enemy Guard is up: only Guards may be struck
  }

  minion.attacked = true;
  if (target) {
    minion.hp -= target.atk;
    target.hp -= minion.atk;
    say(state, `${minion.name} clashes with ${target.name}.`);
  } else {
    damageHero(state, foeSide, minion.atk, 'strike');
    say(state, `${minion.name} strikes the queen for ${minion.atk}.`);
  }
  reap(state);
  return true;
}

export function damageHero(state, side, amount, cause) {
  state.sides[side].hp -= amount;
  say(state, `${side === MINE ? 'Bram' : 'Vexa'} takes ${amount} (${cause}).`);
  checkOver(state);
}

export function damageMinion(state, side, minion, amount) {
  minion.hp -= amount;
}

/** Remove the fallen and settle the duel. */
export function reap(state) {
  for (const side of [MINE, FOE]) {
    const lane = state.sides[side];
    lane.minions = lane.minions.filter((m) => m.hp > 0);
  }
  checkOver(state);
}

function checkOver(state) {
  if (state.over) return;
  if (state.sides[MINE].hp <= 0 && state.sides[FOE].hp <= 0) {
    state.over = true;
    state.winner = state.turn === MINE ? FOE : MINE; // the striker finishes first
  } else if (state.sides[FOE].hp <= 0) {
    state.over = true;
    state.winner = MINE;
  } else if (state.sides[MINE].hp <= 0) {
    state.over = true;
    state.winner = FOE;
  }
}

export function findMinion(state, side, uid) {
  return state.sides[side].minions.find((m) => m.uid === uid) ?? null;
}

function say(state, line) {
  state.log.push(line);
  if (state.log.length > 40) state.log.shift();
}
