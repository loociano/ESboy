import {app, BrowserWindow, Menu, remote, dialog, ipcMain} from 'electron';
import MMU from './mmu';
import CPU from './cpu';

let win;

function createWindow() {

  win = new BrowserWindow({
    width: 512,
    height: 512,
    resizable: true,
    maximizable: true
  });

  win.loadURL(`file://${__dirname}/../src/index.html`);

  win.webContents.openDevTools();

  const menu = Menu.buildFromTemplate([]);
  Menu.setApplicationMenu(menu);

  win.on('closed', () => {
    win = null;
  });

}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (win === null) {
    createWindow();
  }
});

global.mmu = null;
let cpu = null;

ipcMain.on('load-game', (event, filename) => {
  global.mmu = new MMU(filename);
  win.webContents.send('start-lcd');
});

ipcMain.on('lcd-ready', (event) => {
  cpu = new CPU(global.mmu, win.webContents);
  cpu.start();
});

ipcMain.on('paint-end', (event) => {
  cpu.isPainting = false;
});