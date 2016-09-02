import {app, BrowserWindow, Menu, remote, dialog, ipcMain} from 'electron';

let win;
let bgWin;

function createWindow() {

  bgWin = new BrowserWindow({show: true});
  bgWin.loadURL(`file://${__dirname}/../src/bg.html`);
  bgWin.webContents.openDevTools();

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

let bg;
let ui;
let imageData;

ipcMain.on('bg-ready', (event) => {
  bg = event;
});

ipcMain.on('ui-ready', (event, data) => {
  ui = event;
  imageData = data;
});

ipcMain.on('load-game', (event, filename) => {
  bg.sender.send('start-cpu', {filename, imageData});
});

ipcMain.on('paint-tile', (event, imageData) => {
  ui.sender.send('update-canvas', imageData);
});