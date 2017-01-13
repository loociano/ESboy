export default class MMUMock {

  constructor(){
    this._ly = 0;
    this.MAX_OBJ = 40;
    this.MASK_OBJ_ATTR_PRIORITY = 0x80;
    this.MASK_OBJ_ATTR_VFLIP = 0x40;
    this.MASK_OBJ_ATTR_HFLIP = 0x20;
    this.MASK_OBJ_ATTR_OBG = 0x10;
  }

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

  setTileLineDrawn(tileLine){
    // do nothing
  }

  getBgCharCode(){
    return 0;
  }

  isWindowOn(){
    return false;
  }
}