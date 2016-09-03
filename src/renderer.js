import LCD from './lcd';
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

let lcd;
let _refresh = 0;

ipcRenderer.on('start-lcd', (event, filename) => {
  lcd = new LCD(remote.getGlobal('mmu'), ctx, 160, 144);
  event.sender.send('lcd-ready');
});

ipcRenderer.on('paint-frame', (event) => {
  if (_refresh > 100){
    lcd.drawTiles();
    _refresh = 0;
  } else {
    _refresh++;
  }
  event.sender.send('paint-end');
});

ipcRenderer.on('end', (event) => {
  event.sender.send('end'); // broadcast
})