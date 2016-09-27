export default class InputHandler {

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
        this._mmu.pressUp();
        break;

      case this.KEY_DOWN:
        this._mmu.pressDown();
        break;

      case this.KEY_LEFT:
        this._mmu.pressLeft();
        break;

      case this.KEY_RIGHT:
        this._mmu.pressRight();
        break;

      case this.KEY_X:
        this._mmu.pressA();
        break;

      case this.KEY_Z:
        this._mmu.pressB();
        break;

      case this.KEY_ENTER:
      case this.KEY_SPACE:
        this._mmu.pressSTART();
        break;

      case this.KEY_CTRL:
        this._mmu.pressSELECT();
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
        break;

      case this.KEY_DOWN:
        this._mmu.liftDown();
        break;

      case this.KEY_LEFT:
        this._mmu.liftLeft();
        break;

      case this.KEY_RIGHT:
        this._mmu.liftRight();
        break;

      case this.KEY_X:
        this._mmu.liftA();
        break;

      case this.KEY_Z:
        this._mmu.liftB();
        break;

      case this.KEY_ENTER:
      case this.KEY_SPACE:
        this._mmu.liftSTART();
        break;

      case this.KEY_CTRL:
        this._mmu.liftSELECT();
        break;
    }
  }
}