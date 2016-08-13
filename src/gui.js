import {app, BrowserWindow, Menu, remote} from 'electron';
import CPU from './CPU';

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 256,
    height: 256,
    resizable: true,
    maximizable: true
  });

  win.loadURL(`file://${__dirname}/../src/index.html`);

  const template = [{
    label: 'File',
    submenu: [{
        label: 'Open Game...',
        accelerator: 'CmdOrCtrl+O',
        role: 'open'
      },{
        label: 'Close',
        accelerator: 'CmdOrCtrl+Q',
        role: 'close'
      }]
  }];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  win.on('closed', () => {
    win = null;
  });

  new CPU('./roms/tetris.gb').start();
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