const CPU = require('../lib/cpu.js').default;
const config = require('../lib/config.js').default;
const app = require('electron').remote;
const Menu = app.Menu;
const dialog = app.dialog;

const template = [{
  label: 'File',
  submenu: [{
      label: 'Open Game...',
      accelerator: 'CmdOrCtrl+O',
      role: 'open',
      click(){
        dialog.showOpenDialog(function(fileNames) {
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

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

//config.DEBUG = true;

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');