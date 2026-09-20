import { spawn } from 'node:child_process';

export function browserCommand(url, platform = process.platform) {
  if (platform === 'darwin') return { command: 'open', args: [url] };
  if (platform === 'win32') return { command: 'cmd', args: ['/c', 'start', '', url] };
  return { command: 'xdg-open', args: [url] };
}

export function openBrowser(url, { platform = process.platform, spawnImpl = spawn } = {}) {
  const { command, args } = browserCommand(url, platform);
  const child = spawnImpl(command, args, { detached: true, stdio: 'ignore', windowsHide: true, shell: false });
  child.unref();
}
