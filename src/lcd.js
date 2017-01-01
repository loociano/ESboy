import Utils from './utils';
import Logger from './logger';

export default class LCD {

  /**
   * @param {MMU} mmu
   * @param {CanvasRenderingContext2D} ctxBG
   * @param {CanvasRenderingContext2D} ctxOBJ
   */
  constructor(mmu, ctxBG, ctxOBJ){

    // Public constants
    this.TILE_WIDTH = 8;
    this.SHADES = {
      0: [155,188,15,255],
      1: [139,172,15,255],
      2: [48,98,48,255],
      3: [15,56,15,255]
    };

    // Constants
    this._HW_WIDTH = 160;
    this._HW_HEIGHT = 144;
    this._TILE_HEIGHT = this.TILE_WIDTH;
    this._H_TILES = this._HW_WIDTH / this.TILE_WIDTH;
    this._V_TILES = this._HW_HEIGHT / this._TILE_HEIGHT;

    this._mmu = mmu;
    this._ctxBG = ctxBG;
    this._ctxOBJ = ctxOBJ;
    this._cache = {};
    this._bgp = null;
    this._obg0 = null;
    this._obg1 = null;
    this._imageDataBG = this._ctxBG.createImageData(this._HW_WIDTH, this._HW_HEIGHT);
    this._imageDataOBJ = this._ctxOBJ.createImageData(this._HW_WIDTH, this._HW_HEIGHT);

    this._clear();
    this._clear(this._imageDataOBJ, this._ctxOBJ);
    this._readPalettes();
  }

  /**
   * Only for testing
   * @returns {MMU}
   */
  getMMU(){
    return this._mmu;
  }

  getImageDataBG(){
    return this._imageDataBG;
  }

  getImageDataOBJ(){
    return this._imageDataOBJ;
  }

  /**
   * @param {ImageData} imageData
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _putImageData(imageData=this._imageDataBG, ctx=this._ctxBG){
    ctx.putImageData(imageData, 0, 0);
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
    this._putImageData(imageData, ctx);
  }

  /** 
   * Draw all tiles on screen
   */
  /*drawTiles(){

    this._readPalettes();

    if (this._mmu._VRAMRefreshed) {
      this._clearMatrixCache();
      this._drawLineBG();
      this._mmu._VRAMRefreshed = false;

    } else if (this._mmu._LCDCUpdated){
      this._drawLineBG();
      this._mmu._LCDCUpdated = false;
    }

    if (this._mmu.areOBJOn()) {
      this._clear(this._imageDataOBJ, this._ctxOBJ);
      this._drawOBJ();
    }
  }*/

  /**
   * @param {number} line
   */
  drawLine(line=0){
    if (line >= this._HW_HEIGHT || line < 0) {
      Logger.warn(`Cannot draw line ${line}`);
      return;
    }
    this._drawLineBG(line);
    this._drawLineOBJ(line);
  }

  /**
   * @param {number} line
   * @private
   */
  _drawLineBG(line){
    for(let gridX = 0; gridX < this._H_TILES; gridX++){
      const gridY = this._getGridY(line);
      this._drawTileLine({
        tileNumber: this._mmu.getCharCode(gridX, gridY),
        gridX: gridX,
        gridY: gridY,
        line
      });
    }
    this._putImageData();
  }

  /**
   * @param tileNumber
   * @param gridX
   * @param line
   * @param OBJAttr
   * @param imageData
   */
  _drawTileLine({tileNumber, gridX, gridY, line, OBJAttr}, imageData=this._imageDataBG){

    const tileLine = line % this._TILE_HEIGHT;
    const x_start = gridX * this.TILE_WIDTH;
    const isOBJ = OBJAttr !== undefined;

    let intensityVector = this._getIntensityVector(tileNumber, tileLine, isOBJ);
    let palette = this._bgp;

    if(isOBJ){
      intensityVector = this._handleOBJAttributes(OBJAttr, intensityVector, gridX, gridY);
      palette = this._getOBJPalette(OBJAttr);
    }

    for(let i = 0; i < intensityVector.length; i++){
      this.drawPixel({x: x_start+i, y: line, level: intensityVector[i]}, palette, imageData);
    }
  }

  /**
   * @param {number} line: 0,1,2...
   * @returns {number} grid_y
   * @private
   */
  _getGridY(line=0){
    return Math.floor(line/this._TILE_HEIGHT);
  }

  /**
   * @private
   */
  _readPalettes(){
    this._bgp = LCD.paletteToArray(this._mmu.bgp());
    this._obg0 = LCD.paletteToArray(this._mmu.obg0());
    this._obg1 = LCD.paletteToArray(this._mmu.obg1());
  }

