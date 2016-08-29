import CPU from './cpu';
import config from './config';
import {app, remote} from 'electron';

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
    cpu = new CPU(fileNames[0], ctx).start(0x100);
  }
}