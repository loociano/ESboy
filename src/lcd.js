import Utils from './utils';
import Logger from './logger';

export default class LCD {

  constructor(mmu, ctxBG, ctxOBJ, width, height){
    
    this.mmu = mmu;
    this.ctxBG = ctxBG;
    this.ctxOBJ = ctxOBJ;
    this.width = width;
    this.height = height;

    this.imageDataBG = this.ctxBG.createImageData(this.width, this.height);
    this.imageDataOBJ = this.ctxOBJ.createImageData(this.width, this.height);

    // Constants
    this.TILE_WIDTH = 8;
    this.TILE_HEIGHT = this.TILE_WIDTH;

    this.H_TILES = width / this.TILE_WIDTH;
    this.V_TILES = height / this.TILE_HEIGHT;

    this._clear();
    this._clear(this.imageDataOBJ, this.ctxOBJ);

    this._cache = {};

    this.SHADES = {
      0: [155,188,15,255],
      1: [139,172,15,255],
      2: [48,98,48,255],
      3: [15,56,15,255]
    };

    this._readPalettes();
  }

  /** 
   * Clears the LCD by writing transparent pixels
   * @private
   */
  _clear(imageData=this.imageDataBG, ctx=this.ctxBG){
    for(let p = 0; p < this.width * this.height * 4; p++){
      imageData.data[p] = 0;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  /** 
   * Draw all tiles on screen
   */
  drawTiles(){

    this._readPalettes();

    if (this.mmu._VRAMRefreshed) {
      this._clearMatrixCache();
      this._drawBG();
      this.mmu._VRAMRefreshed = false;

    } else if (this.mmu._LCDCUpdated){
      this._drawBG();
      this.mmu._LCDCUpdated = false;
    }

    if (this.mmu.areOBJOn()) {
      this._clear(this.imageDataOBJ, this.ctxOBJ);
      this._drawOBJ();
    }
  }

  /**
   * @private
   */
  _readPalettes(){
    this._bgp = LCD.paletteToArray(this.mmu.bgp());
    this._obg0 = LCD.paletteToArray(this.mmu.obg0());
    this._obg1 = LCD.paletteToArray(this.mmu.obg1());
  }

  /**
   * @private
   */
  _clearMatrixCache(){
    this._cache = {};
  }

  /**
   * Draws the background tiles
   * @private
   */
  _drawBG(){
    for(let grid_x = 0; grid_x < this.H_TILES; grid_x++){
      for(let grid_y = 0; grid_y < this.V_TILES; grid_y++){
        this.drawTile({
          tile_number: this.mmu.getCharCode(grid_x, grid_y),
          grid_x: grid_x,
          grid_y: grid_y
        });
      }
    }
    this.ctxBG.putImageData(this.imageDataBG, 0, 0);
  }

  /**
   * Draws the objects (OBJ, sprites) tiles
   * @private
   */
  _drawOBJ(){
    for(let n = 0; n < this.mmu.MAX_OBJ; n++){
      const OBJ = this.mmu.getOBJ(n);
      if (this._isValidOBJ(OBJ)) {
        this.drawTile({
          tile_number: OBJ.chrCode,
          grid_x: (OBJ.x/this.TILE_WIDTH) - 1,
          grid_y: (OBJ.y/this.TILE_HEIGHT) - 2,
          OBJAttr: OBJ.attr
        }, this.imageDataOBJ, this.ctxOBJ);
      }
    }
    this.ctxOBJ.putImageData(this.imageDataOBJ, 0, 0);
  }

  /**
   * @param OBJ
   * @returns {boolean}
   * @private
   */
  _isValidOBJ(OBJ){
    return OBJ.x !== 0 || OBJ.y !== 0 || OBJ.chrCode !== 0 || OBJ.attr !== 0;
  }

  /**
   * Draws all pixels from a tile in the image data
   *
   * @param {number} tile_number
   * @param {number} grid_x from 0x00 to 0x13 [0-19]
   * @param {number} grid_y from 0x00 to 0x12 [0-17]
   * @param {Object} imageData
   * @param {Object} context
   */
  drawTile({tile_number, grid_x, grid_y, OBJAttr}, imageData=this.imageDataBG, ctx=this.ctxBG){

    if (grid_x > this.H_TILES-1 || grid_y > this.V_TILES-1) return;

    const x_start = grid_x * this.TILE_WIDTH;
    const y_start = grid_y * this.TILE_HEIGHT;

    let x = x_start;
    let y = y_start;

    const isOBJ = OBJAttr !== undefined;

    let intensityMatrix = this._getMatrix(tile_number, isOBJ);
    let palette = this._bgp;

    if(isOBJ){
      intensityMatrix = this._handleOBJAttributes(OBJAttr, intensityMatrix);
      palette = this._getOBJPalette(OBJAttr);
    }

    for(let i = 0; i < intensityMatrix.length; i++){
      if (i > 0 && i % this.TILE_WIDTH === 0){
        x = x_start;
        y++;
      }
      this.drawPixel({x: x++, y: y, level: intensityMatrix[i]}, palette, imageData);
    }
  }

  /**
   * @param OBJAttr
   * @returns {Array}
   * @private
   */
  _getOBJPalette(OBJAttr){
    if ((OBJAttr & this.mmu.MASK_OBJ_ATTR_OBG) === 0){
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
   * @private
   */
  _handleOBJAttributes(OBJAttr, intensityMatrix){
    if ((OBJAttr & this.mmu.MASK_OBJ_ATTR_HFLIP) === this.mmu.MASK_OBJ_ATTR_HFLIP){
      intensityMatrix = this.flipMatrixHorizontally(intensityMatrix);
    }
    return intensityMatrix;
  }

  /**
   * @param {number} tile_number
   * @param {boolean} isOBJ
   * @returns {Array} palette matrix from cache, recalculated whenever VRAM is updated.
   * @private
   */
  _getMatrix(tile_number, isOBJ){
    let key = `BG${tile_number}`;

    if (isOBJ){
      key = `OBJ${tile_number}`;
    }

    const cached = this._cache[key];
    if (cached){
      return cached;
    } else {
      const matrix = this._calculateMatrix(tile_number, isOBJ);
      this._cache[key] = matrix;
      return this._cache[key];
    }
  }

  /**
   * Calculates palette matrix given a tile number.
   * Expensive operation.
   * @param {number} tile_number
   * @param {boolean} isOBJ
   * @returns {Array}
   * @private
   */
  _calculateMatrix(tile_number, isOBJ){
    let tile;
    if (isOBJ) {
      tile = this.mmu.readOBJData(tile_number);
    } else {
      tile = this.mmu.readBGData(tile_number);
    }
    return LCD.tileToMatrix(tile);
  }

  /**
   * Converts a 16 bits tile buffer into array of level of grays [0-3]
   * Example:
   * 0x0000 -> [0,0,0,0,0,0,0,0]
   * 0xff00 -> [1,1,1,1,1,1,1,1]
   * 0x00ff -> [2,2,2,2,2,2,2,2]
   * 0xffff -> [3,3,3,3,3,3,3,3]
   *
   * @param {Buffer} buffer
   * @returns {Array}
   */
  static tileToMatrix(buffer){
    const array = [];
    for(let i = 0; i < 16; i++){

      const msb = Utils.toBin8(buffer[i++]);
      const lsb = Utils.toBin8(buffer[i]);

      for(let b = 0; b < 8; b++){
        array.push( (parseInt(lsb[b], 2) << 1) + parseInt(msb[b], 2));
      }
    }
    return array;
  }

  /**
   * Draws pixel in image data, given its coords and grey level
   * 
   * @param {Object} pixel
   * @param {Map} palette
   * @param {Object} imageData
   */
  drawPixel({x, y, level}, palette=this._bgp, imageData=this.imageDataBG) {
    
    if (level < 0 || level > 3){
      Logger.error(`Unrecognized level gray level ${level}`); 
      return;
    }

    if (x < 0 || y < 0) return;

    const shade = palette[level];

    if ((palette === this._obg0 || palette === this._obg1) && shade === 0) {
      return; // Transparent
    }

    const start = (x + y * this.width) * 4;
    imageData.data.set(this.SHADES[shade], start);
  }

  /**
   * @param x
   * @param y
   * @returns {Object} pixel imageData
   */
  getPixelData(x, y, imageData){
    const index = (x + y * this.width) * 4;
    return imageData.data.slice(index, index + 4);
  }

  /**
   * Flips a tile array horizontally
   * @param {Array} matrix
   * @returns {Array}
   */
  flipMatrixHorizontally(matrix){
    const flipped = [];

    for(let line = 0; line < matrix.length; line += this.TILE_WIDTH){
      const flippedLine = matrix.slice(line, line + this.TILE_WIDTH).reverse();
      flipped.push(...flippedLine);
    }
    return flipped;
  }
}