  /**
   * @private
   */
  _clearMatrixCache(){
    this._cache = {};
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
          gridX: (OBJ.x/this.TILE_WIDTH) - 1,
          gridY: (OBJ.y/this._TILE_HEIGHT) - 2,
          line: line,
          OBJAttr: OBJ.attr
        }, this._imageDataOBJ);
      }
    }
    this._putImageData(this._imageDataOBJ, this._ctxOBJ);
  }

  /**
   * @param {number} line
   * @param {number} coordY
   * @returns {boolean}
   * @private
   */
  _isOBJInLine(line, coordY){
    return line >= (coordY-0x10) && line <= (coordY-0x10 + 7);
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
   * @param {number} OBJAttr
   * @param {Array} intensityMatrix
   * @param {number} gridX
   * @param {number} gridY
   * @private
   */
  _handleOBJAttributes(OBJAttr, intensityMatrix, gridX, gridY){
    if ((OBJAttr & this._mmu.MASK_OBJ_ATTR_PRIORITY) === this._mmu.MASK_OBJ_ATTR_PRIORITY){

      const chrCode = this._mmu.getCharCode(gridX, gridY);
      const matrix = this._getIntensityVector(chrCode);

      // Exception: OBJ with priority flag are displayed only in the underneath BG is lightest
      if (!LCD._isLightestMatrix(matrix)){
        return new Array(64).fill(0);
      }
    }

    if ((OBJAttr & this._mmu.MASK_OBJ_ATTR_HFLIP) === this._mmu.MASK_OBJ_ATTR_HFLIP){
      intensityMatrix = LCD.flipMatrixHorizontally(intensityMatrix, this.TILE_WIDTH);
    }

    if ((OBJAttr & this._mmu.MASK_OBJ_ATTR_VFLIP) === this._mmu.MASK_OBJ_ATTR_VFLIP){
      intensityMatrix = LCD.flipMatrixVertically(intensityMatrix, this.TILE_WIDTH);
    }

    return intensityMatrix;
  }

  /**
   * @param {Array} matrix
   * @returns {boolean} true if the matrix is the lightest possible
   * @private
   */
  static _isLightestMatrix(matrix){
    for(let intensity of matrix){
      if (intensity > 0) return false;
    }
    return true;
  }

  /**
   * @param {number} tileNumber
   * @param {number} tileLine
   * @param {boolean} isOBJ
   * @returns {Array} palette matrix from cache, recalculated whenever VRAM is updated.
   * @private
   */
  _getIntensityVector(tileNumber, tileLine, isOBJ){
    let key = `BG_${tileNumber}_$${tileLine}`;

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
   * @param {boolean} isOBJ
   * @returns {Array}
   * @private
   */
  _calculateIntensityVector(tileNumber, tileLine, isOBJ){
    let tileLineData;
    if (isOBJ) {
      tileLineData = this._mmu.readOBJData(tileNumber);
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
   * Draws pixel in image data, given its coords and grey level
   * 
   * @param x
   * @param y
   * @param level
   * @param {Map} palette
   * @param {ImageData} imageData
   */
  drawPixel({x, y, level}, palette=this._bgp, imageData=this._imageDataBG) {
    
    if (level < 0 || level > 3){
      Logger.error(`Unrecognized level gray level ${level}`); 
      return;
    }

    if (x < 0 || y < 0) return;

    if ((palette === this._obg0 || palette === this._obg1) && level === 0) {
      return; // Transparent
    }

    const start = (x + y * this._HW_WIDTH) * 4;
    imageData.data.set(this.SHADES[palette[level]], start);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {ImageData} imageData
   * @returns {Array} pixel data
   */
  getPixelData(x, y, imageData){
    const index = (x + y * this._HW_WIDTH) * 4;
    return imageData.data.slice(index, index + 4);
  }

  /**
   * Flips a tile array horizontally
   * @param {Array} matrix
   * @param {number} matrix _HW_WIDTH
   * @returns {Array} flipped matrix
   */
  static flipMatrixHorizontally(matrix, width){
    const flipped = [];

    for(let line = 0; line < matrix.length; line += width){
      const flippedLine = matrix.slice(line, line + width).reverse();
      flipped.push(...flippedLine);
    }
    return flipped;
  }

  /**
   * @param {Array} matrix
   * @param {number} matrix width
   * @returns {Array} flipped matrix
   */
  static flipMatrixVertically(matrix, width){
    const flipped = [];
    for(let l = matrix.length; l > 0; l -= width){
      flipped.push(...matrix.slice(l - width, l));
    }
    return flipped;
  }
}