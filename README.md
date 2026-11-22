# Cursor Off-Road Racing

A short high-desert time trial in the browser. Pick a Dune Buggy, a Jeep, or a 4-Wheeler, then run two laps. Packed dirt is fast. Sand and the shoulders are not. Rocks and cactus hit back.

The game is plain HTML, CSS, and JavaScript. There is no build step, so GitHub Pages can host it as-is.

## Play

Open `index.html` through a local server. ES modules do not load from a `file://` URL.

```bash
python3 -m http.server 8000
```

Then visit `http://127.0.0.1:8000`.

- **Gas:** W or Up
- **Brake / reverse:** S or Down
- **Steer:** A and D, or Left and Right
- **Pause:** P or Escape
- **Mute:** M, or the Sound button

On a phone, gas, brake, and steering buttons sit on the corners during the race. The best time is stored in `localStorage` on this browser.

Score starts at 12,000. Each second costs 80 points and each hit costs 500. The number saved as the record is the **time**, not the score.

## Tests

`tests.html` runs the suite in the browser. From the repo root, the same checks run in Node:

```bash
node js/tests.js
```

They cover circle collision, lap progress, the sand-versus-dirt speed gap, vehicle stats, best-time records, and a simulated lap that follows the racing line.

## GitHub Pages

1. Merge this branch into `main`.
2. In the repo on GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch `main` and folder `/ (root)`, then save.

The site will be at `https://marcbeacom.github.io/Cursor-Off-Road-Racing/`. Paths in the page are relative, so the project-site subpath works without a build.

## Layout

| File | Role |
| --- | --- |
| `index.html` | Screens, HUD, touch controls |
| `js/main.js` | Buttons and DOM updates |
| `js/game.js` | Loop and screen state |
| `js/entities.js` | Vehicle instances, race setup, dust |
| `js/input.js` | Keyboard and pedal state |
| `js/renderer.js` | Desert, track, and vehicle drawing |
| `js/physics.js` | Movement, collision, laps, score |
| `js/track.js` | The circuit and its obstacles |
| `js/vehicles.js` | The three rigs and their stats |
| `js/audio.js` | Synthesized engine, crash, and start tones |
| `js/storage.js` | Best times |
| `js/tests.js` | The checks above |

A new vehicle is an entry in `js/vehicles.js` plus a drawing branch in `js/renderer.js`. Power-ups and AI can sit beside the race update in `js/game.js` without changing the input or storage modules.

## This first version

- Closed two-lap loop, so a best time is easy to compare. No opponent yet.
- The third rig is a 4-wheeler. Its silhouette reads more clearly from above than a dirt bike.
- The camera follows behind the vehicle and turns with it.
- Sound is generated in the browser, so Pages does not need audio files.
