# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@constellation-network/node-pilot` — an oclif-based CLI (`cpilot`) that installs, configures, runs, and self-heals a Constellation Network validator node on a Linux host. The node itself is the Tessellation JAR(s) running under Docker Compose; node-pilot orchestrates everything around it (env files, keystore, snapshot fast-forward, version migrations, systemd timers, in-container health check).

Published to npm with multiple dist-tags. The version string carries the tag: `0.23.0-testnet`, `*-intnet`, `*-omegatest`, or plain semver for `latest` (mainnet). `checkNodePilot.compareVersions` (`src/checks/check-pilot.ts`) parses the suffix to choose which dist-tag to compare against on upgrade.

Two publishable packages live here:
- root — `@constellation-network/node-pilot` (the CLI)
- `apps/health-check/` — `@constellation-network/node-pilot-health-check`, a separate package installed *inside* the Tessellation Docker image and invoked as the container's `HEALTHCHECK` (`cpilotHC`). It has its own `package.json`, `tsconfig.json`, `yarn.lock`, and `dist/`.

## Commands

Node ≥ 22.3.0. Uses Yarn (yarn.lock).

```bash
yarn install              # install deps (root)
npm run build             # tsc -b → dist/
npm start                 # ./bin/dev.js — runs CLI from src/ via ts-node/esm
npm run debug             # same but with DEBUG=true (enables clm.debug output)
npm run lint              # eslint
npm test                  # mocha "test/**/*.test.ts"; posttest also runs lint
```

Run a single test:
```bash
npx mocha --forbid-only test/commands/status.test.ts
```

Dev-invoke a specific command (no global install needed):
```bash
./bin/dev.js status
./bin/dev.js restart gl0 --update
./bin/dev.js config get CL_EXTERNAL_IP
```

Health-check app (built separately, then bundled into the Tessellation Docker image via `projects/hypergraph/Dockerfile`):
```bash
cd apps/health-check && npm run build      # tsc → dist/
cd apps/health-check && npm run pub        # publish
```

Publish the CLI (testnet tag is the default in package.json):
```bash
npm run pub               # npm publish --access public --tag testnet
```

`npm run prepack` regenerates `oclif.manifest.json` and rewrites the command reference in `README.md` — don't hand-edit the `<!-- commands -->`…`<!-- commandsstop -->` section.

## Big-picture architecture

### Entry point and default-command shim

`bin/run.js` (prod) and `bin/dev.js` (ts-node) both perform the same trick: if the user typed `cpilot` with no args (or only flags), they splice `status` in as `argv[2]` before calling `@oclif/core` `execute`. That means **the no-arg invocation is the primary UX** — running `cpilot` triggers the full installation/configuration/healing flow in `src/commands/status.ts → checkInstallationAndConfigurationStatus()`. That function is a hand-ordered sequence of `checks/*` calls; ordering matters (initial setup → multi-user check → project install → version → migrations → java memory → network reachability → discord prompt → release version → keyfile → seedlist → cluster join state → layer status). When adding a new check, decide where in this pipeline it belongs.

### Two stores, one process

State is split between two `JSONStorage` instances (file-backed JSON via `node-localstorage`):

1. **Pilot store** at `~/.node-pilot/config` — owned by `PilotManager` (`src/helpers/pilot-manager.ts`). Tracks the list of installed projects, the active project, the `restarting` semaphore timestamp, the `running` projects list, and system info. Singleton constructed at import time.
2. **Project store** at `~/.node-pilot/<project>/config` — owned by `ConfigStore` (`src/config-store.ts`). Holds per-project network/env/layer/docker/project info, cluster stats, and feature flags. The active store is swapped via `configStore.setProjectConfig(path)` whenever `PilotManager.setActiveProject` changes projects. Before any project is selected, `configStore` is backed by `EmptyStorage` (a no-op subclass) — so `getX()` calls return `{}` rather than throwing.

This means a single `cpilot` process can iterate multiple projects (see `restart --autostart` / `--update`) by re-pointing the project store between them.

### Layered config — env, network-env, layer-env

`ConfigStore` separates env vars into three scopes:
- `env` — host-wide (`CL_EXTERNAL_IP`, key material)
- `network-env[network]` — per-network (`CL_APP_ENV`, peer info, collateral, token ID)
- `layer-env[network][layer]` — per-(network, layer) (ports, JVM opts, load balancer URL)

`projectHelper.importEnvFiles()` (`src/helpers/project-helper.ts`) walks `projects/<name>/networks/<network>/{network.env, <layer>.env}` and seeds all three. `projectHelper.generateLayerEnvFiles()` writes the merged `<projectDir>/<layer>.env` from these three layers via `getLayerEnvFileContent` (`src/helpers/env-templates.ts`); Docker Compose reads those files. Don't write merged env back to disk anywhere else.

`TessellationLayer` is `'cl1' | 'dl1' | 'gl0' | 'gl1' | 'ml0'` (`src/types.ts`) — these are also the Docker Compose `profile` names. `gl*` are global hypergraph layers; `ml0`/`cl1`/`dl1` are metagraph layers.

