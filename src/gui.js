import {app, BrowserWindow, Menu, remote, dialog} from 'electron';
import CPU from './cpu';
import Logger from './logger';
import config from './config';

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 256,
    height: 256,
    resizable: false,
    maximizable: false
  });

  win.loadURL(`file://${__dirname}/../src/index.html`);

  //win.webContents.openDevTools();

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

// Game file
let filename;

// Options
for(let i = 2; i < process.argv.length; i++){
  const option = process.argv[i];
  if (option.includes('--')){
    if (option === '--debug'){
      config.DEBUG = true;
    }
  } else {
    filename = option;
  }
}
