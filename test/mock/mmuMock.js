export default class MMUMock {

  constructor(){
    this._ly = 0;
    this.MAX_OBJ = 40;
    this.LCDC_LINE_VBLANK = 144;
    this.MASK_OBJ_ATTR_PRIORITY = 0x80;
    this.MASK_OBJ_ATTR_VFLIP = 0x40;
    this.MASK_OBJ_ATTR_HFLIP = 0x20;
    this.MASK_OBJ_ATTR_OBG = 0x10;
    this.ADDR_MAX = 0xffff;
    this.ADDR_IF = 0xff0f;
    this.ADDR_IE = this.ADDR_MAX;

    this._memory = [];
    this._isDMA = false;
    this._lcdMode = 0;
  }

  writeByteAt(addr, value){
    this._memory[addr] = value;
  }

  readByteAt(addr){
    return this._memory[addr];
  }

  getCartridgeType(){}

  scx(){
    return 0;
  }

  scy(){
    return 0;
  }

  ly(){
    return this._ly;
  }

  setLy(line){
    this._ly = line;
  }

  incrementLy(){
    if (this._ly >= 153){
      this._ly = 0;
    } else {
      this._ly++;
    }
  }

  lcdc(){
    return 0x90;
  }

  areOBJOn() {
    return true;
  }

  bgp(){
    return 0b11100100;
  }

  obg0(){
    return 0b11100100;
  }

  obg1(){
    return 0b11100100;
  }

  getOBJ() {
    return {y: 0, x: 0, chrCode: 0, attr: 0x00};
  }

  isTileLineDrawn(tileLine) {
    return false;
  }

  setTileLineDrawn(tileLine){}

  getBgCharCode(){
    return 0;
  }

  isWindowOn(){
    return false;
  }

  setDMA(isDMA){
    this._isDMA = isDMA;
  }

  isDMA(){
    return this._isDMA;
  }

  getLCDMode(){
    return this._lcdMode;
  }

  setLCDMode(lcdMode){
    this._lcdMode = lcdMode;
  }

  set_HW_DIV(n){}

  isRunningBIOS(){
    return false;
  }

  pressA(){}
  pressB(){}
  pressSELECT(){}
  pressSTART(){}
  pressUp(){}
  pressDown(){}
  pressLeft(){}
  pressRight(){}

  areOBJDouble(){
    return false;
  }
}