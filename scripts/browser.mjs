import { accessSync, constants } from 'node:fs';
import { join } from 'node:path';

export function browserCandidates(platform = process.platform, env = process.env) {
  if (env.CHROME_PATH) return [env.CHROME_PATH];
  if (platform === 'darwin') return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'];
  if (platform === 'win32') return [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean).map(base => join(base, 'Google/Chrome/Application/chrome.exe'));
  return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'];
}

export function findBrowser() {
  const result = browserCandidates().find(file => {
    try { accessSync(file, constants.X_OK); return true; } catch { return false; }
  });
  if (!result) throw new Error(process.env.CHROME_PATH
    ? 'CHROME_PATH 指向不可执行的文件，请修正为浏览器可执行文件的绝对路径。'
    : '未找到 Chrome/Chromium。请安装浏览器，或用 CHROME_PATH 指定可执行文件的绝对路径。');
  return result;
}
