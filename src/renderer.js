import CPU from './cpu';
import config from './config';
import {app, remote, ipcRenderer} from 'electron';

let cpu;

const template = [{
  label: 'File',
  submenu: [{
      label: 'Open Game...',
      accelerator: 'CmdOrCtrl+O',
      role: 'open',
      click(){
        remote.dialog.showOpenDialog(startGame);
      }
    },{
      label: 'Close',
      accelerator: 'CmdOrCtrl+Q',
      role: 'close'
    }]
}];

const menu = remote.Menu.buildFromTemplate(template);
remote.Menu.setApplicationMenu(menu);

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');

function startGame(fileNames){
  if(fileNames !== undefined){
    ipcRenderer.send('load-game', fileNames[0]);
  }
}

ipcRenderer.on('update-canvas', (event, imageData) => {
  ctx.putImageData(imageData, 0, 0);
});

ipcRenderer.send('ui-ready', ctx.createImageData(160, 144));