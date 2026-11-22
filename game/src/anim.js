/**
 * Animation helpers: damage numbers, shakes, and the little delays that give
 * a play its weight. Pure presentation — the engine never waits on these.
 */

/** A floating number over a viewport point. */
export function floater(text, x, y, colour) {
  const el = document.createElement('div');
  el.className = 'floater';
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.color = colour ?? '#ffd76a';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

/** Mark every element in `list` with `cls`, then clear it after the animation. */
export function pulse(list, cls, ms) {
  const els = list.filter(Boolean);
  els.forEach((el) => el.classList.add(cls));
  setTimeout(() => els.forEach((el) => el.classList.remove(cls)), ms);
}

/** Read the css class each side's cards get, so floaters find their spot. */
export function centreOf(el) {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** The beat between an AI's actions and a card's arrival. */
export const BEAT = 220;
