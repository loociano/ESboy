import {app, BrowserWindow, Menu, remote, dialog, ipcMain} from 'electron';

let win;
let bgWin;

function createWindow() {

  bgWin = new BrowserWindow({show: false});
  bgWin.loadURL(`file://${__dirname}/../src/bg.html`);

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

ipcMain.on('asynchronous-message', (event, arg) => {
  console.log(arg)  // prints "ping"
  event.sender.send('asynchronous-reply', 'pong')
});