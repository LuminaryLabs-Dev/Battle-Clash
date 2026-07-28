# Active Goal

## Goal

Add and validate a GitHub Pages workflow that deploys the future production
build when `main` is pushed, without creating or pushing `main` now.

## Status

Complete. GitHub accepted the workflow and Pages now uses the Actions source.

## Success Criteria

- `.github/workflows/deploy-pages.yml` exists.
- The only automatic trigger is a push to `main`.
- The workflow uses the future npm build contract and uploads `dist/`.
- The workflow requires `dist/index.html` before deployment.
- The change is pushed only to `agent/planning-foundation`.
- No `main` branch is created or pushed.
