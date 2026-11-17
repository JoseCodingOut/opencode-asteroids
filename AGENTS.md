# Repository notes

- This is a static browser game: open `index.html` directly. There is no package manifest, bundler, or install step; `index.html` loads `game.js` as a classic script.
- Gameplay, input, state, collisions, rendering, and the `requestAnimationFrame` loop all live in `game.js`. The canvas is fixed at 800×600 in both `index.html` and the `W`/`H` constants in `game.js`; keep these aligned if resizing.
- `Space` is consumed through `pressed('Space')` (one keydown edge), not held-key input. Movement reads held keys from `keys`. Preserve that distinction when changing controls or shooting.
- The README mentions power-ups and a shooting star, but neither exists in the current code. Verify feature claims against `game.js` rather than assuming the README describes implemented behavior.
- There are no configured test, lint, build, or typecheck scripts. For JavaScript syntax, run `node --check game.js`; verify gameplay changes manually in a browser.
