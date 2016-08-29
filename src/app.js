import {app, BrowserWindow, Menu, remote, dialog} from 'electron';
import config from './config';

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

// Options
for(let i = 2; i < process.argv.length; i++){
  const option = process.argv[i];
  if (option === '--debug'){
    config.DEBUG = true;
  }
}
