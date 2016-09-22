import LCD from './lcd';
import {app, remote, ipcRenderer} from 'electron';

let lcd;
let _refresh = 0;

class InputHandler {

  /**
   * @param mmu
   * @param $body
   */
  constructor(mmu, $body){

    if (!mmu) throw new Error('Missing MMU');
    if (!$body) throw new Error('Missing DOM body');

    this._mmu = mmu;

    this.KEY_UP = 38;
    this.KEY_LEFT = 37;
    this.KEY_RIGHT = 39;
    this.KEY_DOWN = 40;
    this.KEY_X = 88;
    this.KEY_Z = 90;
    this.KEY_ENTER = 13;
    this.KEY_SPACE = 32;
    this.KEY_CTRL = 17;

    // Hold state to reduce calls to MMU
    this._up = false;
    this._down = false;
    this._left = false;
    this._right = false;
    this._a = false;
    this._b = false;
    this._select = false;
    this._start = false;

    $body.addEventListener('keydown', (evt) => this.onKeyDown(evt));
    $body.addEventListener('keyup', (evt) => this.onKeyUp(evt));
  }

  /**
   * @param evt
   */
  onKeyDown(evt) {

    switch (evt.keyCode) {

      case this.KEY_UP:
        if (!this._up) {
          this._mmu.pressUp();
          this._up = true;
        }
        break;

      case this.KEY_DOWN:
        if (!this._down) {
          this._mmu.pressDown();
          this._down = true;
        }
        break;

      case this.KEY_LEFT:
        if (!this._left){
          this._mmu.pressLeft();
          this._left = true;
        }
        break;

      case this.KEY_RIGHT:
        if (!this._right) {
          this._mmu.pressRight();
          this._right = true;
        }
        break;

      case this.KEY_X:
        if (!this._a) {
          this._mmu.pressA();
          this._a = true;
        }
        break;

      case this.KEY_Z:
        if (!this._b) {
          this._mmu.pressB();
          this._b = true;
        }
        break;

      case this.KEY_ENTER:
      case this.KEY_SPACE:
        if (!this._start) {
          this._mmu.pressSTART();
          this._start = true;
        }
        break;

      case this.KEY_CTRL:
        if (!this._select) {
          this._mmu.pressSELECT();
          this._select = true;
        }
        break;
    }
  }

  /**
   * @param evt
   */
  onKeyUp(evt){

    switch(evt.keyCode){

      case this.KEY_UP:
        this._mmu.liftUp();
        this._up = false;
        break;

      case this.KEY_DOWN:
        this._mmu.liftDown();
        this._down = false;
        break;

      case this.KEY_LEFT:
        this._mmu.liftLeft();
        this._left = false;
        break;

      case this.KEY_RIGHT:
        this._mmu.liftRight();
        this._right = false;
        break;

      case this.KEY_X:
        this._mmu.liftA();
        this._a = false;
        break;

      case this.KEY_Z:
        this._mmu.liftB();
        this._b = false;
        break;

      case this.KEY_ENTER:
      case this.KEY_SPACE:
        this._mmu.liftSTART();
        this._start = false;
        break;

      case this.KEY_CTRL:
        this._mmu.liftSELECT();
        this._select = false;
        break;
    }
  }
}

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

function startGame(fileNames){
  if(fileNames !== undefined){
    ipcRenderer.send('load-game', fileNames[0]);
  }
}

ipcRenderer.on('start-lcd', (event, filename) => {

  const mmu = remote.getGlobal('mmu');
  const input = new InputHandler(mmu, document.querySelector('body'));

  const ctx = document.getElementById('screen').getContext('2d');

  lcd = new LCD(mmu, ctx, 160, 144);

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