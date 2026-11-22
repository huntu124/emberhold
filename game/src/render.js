/**
 * Rendering: paint the engine state into the DOM every beat. Two lanes of
 * minions, the hand as real cards, mana gems, and the overlay screens.
 */
import { FOE, HAND_LIMIT, MINE, MAX_MANA } from './engine.js';
import { KEYWORDS } from './cards.js';

const laneEls = { [MINE]: null, [FOE]: null };
let refs = null;

/** Cache the static DOM once. */
export function mount() {
  refs = {
    foeHp: document.getElementById('foe-hp'),
    myHp: document.getElementById('my-hp'),
    foeMana: document.getElementById('foe-mana'),
    myMana: document.getElementById('my-mana'),
    foeDeck: document.getElementById('foe-deck'),
    myDeck: document.getElementById('my-deck'),
    laneFoe: document.getElementById('lane-foe'),
    laneMine: document.getElementById('lane-mine'),
    hand: document.getElementById('hand'),
    log: document.getElementById('log'),
    banner: document.getElementById('turn-banner'),
    overlay: document.getElementById('overlay'),
    screens: {
      title: document.getElementById('screen-title'),
      win: document.getElementById('screen-win'),
      loss: document.getElementById('screen-loss'),
    },
    endTurn: document.getElementById('end-turn'),
  };
  laneEls[MINE] = refs.laneMine;
  laneEls[FOE] = refs.laneFoe;
}

export function endTurnButton() {
  return refs.endTurn;
}

export function showScreen(name) {
  Object.entries(refs.screens).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== name);
  });
  refs.overlay.classList.toggle('hidden', name === null);
}

/** One full paint of the duel. */
export function render(state, hooks) {
  const mine = state.sides[MINE];
  const foe = state.sides[FOE];

  refs.myHp.textContent = Math.max(0, mine.hp);
  refs.foeHp.textContent = Math.max(0, foe.hp);
  refs.myDeck.textContent = `${mine.deck.length}`;
  refs.foeDeck.textContent = `${foe.deck.length}`;

  renderMana(refs.myMana, mine.mana, mine.manaCap);
  renderMana(refs.foeMana, foe.mana, foe.manaCap);

  refs.banner.textContent = state.over
    ? (state.winner === MINE ? 'The ember is yours' : 'The hearth goes dark')
    : (state.turn === MINE ? 'Your turn' : "Vexa's turn");
  refs.endTurn.disabled = state.over || state.turn !== MINE;

  renderLane(state, FOE, hooks);
  renderLane(state, MINE, hooks);
  renderHand(state, hooks);

  const last = state.log[state.log.length - 1] ?? '';
  if (refs.log.textContent !== last) refs.log.textContent = last;
}

function renderMana(el, mana, cap) {
  const html = [];
  for (let i = 0; i < MAX_MANA; i += 1) {
    html.push(`<div class="gem ${i < mana ? '' : 'spent'} ${i >= cap ? 'locked' : ''}"></div>`);
  }
  el.innerHTML = html.join('');
}

function renderLane(state, side, hooks) {
  const lane = laneEls[side];
  const minions = state.sides[side].minions;
  lane.replaceChildren(...minions.map((m) => minionEl(state, side, m, hooks)));
}

/** A minion on the table. */
function minionEl(state, side, minion, hooks) {
  const el = document.createElement('div');
  el.className = 'minion';
  el.dataset.uid = String(minion.uid);
  const art = artEl(minion.name, true);
  el.appendChild(art);

  if (minion.keyword) {
    const tag = document.createElement('span');
    tag.className = `keyword-tag ${KEYWORDS[minion.keyword].css}`;
    tag.textContent = minion.keyword;
    el.appendChild(tag);
  }

  const name = document.createElement('div');
  name.className = 'm-name';
  name.textContent = minion.name;
  el.appendChild(name);

  const atk = document.createElement('div');
  atk.className = 'm-atk';
  atk.textContent = String(minion.atk);
  el.appendChild(atk);

  const hp = document.createElement('div');
  hp.className = 'm-hp';
  hp.textContent = String(minion.hp);
  el.appendChild(hp);

  const mine = side === MINE;
  const ready = mine && state.turn === MINE && !state.over
    && !minion.justPlayed && !minion.attacked;
  if (ready) el.classList.add('ready', 'can-attack');
  if (hooks && hooks.onMinionClick && (ready || hooks.targeting)) {
    el.addEventListener('click', () => hooks.onMinionClick(minion, side));
  }
  if (hooks && hooks.targeting && side !== hooks.targeting.fromSide) {
    el.classList.add('targetable');
  }
  return el;
}

/** A hand card, playable or not. */
function renderHand(state, hooks) {
  const me = state.sides[MINE];
  const cards = me.hand.slice(0, HAND_LIMIT);
  refs.hand.replaceChildren(...cards.map((card) => cardEl(state, card, hooks)));
}

