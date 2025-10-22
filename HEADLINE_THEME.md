# Headline Theme Integration

This repository now uses the **Headline** Ghost theme (downloaded from https://ghost.org/themes/headline/).

## How to update the theme

1. Download the latest `Headline-*.zip` from Ghost.
2. Replace the contents of the `theme/` directory with the latest Headline files (keep the folder named `theme` in git).
3. Bump the version in `theme/package.json` (for example `npm version patch`).
4. Commit and push your changes:
   ```bash
   git add theme
   git commit -m "chore(theme): update Headline"
   git push
   ```
5. GitHub Actions triggers `.github/workflows/theme-deploy.yml`, which uploads the theme and activates it automatically.

## Local development notes

- Headline ships with build tooling (`gulpfile.js`). If you customise assets, run the build command from the theme README before committing (`yarn install && yarn build`).
- Keep the theme contents inside `theme/` so the workflow always bundles the correct version.

## Rollback

If a change breaks the theme, revert to an earlier commit or re-upload a previous theme zip via Ghost Admin (Design → Upload theme).
