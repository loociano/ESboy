import Utils from './utils';
import Logger from './logger';

export default class LCD {

  /**
   * @param {MMU} mmu
   * @param {CanvasRenderingContext2D} ctxBG
   * @param {CanvasRenderingContext2D} ctxOBJ
   * @param {CanvasRenderingContext2D} ctxWindow
   */
  constructor(mmu, ctxBG, ctxOBJ, ctxWindow){

    // Public constants
    this.TILE_WIDTH = 8;
    this.SHADES = {
      0: [155,188,15,255],
      1: [139,172,15,255],
      2: [48,98,48,255],
      3: [15,56,15,255]
    };

    // Constants
    this._OUT_WIDTH = 256;
    this._OUT_HEIGHT = 256;
    this._HW_WIDTH = 160;
    this._HW_HEIGHT = 144;
    this._MIN_WINDOW_X = this.TILE_WIDTH - 1;
    this._MAX_WINDOW_X = this._HW_WIDTH + this._MIN_WINDOW_X - 1;
    this._TILE_HEIGHT = this.TILE_WIDTH;
    this._MAX_TILE_HEIGHT = 2 * this._TILE_HEIGHT;
    this._H_TILES = this._HW_WIDTH / this.TILE_WIDTH;
    this._V_TILES = this._HW_HEIGHT / this._TILE_HEIGHT;

    this._mmu = mmu;
    this._ctxBG = ctxBG;
    this._ctxOBJ = ctxOBJ;
    this._ctxWindow = ctxWindow;
    this._cache = {};
    this._bgp = null;
    this._obg0 = null;
    this._obg1 = null;
    this._imageDataBG = this._ctxBG.createImageData(this._HW_WIDTH, this._HW_HEIGHT);
    this._imageDataOBJ = this._ctxOBJ.createImageData(this._HW_WIDTH, this._HW_HEIGHT);
    this._imageDataWindow = this._ctxWindow.createImageData(this._HW_WIDTH, this._HW_HEIGHT);

    this._clear();
    this._clear(this._imageDataOBJ, this._ctxOBJ);
    this._readPalettes();

    this.paint();
  }

  getImageDataBG(){
    return this._imageDataBG;
  }

  getImageDataOBJ(){
    return this._imageDataOBJ;
  }

  getImageDataWindow(){
    return this._imageDataWindow;
  }

  /**
   * @param {number} line 0..143
   */
  drawLine(line){
    if (line < 0 || line > this._HW_HEIGHT) {
      Logger.warn(`Cannot draw line ${line}`);
      return;
    }
    this._readPalettes();

    if (this._mmu._VRAMRefreshed) {
      this._cache = {};
      this._mmu._VRAMRefreshed = false;
    }

    this._drawLineBG(line);

    this._clearLine(line, this._imageDataOBJ);
    if (this._mmu.areOBJOn()) {
      this._drawLineOBJ(line);
    }

    this._clearLine(line, this._imageDataWindow);
    if (this._mmu.isWindowOn()){
      this._drawLineWindow(line);
    }
  }

  /**
   * @param {number} coord 0..143
   * @param {number} coordOffset 0..255
   * @returns {number} 0..31
   */
  getVerticalGrid(coord, coordOffset){
    return Math.floor(((coord + coordOffset) % this._OUT_HEIGHT)/this._TILE_HEIGHT);
  }

  /**
   * Outputs the imageDatas into the actual HTML canvas
   * NOTE: EXPENSIVE, should be called once per frame (not per line)
   */
  paint(){
    this._ctxBG.putImageData(this._imageDataBG, 0, 0);
    this._ctxOBJ.putImageData(this._imageDataOBJ, 0, 0);
    this._ctxWindow.putImageData(this._imageDataWindow, 0, 0);
  }

  /**
   * Draws pixel in image data, given its coords and grey level
   *
   * @param {number} x
   * @param {number} y
   * @param {number} level
   * @param {Array} palette
   * @param {ImageData} imageData
   */
  drawPixel({x, y, level}, palette=this._bgp, imageData=this._imageDataBG) {

    if (level < 0 || level > 3){
      Logger.error(`Unrecognized level gray level ${level}`);
      return;
    }

    if (x < 0 || y < 0 || x >= this._HW_WIDTH || y >= this._HW_HEIGHT) return;

    if ((palette === this._obg0 || palette === this._obg1) && level === 0) {
      return; // Transparent
    }

    const start = (x + y * this._HW_WIDTH) * 4;
    imageData.data.set(this.SHADES[palette[level]], start);
  }