### Embedded projects

`projects/hypergraph/` is shipped inside the npm package (see `files` in `package.json`) and copied into the user's project dir on first install via `projectHelper.installEmbedded`. It contains the `Dockerfile`, `docker-compose.yml`, `entrypoint.sh`, network-specific `.env` files, and `scripts/install.sh` (downloads the Tessellation JARs from GitHub releases / S3). Upgrading the embedded project is what `projectHelper.upgradeHypergraph()` and migrations do — they re-copy the bundled files over the live project dir.

`source-nodes.env` files under `projects/hypergraph/networks/<net>/` are excluded from the npm tarball (`!**/source-nodes.env` in `package.json` files).

### Migrations

`src/services/migration-service.ts` maintains a `version → fn` map. Every `cpilot` run (after `checkVersion`) computes the semver range `(lastProjectVersion, currentPilotVersion]` and runs the matching migrations in order, then stamps `projectInfo.version = currentPilotVersion`. Add new entries to the `migrations` object when an upgrade needs to re-copy embedded files or reset a project flag.

### Self-healing in production: clm output routing and the "restarting" flag

`src/clm.ts` (Command Line Messaging) is the only sanctioned console wrapper. Crucially, it routes output through `pilotManager.isRestarting() ? serviceLog : console`. The `restarting` flag is a timestamp on the pilot store, set by `cpilot restart --autostart` / `--update` (driven by systemd timers — see `scripts/install_services.sh`). When set, all `clm.*` output goes to `~/.node-pilot/logs/...` via `serviceLog` instead of stdout. **Don't `console.log` directly** — it bypasses this routing and pollutes systemd journals. The flag auto-clears after 5 minutes (`isRestarting` in `pilot-manager.ts`) so a crashed scheduled run can't leave the system stuck.

### Systemd integration

`scripts/install_services.sh` installs three units (user-mode if non-root, system-mode if root):
- `restart-unhealthy.timer` — every minute, runs `docker restart` on containers with `health=unhealthy`
- `node-pilot-autostart.service` — runs `cpilot restart --autostart` at boot
- `node-pilot-update.service` — runs `cpilot restart --update` on a 5-minute restart loop, used for rolling upgrades

These exist because the validator node must self-recover; the in-container `cpilotHC` health check (the `apps/health-check` package) is the inner loop and these systemd units are the outer loop.

### Network calls — cluster vs. source node

`src/services/cluster-service.ts` is the abstraction over "talk to the cluster." `makeClusterRequestGet` prefers the configured load balancer (`CL_LB`) and falls back to a direct source node (`CL_L0_PEER_HTTP_HOST:CL_SOURCE_HTTP_PORT`) when no LB is set or LB calls fail. Use `makeRandomSourceNodeRequest` when you specifically want to hit an arbitrary cluster node (adds `?source_node=true&sticky=false`). The cluster vs source-node fallback is recent behavior (see commit `264dee1`) — preserve it when editing these methods.

### Shell command discipline

All shell-outs go through `src/services/shell-service.ts`. Use `runProjectCommand` (cwd = project dir) for anything that touches the project's Docker Compose state, `runCommand` for host-level commands, and `execDockerShell(layer, cmd)` for commands inside a running container. They respect `DEBUG=true` to surface output; otherwise they run silent and throw on non-zero exit. Don't reach for `shelljs` or `child_process` directly.

## Conventions

- **ESM-only.** `"type": "module"`, NodeNext resolution. Always import with explicit `.js` extension even when the source is `.ts` (TypeScript NodeNext requirement). Look at any existing import for the pattern.
- **TypeScript strict.** `tsconfig.json` has `strict: true`. The `dist/` folder is the publish artifact — don't commit edits to it; it's regenerated by `npm run build`.
- **Commands extend `BaseCommand` when they need `--project` handling** (`src/base-command.ts`), otherwise extend oclif's `Command` directly. The `status` command intentionally extends `Command` because it bootstraps project selection itself.
- **No direct console output.** Use `clm.echo / step / preStep / postStep / warn / error / debug` so logs route correctly during systemd-driven restarts. `clm.error` exits the process — use `clm.warn` for non-fatal messages.
- **oclif command discovery is pattern-based** (`"strategy": "pattern"` in package.json `oclif`). Files in `src/commands/**` auto-register; nested folders become subcommand topics (e.g., `src/commands/config/get.ts` → `cpilot config get`). The `topicSeparator` is a space, not a colon.
- **Lint config** — `eslint.config.mjs` extends `eslint-config-oclif` + prettier and disables `n/no-process-exit`, `unicorn/import-style`, `unicorn/no-process-exit`. The codebase legitimately calls `process.exit`; don't add lint suppressions for it.
- **Tests are oclif-style integration tests** using `@oclif/test`'s `runCommand`. They invoke the compiled command and assert on stdout. Most existing command tests are stubs — they don't yet assert real behavior.
