export default class InputHandler {

  /**
   * @param mmu
   * @param $body
   */
  constructor(cpu, $body){

    if (!cpu) throw new Error('Missing CPU');
    if (!$body) throw new Error('Missing DOM body');

    this._cpu = cpu;

    this.KEY_UP = 38;
    this.KEY_LEFT = 37;
    this.KEY_RIGHT = 39;
    this.KEY_DOWN = 40;
    this.KEY_X = 88;
    this.KEY_Z = 90;
    this.KEY_ENTER = 13;
    this.KEY_SPACE = 32;
    this.KEY_CTRL = 17;

    $body.addEventListener('keydown', (evt) => this.onKeyDown(evt));
    $body.addEventListener('keyup', (evt) => this.onKeyUp(evt));
  }

  /**
   * @param evt
   */
  onKeyDown(evt) {

    switch (evt.keyCode) {

      case this.KEY_UP:
        this._cpu.pressUp();
        break;

      case this.KEY_DOWN:
        this._cpu.pressDown();
        break;

      case this.KEY_LEFT:
        this._cpu.pressLeft();
        break;

      case this.KEY_RIGHT:
        this._cpu.pressRight();
        break;

      case this.KEY_X:
        this._cpu.pressA();
        break;

      case this.KEY_Z:
        this._cpu.pressB();
        break;

      case this.KEY_ENTER:
      case this.KEY_SPACE:
        this._cpu.pressSTART();
        break;

      case this.KEY_CTRL:
        this._cpu.pressSELECT();
        break;
    }
  }

  /**
   * @param evt
   */
  onKeyUp(evt){

    switch(evt.keyCode){

      case this.KEY_UP:
        this._cpu.mmu.liftUp();
        break;

      case this.KEY_DOWN:
        this._cpu.mmu.liftDown();
        break;

      case this.KEY_LEFT:
        this._cpu.mmu.liftLeft();
        break;

      case this.KEY_RIGHT:
        this._cpu.mmu.liftRight();
        break;

      case this.KEY_X:
        this._cpu.mmu.liftA();
        break;

      case this.KEY_Z:
        this._cpu.mmu.liftB();
        break;

      case this.KEY_ENTER:
      case this.KEY_SPACE:
        this._cpu.mmu.liftSTART();
        break;

      case this.KEY_CTRL:
        this._cpu.mmu.liftSELECT();
        break;
    }
  }
}