  /** 
   * Clears the LCD by writing transparent pixels
   * @param {ImageData} imageData
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _clear(imageData=this._imageDataBG, ctx=this._ctxBG){
    const size = this._HW_WIDTH * this._HW_HEIGHT * 4;
    for(let p = 0; p < size; p++){
      imageData.data[p] = 0;
    }
  }

  /**
   * Clears the LCD line by writing transparent pixels
   * @param {number} line
   * @param {ImageData} imageData
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _clearLine(line, imageData=this._imageDataBG){
    const start = this._HW_WIDTH * line * 4;
    const end = start + this._HW_WIDTH*4;

    for(let p = start; p < end; p++){
      imageData.data[p] = 0;
    }
  }

  /**
   * @param {number} line
   * @private
   */
  _drawLineBG(line){
    let max = this._OUT_WIDTH;
    const scx = this._mmu.scx();
    const scy = this._mmu.scy();
    if (scx === 0){
      max = this._HW_WIDTH;
    }

    for(let x = 0; x < max; x += this.TILE_WIDTH){
      const tileNumber = this._mmu.getBgCharCode(this._getHorizontalGrid(x), this.getVerticalGrid(line, scy));
      this._drawTileLine({
        tileNumber: tileNumber,
        x: (x + this._OUT_WIDTH - scx) % this._OUT_WIDTH,
        y: line
      }, line);
    }
  }

  /**
   * @param {number} line
   * @private
   */
  _drawLineWindow(line){
    const wy = this._mmu.wy();
    const wx = this._mmu.wx();

    if ( (line - wy < 0) || wx > this._MAX_WINDOW_X || wx < this._MIN_WINDOW_X) return;

    for(let x = 0; x < this._HW_WIDTH; x += this.TILE_WIDTH){
      const tileNumber = this._mmu.getWindowCharCode(this._getHorizontalGrid(x), this.getVerticalGrid(line - wy, 0));
      this._drawTileLine({
        tileNumber: tileNumber,
        x: x + wx - this._MIN_WINDOW_X,
        y: line
      }, line, this._imageDataWindow);
    }
  }

  /**
   * @param {number} coord 0..255
   * @returns {number} 0..31
   * @private
   */
  _getHorizontalGrid(coord){
    return Math.floor(coord/this._TILE_HEIGHT);
  }

  /**
   * @param tileNumber
   * @param x
   * @param y
   * @param OBJAttr
   * @param line
   * @param imageData
   */
  _drawTileLine({tileNumber, x, y, OBJAttr}, line, imageData=this._imageDataBG){

    const isOBJ = OBJAttr !== undefined;
    let tileLine = ((line + this._mmu.scy()) % this._OUT_HEIGHT) % this._TILE_HEIGHT;

    if (isOBJ){
      tileLine = line - y;
    }

    let intensityVector = this._getIntensityVector(tileNumber, tileLine, isOBJ);
    let palette = this._bgp;

    if(isOBJ){
      intensityVector = this._handleOBJAttributes(intensityVector, tileNumber, tileLine, OBJAttr, x, y);
      palette = this._getOBJPalette(OBJAttr);
    }

    for(let i = 0; i < intensityVector.length; i++){
      this.drawPixel({
        x: (x + i) % this._OUT_WIDTH,
        y: line,
        level: intensityVector[i]},
        palette, imageData);
    }
  }

  /**
   * Reads palettes
   * @private
   */
  _readPalettes(){
    this._bgp = LCD.paletteToArray(this._mmu.bgp());
    this._obg0 = LCD.paletteToArray(this._mmu.obg0());
    this._obg1 = LCD.paletteToArray(this._mmu.obg1());
  }

  /**
   * @param {number} line
   * @private
   */
  _drawLineOBJ(line){
    for(let n = 0; n < this._mmu.MAX_OBJ; n++){
      const OBJ = this._mmu.getOBJ(n);
      if (LCD._isValidOBJ(OBJ) && this._isOBJInLine(line, OBJ.y)){
        this._drawTileLine({
          tileNumber: OBJ.chrCode,
          x: OBJ.x - this.TILE_WIDTH,
          y: OBJ.y - this._MAX_TILE_HEIGHT, /* tiles can be 8x16 pixels */
          OBJAttr: OBJ.attr,
        }, line, this._imageDataOBJ);
      }
    }
  }

  /**
   * @param {number} line
   * @param {number} y
   * @returns {boolean}
   * @private
   */
  _isOBJInLine(line, y){
    const offset = y - this._MAX_TILE_HEIGHT;
    return line >= offset && line < (offset + this._TILE_HEIGHT);
  }

  /**
   * @param {number} OBJAttr
   * @returns {Array}
   * @private
   */
  _getOBJPalette(OBJAttr){
    if ((OBJAttr & this._mmu.MASK_OBJ_ATTR_OBG) === 0){
      return this._obg0;
    } else {
      return this._obg1;
    }
  }

