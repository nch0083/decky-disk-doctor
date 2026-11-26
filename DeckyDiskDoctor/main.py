"""Decky Disk Doctor v0.1: conservative, explicitly approved cleanup."""
import asyncio
import os
import stat
import time
import secrets
import subprocess
from pathlib import Path

try:
    import decky
except ImportError:
    decky = None

TARGETS = (
    ("coredump", "/var/lib/systemd/coredump", "Crash dump", "recommended"),
    ("pending", "/var/lib/steamos-log-submitter/pending", "Pending error report", "review"),
)
MAX_FILES = 1200
MAX_DEPTH = 5

def mounted_partitions():
    mounts = []
    try:
        with open('/proc/self/mountinfo', encoding='utf-8') as f:
            for line in f:
                parts = line.strip().split(' ')
                if '-' not in parts:
                    continue
                sep = parts.index('-')
                mounts.append((parts[4].replace('\\040', ' '), parts[sep + 1], parts[sep + 2]))
    except OSError:
        pass
    result = []
    for path in ('/', '/var', '/var/log', '/home'):
        try:
            st = os.statvfs(path)
            matching = sorted((m for m in mounts if path == m[0] or path.startswith(m[0].rstrip('/') + '/')), key=lambda x: len(x[0]))
            mount = matching[-1] if matching else ('?', '?', '?')
            result.append({'path': path, 'mountpoint': mount[0], 'filesystem': mount[1], 'device': mount[2], 'total': st.f_blocks * st.f_frsize, 'free': st.f_bavail * st.f_frsize})
        except OSError:
            continue
    return result

def scan_files():
    files = []
    warnings = []
    for category, directory, label, level in TARGETS:
        base = Path(directory)
        try:
            root_stat = os.lstat(base)
            if not stat.S_ISDIR(root_stat.st_mode) or stat.S_ISLNK(root_stat.st_mode):
                warnings.append(f'Skipped unsafe directory: {directory}')
                continue
        except FileNotFoundError:
            continue
        except OSError as exc:
            warnings.append(f'Cannot inspect {directory}: {exc}')
            continue
        stack = [(str(base), 0)]
        while stack and len(files) < MAX_FILES:
            current, depth = stack.pop()
            try:
                with os.scandir(current) as entries:
                    for entry in entries:
                        if len(files) >= MAX_FILES:
                            warnings.append('Scan limit reached (1200 files). Results may be incomplete.')
                            break
                        try:
                            info = entry.stat(follow_symlinks=False)
                            if stat.S_ISDIR(info.st_mode) and depth < MAX_DEPTH:
                                stack.append((entry.path, depth + 1))
                            elif stat.S_ISREG(info.st_mode):
                                files.append({'path': entry.path, 'name': entry.name, 'category': category,
                                              'label': label, 'level': level, 'size': info.st_size,
                                              'mtime': int(info.st_mtime), 'inode': info.st_ino,
                                              'device': info.st_dev})
                        except OSError:
                            continue
            except OSError as exc:
                warnings.append(f'Cannot read {current}: {exc}')
    files.sort(key=lambda x: x['size'], reverse=True)
    return files, warnings

def recent_errors():
    try:
        p = subprocess.run(['journalctl', '--no-pager', '-p', 'err', '-n', '15', '-o', 'short-iso'],
                           capture_output=True, text=True, timeout=4, check=False)
        return (p.stdout or '').splitlines()[-15:] if p.returncode == 0 else []
    except (OSError, subprocess.TimeoutExpired):
        return []

class Plugin:
    def __init__(self):
        self._tokens = {}
        self._lock = asyncio.Lock()

    async def _main(self):
        if decky:
            decky.logger.info('Decky Disk Doctor started; no automatic cleanup enabled')

    async def get_status(self):
        return {'partitions': mounted_partitions(), 'privileged': os.geteuid() == 0,
                'version': '0.1.0', 'time': int(time.time())}

    async def scan(self):
        async with self._lock:
            files, warnings = await asyncio.to_thread(scan_files)
            self._tokens.clear()
            public = []
            for f in files:
                token = secrets.token_urlsafe(18)
                self._tokens[token] = f
                public.append({k: v for k, v in f.items() if k not in ('inode', 'device')} | {'id': token})
            return {'files': public, 'warnings': warnings, 'partitions': mounted_partitions(),
                    'errors': await asyncio.to_thread(recent_errors), 'time': int(time.time())}

    async def delete_files(self, ids):
        if not isinstance(ids, list) or not ids or len(ids) > 100:
            return {'ok': False, 'error': 'Select 1 to 100 scanned files.'}
        if len(set(ids)) != len(ids):
            return {'ok': False, 'error': 'Duplicate selections.'}
        async with self._lock:
            if not all(isinstance(x, str) and x in self._tokens for x in ids):
                return {'ok': False, 'error': 'Scan expired or unknown file. Scan again.'}
            results = []
            for token in ids:
                f = self._tokens.pop(token)
                path = f['path']
                allowed = next((directory for category, directory, _, _ in TARGETS if category == f['category']), None)
                if not allowed or not path.startswith(allowed + '/'):
                    results.append({'name': f['name'], 'ok': False, 'error': 'Outside allowlist'})
                    continue
                try:
                    relative = Path(path).relative_to(allowed)
                    parent_fd = os.open(allowed, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
                    try:
                        for segment in relative.parts[:-1]:
                            next_fd = os.open(segment, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent_fd)
                            os.close(parent_fd)
                            parent_fd = next_fd
                        current = os.stat(relative.name, dir_fd=parent_fd, follow_symlinks=False)
                        if (not stat.S_ISREG(current.st_mode) or current.st_ino != f['inode']
                                or current.st_dev != f['device'] or current.st_size != f['size']
                                or int(current.st_mtime) != f['mtime']):
                            raise ValueError('File changed since scan')
                        os.unlink(relative.name, dir_fd=parent_fd)
                        results.append({'name': f['name'], 'ok': True, 'bytes': current.st_size})
                    finally:
                        os.close(parent_fd)
                except (OSError, ValueError) as exc:
                    results.append({'name': f['name'], 'ok': False, 'error': str(exc)[:160]})
            return {'ok': True, 'results': results, 'partitions': mounted_partitions()}
