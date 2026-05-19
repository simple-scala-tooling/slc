# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A VS Code extension (TypeScript) that is an LSP **client only**. It launches an external Java-based language server (`simple-language-server`, a sibling repo at `../simple-language-server`) and wires it up for `.scala`, `.java`, `.mill`, `.sbt`, and `.sc` files. There is no in-repo server — the project was forked from Microsoft's `vscode-extension-samples` "multi-server" sample, and the original `server/` subdirectory was deleted in commit `2085007` ("Simplify to single workspace").

## Architecture notes worth knowing up front

- **Entry point**: `client/src/extension.ts`. `activate()` builds `serverOptions` and spawns a single `LanguageClient` over stdio. There is no per-workspace-folder multiplexing despite the `lspMultiServerSample.*` config keys inherited from the upstream sample.
- **Server jar path**: resolved relative to the extension via `context.asAbsolutePath("../simple-language-server/out/sls/assembly.dest/out.jar")`. This means the extension assumes the sibling `simple-language-server` repo is checked out *next to* this one and has been built (Mill produces the jar at that path).
- **Java binary**: hardcoded to an absolute `/nix/store/...openjdk-21.../bin/java` path in `extension.ts`. This will break outside the original Nix environment and is a known smell — prefer fixing it (e.g., resolve `java` from PATH or read from config) rather than working around it.
- **Two `package.json` files**: the root one declares the VS Code extension manifest (activation, languages, contributes), and `client/package.json` only carries the `vscode-languageclient` runtime dep. The root `postinstall` runs `npm install` inside `client/` to pull that in.

## Commands

Run everything from the repo root unless noted.

- **Install**: `npm install` (postinstall recurses into `client/`)
- **Build**: `npm run compile` — invokes `tsc -b` across the project references. Output lands in `client/out/`.
- **Watch**: `npm run watch` — incremental TypeScript builds; this is the default VS Code build task and the preLaunchTask for `Launch Client`.
- **Lint**: `npm run lint` — flat-config ESLint (`eslint.config.mjs`) with `typescript-eslint` and `@stylistic` rules; warns on missing curly/semis and enforces `_`-prefixed unused args.
- **Format**: `nix fmt` (treefmt: nixpkgs-fmt + prettier; configured in `flake.nix`). Prettier config is `.prettierrc`.
- **Run/debug the extension**: open the repo in VS Code → Run and Debug → `Launch Client`. This is the only launch config; there is no longer a server-attach config.

## Dev environment

A Nix flake provides the toolchain (Node 24, JDK 21). `direnv` is wired up via `.envrc`. If you are not using Nix you'll need a matching Node + JDK 21 on `PATH`, and you will also have to fix the hardcoded Java store path in `extension.ts` for the extension to actually run.

## Things to be aware of when editing

- The `package.json` `name`, `description`, `publisher`, and `lspMultiServerSample.*` config keys still reflect the upstream Microsoft `vscode-extension-samples` "multi-server" sample. None of them have been renamed to match the current single-server reality.
- No tests exist in this repo.
