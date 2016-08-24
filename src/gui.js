import {app, BrowserWindow, Menu, remote} from 'electron';
import CPU from './cpu';
import Logger from './logger';
import config from './config';

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

}

//app.on('ready', createWindow);

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

if (!filename) {
  console.log(`Please execute with a ROM file: 
  npm start <filename>`);
  process.exit(0);
}

Logger.info(`Loading ${filename}
            `);

new CPU(filename).start();

