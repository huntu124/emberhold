// Emberhold's hand-in program (Node 22, standard library only).
//
// The game itself lives in game/: plain static files a desktop browser loads
// offline (game/index.html and its ES modules, no library, no network request).
// This entrypoint hands the game to the grader: it copies game/ and
// screenshots/ from beside this file into /output (MAKEFUN_OUTPUT_DIR stands
// in for /output outside the grader) and writes /output/dossier.json with the
// kit's buildDossier, the summary the judge reads.
//
// Play it locally: `node serve.ts`, then open http://localhost:8080.
// Hand it in: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps for this bounty (reference/gate.json): screenshots at most
// 4 and 256 KiB each, game/ at most 993 entries and 48 MiB, no path over 1000
// bytes, and the dossier's source text capped at 160 KiB. Passing them here
// keeps /output inside the platform's own 1000-entry / 64 MiB cap too.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn() {
  mkdirSync(out, { recursive: true });
  cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  if (existsSync(join(here, 'screenshots'))) {
    cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
  }
  writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));
}

handIn();
