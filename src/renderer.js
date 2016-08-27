import CPU from './cpu';
import config from './config';
import {app, remote} from 'electron';

const template = [{
  label: 'File',
  submenu: [{
      label: 'Open Game...',
      accelerator: 'CmdOrCtrl+O',
      role: 'open',
      click(){
        remote.dialog.showOpenDialog(function(fileNames) {
          if(fileNames !== undefined){
            new CPU(fileNames[0], ctx).start(0x100);
          }
        });
      }
    },{
      label: 'Close',
      accelerator: 'CmdOrCtrl+Q',
      role: 'close'
    }]
}];

const menu = remote.Menu.buildFromTemplate(template);
remote.Menu.setApplicationMenu(menu);

//config.DEBUG = true;

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');