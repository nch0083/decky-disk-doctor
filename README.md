# Decky Disk Doctor v0.1.0

SteamOS `/var` disk diagnostics and selective crash-report cleanup for Decky Loader.

## Features
- Inspect actual mounts for `/`, `/var`, `/var/log`, `/home`
- Manually scan `/var/lib/systemd/coredump` and `/var/lib/steamos-log-submitter/pending`
- Review candidate files before individual permanent deletion
- View recent journal errors
- No automatic deletion

## Install
Install a Decky plugin ZIP if supported, or place `DeckyDiskDoctor` in `~/homebrew/plugins/` and restart Decky Loader.

**Warning:** Untested on physical Steam Deck. Deleting dumps permanently removes diagnostic evidence. Do not change system permissions to work around errors.


## Updating from GitHub (Steam Deck Gaming Mode)

Repository: https://github.com/nch0083/decky-disk-doctor

You can use [Decky Direct Updater](https://github.com/nukeador/deckyup) to discover GitHub-hosted Decky plugins and check for updates without manually downloading each ZIP.

1. In Decky settings, enable Developer Mode.
2. In Developer > Install Plugin from URL, install Direct Updater from `https://deckyup.nukeador.com/install.zip`.
3. Open Direct Updater and find `nch0083/decky-disk-doctor`. Verify the repository owner before selecting the source.
4. When a compatible GitHub release becomes available, select Update and confirm in Decky.

Direct Updater checks periodically, but does not silently install updates. Its normal update detection targets stable releases; test prereleases may need to be selected manually.

### Release packaging contract

- GitHub release tag: `vX.Y.Z`
- Attached ZIP: `Decky-Disk-Doctor-vX.Y.Z.zip`
- ZIP root: `DeckyDiskDoctor/`, including `plugin.json`, `main.py`, `dist/index.js`
- Keep `package.json` version synchronized with the release.
- Publish a stable release only after a real Steam Deck install and smoke test. Until then, use prereleases.

**Security:** This plugin requests elevated permissions for disk diagnostics. Verify the GitHub repository and review changes before installing an update. The plugin itself does not download or install executable updates automatically.
