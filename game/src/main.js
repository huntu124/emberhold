/**
 * Emberhold main: the game's state machine. Title screen, the player's turns
 * (click a card, click a target, end turn), Vexa's scripted replies, and the
 * win and loss screens. ?shot=<scene>&seed=<n> renders a screenshot scene.
 */
import { MINE, FOE, attackWith, canPlay, newGame, other, playCard } from './engine.js';
import { runFoeTurn } from './ai.js';
import { floater, centreOf } from './anim.js';
import { mount, render, showScreen, domFor, handElFor, heroEl, endTurnButton } from './render.js';
import { SCENES } from './scenes.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? Date.now()) || 1;
const shot = params.get('shot');

let state = null;
let targeting = null; // a rite or attacker awaiting its target: { kind, uid }
let busy = false;

mount();

function isPlayable(card) {
  return canPlay(state, MINE, card);
}

function paint() {
  render(state, {
    isPlayable,
    selected: targeting ? targeting.uid : null,
    targeting: targeting ? { fromSide: MINE } : null,
    onCardClick,
    onMinionClick,
  });
}

function onCardClick(card) {
  if (busy || state.over) return;
  if (!isPlayable(card)) return;
  targeting = { kind: card.kind, uid: card.uid };
  paint();
  if (card.kind === 'rite' && card.effect.verb === 'sear' && !card.effect.sweep) {
    // rites need a target: wait for one (the queen counts as no-target = face)
  } else {
    commitPlay(card.uid, null);
  }
}

function onMinionClick(minion, side) {
  if (busy || state.over) return;
  if (side === MINE && targeting) {
    // a minion of ours clicked while a card is selected: treat as no-target play
    commitPlay(targeting.uid, null);
    return;
  }
  if (side === FOE && targeting) {
    commitPlay(targeting.uid, minion.uid);
    return;
  }
  if (side === MINE) {
    attackFace(minion);
  }
}

function commitPlay(uid, targetUid) {
  const card = state.sides[MINE].hand.find((c) => c.uid === uid);
  if (!card) return;
  busy = true;
  try {
    const from = handElFor(uid);
    if (from) from.classList.add('selected');
    const ok = playCard(state, MINE, uid, targetUid);
    targeting = null;
    paint();
    if (ok) {
      floater(`-${card.cost}`, ...Object.values(centreOf(from)), '#7ad0ff');
    }
  } finally {
    busy = false;
  }
  checkEnd();
}

function attackFace(minion) {
  if (minion.justPlayed && minion.keyword !== 'Swift') return;
  if (minion.attacked) return;
  busy = true;
  try {
    const el = domFor(state, MINE, minion.uid);
    const guardUp = state.sides[FOE].minions.some((m) => m.keyword === 'Guard');
    if (guardUp) {
      targeting = { kind: 'attacker', uid: minion.uid };
      paint();
      return;
    }
    const ok = attackWith(state, MINE, minion.uid, null);
    paint();
    if (ok && el) {
      const p = centreOf(heroEl(FOE));
      floater(`-${minion.atk}`, p.x, p.y, '#e5604a');
    }
  } finally {
    busy = false;
  }
  checkEnd();
}

// An attacker with a target pending: the next foe click resolves the attack.
const originalOnMinionClick = onMinionClick;
onMinionClick = function patched(minion, side) {
  if (targeting && targeting.kind === 'attacker' && side === FOE) {
    const ok = attackWith(state, MINE, targeting.uid, minion.uid);
    targeting = null;
    paint();
    if (ok) {
      const p = centreOf(domFor(state, FOE, minion.uid));
      floater(`-${minion.atk}`, p.x, p.y, '#e5604a');
    }
    checkEnd();
    return;
  }
  originalOnMinionClick(minion, side);
};

function checkEnd() {
  if (!state.over) return;
  setTimeout(() => {
    showScreen(state.winner === MINE ? 'win' : 'loss');
    paint();
    markReady();
  }, 700);
}

async function startDuel() {
  state = newGame(seed);
  targeting = null;
  showScreen(null);
  paint();
  await maybeFoeTurn();
}

async function maybeFoeTurn() {
  if (state.over || state.turn !== FOE) {
    paint();
    markReady();
    return;
  }
  busy = true;
  paint();
  await runFoeTurn(state, paint);
  busy = false;
  paint();
  checkEnd();
  markReady();
}

endTurnButton().addEventListener('click', async () => {
  if (busy || state.over || state.turn !== MINE) return;
  const { endTurn } = await import('./engine.js');
  endTurn(state);
  targeting = null;
  paint();
  await maybeFoeTurn();
});

document.getElementById('btn-start').addEventListener('click', startDuel);
document.getElementById('btn-again-win').addEventListener('click', startDuel);
document.getElementById('btn-again-loss').addEventListener('click', startDuel);

/** The screenshot harness waits on this. */
window.__shotReady = false;
function markReady() {
  if (shot) window.__shotReady = true;
}

/** Debug hook for headless play testing. */
window.__emberhold = () => state && ({
  screen: targeting ? 'targeting' : (state.over ? state.winner : state.turn),
  turn: state.turnNo,
  myHp: state.sides[MINE].hp,
  foeHp: state.sides[FOE].hp,
  myHand: state.sides[MINE].hand.length,
  myMinions: state.sides[MINE].minions.length,
  foeMinions: state.sides[FOE].minions.length,
  over: state.over,
  winner: state.winner,
});

if (shot && SCENES[shot]) {
  const scene = SCENES[shot](seed);
  state = scene.state;
  showScreen(scene.screen);
  paint();
  markReady();
} else {
  state = newGame(seed);
  showScreen('title');
  paint();
  markReady();
}