  /**
   * @param {Array} intensityVector
   * @param {number} tileNumber
   * @param {number} tileLine
   * @param {number} OBJAttr
   * @param {number} x
   * @param {number} y
   * @private
   */
  _handleOBJAttributes(intensityVector, tileNumber, tileLine, OBJAttr, x, y){
    if ((OBJAttr & this._mmu.MASK_OBJ_ATTR_PRIORITY) === this._mmu.MASK_OBJ_ATTR_PRIORITY){

      const tileNumber = this._mmu.getBgCharCode(x/this.TILE_WIDTH, y/this._TILE_HEIGHT);
      const bgIntensityVector = this._getIntensityVector(tileNumber, tileLine, false);

      // Exception: OBJ with priority flag are displayed only in the underneath BG is lightest
      if (!LCD._isLightestVector(bgIntensityVector)){
        return new Array(this.TILE_WIDTH).fill(0);
      }
    }

    // Flipping order matters
    if ((OBJAttr & this._mmu.MASK_OBJ_ATTR_VFLIP) === this._mmu.MASK_OBJ_ATTR_VFLIP){
      intensityVector = this._getIntensityVector(tileNumber, this._getVerticalMirrorLine(tileLine), true);
    }
    if ((OBJAttr & this._mmu.MASK_OBJ_ATTR_HFLIP) === this._mmu.MASK_OBJ_ATTR_HFLIP){
      const copy = intensityVector.slice();
      copy.reverse();
      intensityVector = copy;
    }
    return intensityVector;
  }

  /**
   * @param tileLine
   * @returns {number}
   * @private
   */
  _getVerticalMirrorLine(tileLine){
    return Math.abs(this._TILE_HEIGHT-1 - tileLine);
  }

  /**
   * @param {number} tileNumber
   * @param {number} tileLine
   * @param {boolean} isOBJ
   * @returns {Array} palette matrix from cache, recalculated whenever VRAM is updated.
   * @private
   */
  _getIntensityVector(tileNumber, tileLine, isOBJ){
    let key = `BG_${tileNumber}_${tileLine}`;

    if (isOBJ){
      key = `OBJ_${tileNumber}_${tileLine}`;
    }

    const cached = this._cache[key];
    if (cached){
      return cached;
    } else {
      const intensityVector = this._calculateIntensityVector(tileNumber, tileLine, isOBJ);
      this._cache[key] = intensityVector;
      return this._cache[key];
    }
  }

  /**
   * Calculates palette matrix given a tile number.
   * Expensive operation.
   * @param {number} tileNumber
   * @param {number} tileLine
   * @param {boolean} isOBJ
   * @returns {Array}
   * @private
   */
  _calculateIntensityVector(tileNumber, tileLine, isOBJ){
    let tileLineData;
    if (isOBJ) {
      tileLineData = this._mmu.readOBJData(tileNumber, tileLine);
    } else {
      tileLineData = this._mmu.readBGData(tileNumber, tileLine);
    }
    return LCD.tileToIntensityVector(tileLineData);
  }

  /**
   * Converts a 16 bits tile buffer into array of level of grays [0-3]
   * Example:
   * 0x0000 -> [0,0,0,0,0,0,0,0]
   * 0xff00 -> [1,1,1,1,1,1,1,1]
   * 0x00ff -> [2,2,2,2,2,2,2,2]
   * 0xffff -> [3,3,3,3,3,3,3,3]
   *
   * @param {Buffer} tileLineData (2 bytes)
   * @returns {Array} intensity vector
   */
  static tileToIntensityVector(tileLineData){
    const array = [];

    const msb = Utils.toBin8(tileLineData[0]);
    const lsb = Utils.toBin8(tileLineData[1]);

    for(let b = 0; b < 8; b++){
      array.push( (parseInt(lsb[b], 2) << 1) + parseInt(msb[b], 2));
    }
    return array;
  }

  /**
   * @param {Object} OBJ
   * @returns {boolean}
   * @private
   */
  static _isValidOBJ(OBJ){
    return OBJ.x !== 0 || OBJ.y !== 0 || OBJ.chrCode !== 0 || OBJ.attr !== 0;
  }

  /**
   * @param byte, example: 11100100
   * @returns {Array} example: [0,1,2,3]
   */
  static paletteToArray(byte){
    const array = [];
    [0, 2, 4, 6].map( (shift) => {
      array.push((byte >> shift) & 0x03);
    });
    return array;
  }

  /**
   * @param {Array} vector
   * @returns {boolean} true if the vector is the lightest possible
   * @private
   */
  static _isLightestVector(vector){
    for(let intensity of vector){
      if (intensity > 0) return false;
    }
    return true;
  }
}