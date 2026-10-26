/**
 * ZARA Windows Desktop Companion
 * Electron Main Process with System Tray, Global Hotkeys (Ctrl+Shift+Z),
 * Native File Explorer, Browser Control & WhatsApp Automation
 */

const { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, shell, clipboard } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Determine base URL (dev server or production dist)
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    title: 'ZARA — Personal Voice Assistant & Desktop Companion',
    frame: true,
    backgroundColor: '#0A0A0F',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.loadURL(DEV_URL);

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (tray) {
        tray.displayBalloon?.({
          title: 'ZARA Background Active',
          content: 'ZARA is still listening in the tray. Press Ctrl+Shift+Z anytime.',
        });
      }
    }
    return false;
  });
}

function createTray() {
  // Use a fallback icon or simple generated buffer if icon file doesn't exist
  const iconPath = path.join(__dirname, '../public/favicon.ico');
  
  try {
    tray = new Tray(fs.existsSync(iconPath) ? iconPath : path.join(__dirname, 'icon.png'));
  } catch (e) {
    // If icon file is not found, tray may fail in headless tests; gracefully handle
    console.log('Tray creation note: using standard tray init');
  }

  if (tray) {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open ZARA (Ctrl+Shift+Z)',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: 'Toggle Microphone (Ctrl+Shift+M)',
        click: () => {
          mainWindow?.webContents.send('zara:toggle-mute');
        },
      },
      { type: 'separator' },
      {
        label: 'Status: Standby & Listening',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Exit ZARA',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setToolTip('ZARA — Personal Pakistani AI Companion');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      mainWindow?.show();
      mainWindow?.focus();
    });
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Register Global Hotkey: Ctrl+Shift+Z to activate ZARA
  const registeredWake = globalShortcut.register('CommandOrControl+Shift+Z', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('zara:hotkey-activate');
    }
  });

  if (!registeredWake) {
    console.warn('Registration of Ctrl+Shift+Z hotkey failed.');
  }

  // Register Global Hotkey: Ctrl+Shift+M for Mute
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    mainWindow?.webContents.send('zara:toggle-mute');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC Handlers for Native Laptop Control
// 1. Files & Folders via shell.openPath()
ipcMain.handle('system:open-path', async (_event, targetPath) => {
  try {
    let resolved = targetPath;
    const homedir = os.homedir();
    if (targetPath.toLowerCase() === 'downloads') {
      resolved = path.join(homedir, 'Downloads');
    } else if (targetPath.toLowerCase() === 'documents') {
      resolved = path.join(homedir, 'Documents');
    } else if (targetPath.toLowerCase() === 'desktop') {
      resolved = path.join(homedir, 'Desktop');
    }

    const err = await shell.openPath(resolved);
    return { success: !err, error: err, resolvedPath: resolved };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 2. URLs via shell.openExternal()
ipcMain.handle('system:open-url', async (_event, targetUrl) => {
  try {
    await shell.openExternal(targetUrl);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 3. System Apps via child_process
ipcMain.handle('system:launch-app', async (_event, appName) => {
  return new Promise((resolve) => {
    const isWin = os.platform() === 'win32';
    const lower = appName.toLowerCase();
    let command = appName;

    if (lower === 'notepad') command = isWin ? 'notepad.exe' : 'gedit';
    else if (lower === 'calculator' || lower === 'calc') command = isWin ? 'calc.exe' : 'gnome-calculator';
    else if (lower === 'chrome' || lower === 'google chrome') command = isWin ? 'start chrome' : 'google-chrome';
    else if (lower === 'vscode' || lower === 'vs code' || lower === 'code') command = 'code';
    else if (lower === 'task manager') command = isWin ? 'taskmgr.exe' : 'gnome-system-monitor';
    else if (lower === 'whatsapp') command = isWin ? 'start whatsapp:' : 'xdg-open whatsapp:';

    exec(command, (err) => {
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, app: appName });
      }
    });
  });
});

// 4. Close System App
ipcMain.handle('system:close-app', async (_event, appName) => {
  return new Promise((resolve) => {
    const isWin = os.platform() === 'win32';
    const lower = appName.toLowerCase();
    let killCmd = '';

    if (isWin) {
      if (lower === 'notepad') killCmd = 'taskkill /F /IM notepad.exe';
      else if (lower === 'calculator' || lower === 'calc') killCmd = 'taskkill /F /IM CalculatorApp.exe';
      else if (lower === 'chrome') killCmd = 'taskkill /F /IM chrome.exe';
      else killCmd = `taskkill /F /IM ${appName}.exe`;
    } else {
      killCmd = `pkill -f ${appName}`;
    }

    exec(killCmd, (err) => {
      resolve({ success: !err, message: err ? err.message : `Closed ${appName}` });
    });
  });
});

// 5. WhatsApp Desktop automation via clipboard
ipcMain.handle('system:whatsapp-paste-send', async (_event, { contactName, messageText }) => {
  try {
    // 1. Copy message text into system clipboard
    clipboard.writeText(messageText);

    // 2. Open whatsapp protocol or desktop app
    const isWin = os.platform() === 'win32';
    const uri = `whatsapp://send?text=${encodeURIComponent(messageText)}`;
    await shell.openExternal(uri);

    return { success: true, message: `Copied to clipboard and opened WhatsApp for ${contactName}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