function cardEl(state, card, hooks) {
  const el = document.createElement('div');
  el.className = `card ${card.kind === 'rite' ? 'spell' : ''}`;
  el.dataset.uid = String(card.uid);
  const playable = hooks && hooks.isPlayable ? hooks.isPlayable(card) : false;
  if (!playable) el.classList.add('unplayable');
  if (hooks && hooks.selected === card.uid) el.classList.add('selected');

  const cost = document.createElement('div');
  cost.className = 'c-cost';
  cost.textContent = String(card.cost);
  el.appendChild(cost);

  el.appendChild(artEl(card.name));

  const name = document.createElement('div');
  name.className = 'c-name';
  name.textContent = card.name;
  el.appendChild(name);

  if (card.kind === 'kindred') {
    const text = document.createElement('div');
    text.className = 'c-text';
    text.textContent = card.flavour;
    el.appendChild(text);

    const atk = document.createElement('div');
    atk.className = 'c-atk';
    atk.textContent = String(card.atk);
    el.appendChild(atk);

    const hp = document.createElement('div');
    hp.className = 'c-hp';
    hp.textContent = String(card.hp);
    el.appendChild(hp);
  } else {
    const text = document.createElement('div');
    text.className = 'c-text';
    text.textContent = card.flavour;
    el.appendChild(text);
  }

  if (playable && hooks && hooks.onCardClick) {
    el.addEventListener('click', () => hooks.onCardClick(card));
  }
  return el;
}

/**
 * Original card art, one gradient-and-shape composition per name: no images,
 * no network, and every card told apart by colour and shape.
 */
const ART = {
  'Cinder Pup': ['radial-gradient(circle at 60% 40%, #ffb46a, #b03a1e 75%)', '#3a1208'],
  'Hearth Rat': ['linear-gradient(140deg, #8a7a6a, #4a3a30 70%)', '#241c14'],
  'Tinder Imp': ['radial-gradient(circle at 40% 35%, #ff8a4c, #7a2010 80%)', '#2a0c04'],
  'Ashling Scout': ['linear-gradient(160deg, #b8d0d8, #5a7a8a 75%)', '#1e2c34'],
  'Soot Knight': ['linear-gradient(150deg, #6a6a72, #2e2e36 75%)', '#14141a'],
  'Grate Warden': ['repeating-linear-gradient(90deg, #b8863a 0 8px, #3a2a14 8px 16px)', '#1c1408'],
  'Flue Serpent': ['conic-gradient(from 120deg, #4a9a6a, #1c3a28, #4a9a6a)', '#0c1a10'],
  'Bellows Giant': ['linear-gradient(180deg, #c0a878, #6a5232 80%)', '#2e2414'],
  'Ember Drake': ['radial-gradient(circle at 55% 45%, #ffd76a, #c04818 70%)', '#301404'],
  'Forge Sister': ['linear-gradient(120deg, #d8a04a, #8a4a2a 60%, #d8a04a)', '#2a1608'],
  'Pyre Colossus': ['radial-gradient(circle at 50% 60%, #ff9a4c, #50180a 85%)', '#1c0804'],
  'Kiln Titan': ['linear-gradient(160deg, #e07a3a, #6a2010 80%)', '#240a04'],
  'Spark Lash': ['conic-gradient(from 30deg, #ffd76a, #b03a1e, #ffd76a)', '#2a1004'],
  'Warm Loaf': ['radial-gradient(circle at 45% 40%, #f0d090, #b08040 75%)', '#3a2a10'],
  'Coax the Coals': ['radial-gradient(circle at 50% 50%, #ffb46a, #8a3a20 70%)', '#2e1206'],
  'Chimney Wind': ['linear-gradient(170deg, #a8bcc8, #4a5a68 75%)', '#1c242c'],
  'Read the Flames': ['radial-gradient(circle at 50% 45%, #ff8a4c, #3a1a4a 80%)', '#160a1e'],
  'Kindle Storm': ['conic-gradient(#ff6a3c, #b01818, #ffb46a, #ff6a3c)', '#2a0804'],
};

function artEl(name, isMinion = false) {
  const art = document.createElement('div');
  art.className = isMinion ? 'm-art' : 'c-art';
  const [bg, ink] = ART[name] ?? ['#444', '#111'];
  art.style.background = bg;
  art.style.color = ink;
  art.innerHTML = `<svg viewBox="0 0 100 62" width="100%" height="100%" preserveAspectRatio="none">
    <circle cx="50" cy="34" r="18" fill="rgba(255,255,255,0.18)"/>
    <path d="M50 12 L58 34 L50 52 L42 34 Z" fill="rgba(255,255,255,0.28)"/>
  </svg>`;
  return art;
}

export function domFor(state, side, uid) {
  const lane = laneEls[side];
  const el = lane.querySelector(`[data-uid="${uid}"]`);
  return el;
}

export function handElFor(uid) {
  return refs.hand.querySelector(`[data-uid="${uid}"]`);
}

export function heroEl(side) {
  return document.getElementById(side === MINE ? 'hero-mine' : 'hero-foe');
}
