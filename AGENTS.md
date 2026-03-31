# Repository Guidelines

## Project Structure & Module Organization
- `platforms/web/`: Three.js static build (HTML/CSS/JS + `sourcemap.json`).
- `platforms/phaser/`: Phaser 3 + TypeScript + Vite; code in `src/` (`core/`, `scenes/`, `objects/`, `ui/`, `utils/`, `types/`); `@/` aliases map here.
- `platforms/wechat/`: Phaser mini-program with Webpack adapters (`weapp-adapter.js`, `weapp-phaser3-adapter.js`); entry `src/index.ts`, bundle in `dist/` for DevTools.
- `cloudfunctions/`: Mini-program cloud functions (`fetchLeaderboard`, `submitScore`) and DB rules template.
- Shared assets `assets/audio/`; docs in `docs/`; helper scripts in `tools/` (e.g., `start-debug-server.js`).

## Build, Test, and Development Commands
- Root web preview: `npm install` once, then `npm run dev` (live-server on `platforms/web`); `npm run debug` for verbose; `npm run start` uses Python SimpleHTTPServer.
- Phaser web/desktop: `cd platforms/phaser && npm install && npm run dev` (Vite :3000), `npm run build`, `npm run preview`, `npm run type-check`.
- WeChat mini-program: `cd platforms/wechat && npm install && npm run dev` (webpack-dev-server) or `npm run build`; load `dist/` in WeChat DevTools.
- Cloud functions: deploy/test via WeChat cloud console; baseline rules in `cloudfunctions/db.rules.example.json`.

## Coding Style & Naming Conventions
- TypeScript/ESM; prefer 4-space indent and single quotes (see `src/main.ts`); keep imports tidy and type public APIs.
- Classes PascalCase; variables/functions camelCase; filenames kebab/lowercase in web assets and PascalCase for TS scenes.
- Use `@/` aliases rather than deep relatives; guard DOM assumptions for WeChat (no full browser APIs).

## Testing Guidelines
- No automated suite; rely on manual runs. Always execute the relevant build (`npm run build` in Phaser/WeChat) to ensure types and bundles pass.
- Smoke test gameplay via `npm run dev`: orbital jumps, scoring, audio, game-over flow; check both touch and mouse.
- For cloudfunctions, exercise leaderboard fetch/submit in the emulator and confirm rules remain intact.

## Commit & Pull Request Guidelines
- Concise, present-tense commits; prefer Conventional Commit scopes, e.g., `feat(phaser): tune jump timing`, `fix(wechat): guard canvas creation`.
- PRs: describe user-visible changes, affected platform(s), commands run; attach browser/DevTools screenshots or GIFs for UI changes; cite asset licenses.
- Keep diffs focused; note knock-on effects (config, adapters, cloudfunctions) and add rollback notes when altering tooling.

## Security & Configuration Tips
- Do not commit secrets or personal AppIDs; keep `project.private.config.json` local. Mask analytics keys and mini-program credentials.
- Place large assets under `assets/` with clear licensing; prefer compressed audio. Avoid logging sensitive user identifiers in cloud functions.
