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
