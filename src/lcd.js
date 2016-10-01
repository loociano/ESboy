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
  _clearMatrixCache(){
    this._cache = {};
  }

  /**
   * Draws the background tiles
   * @private
   */
  _drawBG(){
    for(let x = 0; x < this.H_TILES; x++){
      for(let y = 0; y < this.V_TILES; y++){
        this.drawTile({
          tile_number: this.mmu.getCharCode(x, y),
          grid_x: x,
          grid_y: y
        });
      }
    }
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
   * @param {number} tile_x from 0x00 to 0x1f [0-31]
   * @param {number} tile_y from 0x00 to 0x1f [0-31]
   * @param {Object} imageData
   * @param {Object} context
   */
  drawTile({tile_number, grid_x, grid_y, OBJAttr}, imageData=this.imageDataBG, ctx=this.ctxBG){

    const x_start = grid_x * this.TILE_WIDTH;
    const y_start = grid_y * this.TILE_HEIGHT;

    let x = x_start;
    let y = y_start;

    const isOBJ = OBJAttr !== undefined;

    let intensityMatrix = this._getMatrix(tile_number, isOBJ);

    if(isOBJ){
      intensityMatrix = this._handleOBJAttributes(OBJAttr, intensityMatrix);
    }

    for(let i = 0; i < intensityMatrix.length; i++){
      if (i > 0 && i % this.TILE_WIDTH === 0){
        x = x_start;
        y++;
      }
      this.drawPixel(x++, y, intensityMatrix[i], imageData);
    }

    ctx.putImageData(imageData, 0, 0);
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
   * Example: [1, 0, 2, 3, 0, 1 ...]  
   * @param {Buffer} buffer
   * @returns {Array}
   */
  static tileToMatrix(buffer){
    const array = [];
    for(let i = 0; i < 16; i++){
      
      const msb = Utils.toBin8(buffer[i++]);
      const lsb = Utils.toBin8(buffer[i]);

      for(let b = 0; b < 8; b++){
        array.push( (parseInt(msb[b], 2) << 1) + parseInt(lsb[b], 2));
      }
    }
    return array; // TODO: cache array for speed
  }

  /**
   * Draws pixel in image data, given its coords and grey level
   * 
   * @param {number} x
   * @param {number} y
   * @param {number} level of gray [0-3]
   */
  drawPixel(x, y, level, imageData=this.imageDataBG) {
    
    if (level < 0 || level > 3){
      Logger.error(`Unrecognized level gray level ${level}`); 
      return;
    }

    let intensity = level * 85; // 255/3
    const index = (x + y * this.width) * 4;
    const alpha = level === 0 ? 0 : 255;

    imageData.data[index + 0] = 255 - intensity;
    imageData.data[index + 1] = 255 - intensity;
    imageData.data[index + 2] = 255 - intensity;
    imageData.data[index + 3] = alpha;
  }

  /**
   * @param x
   * @param y
   * @returns {Array} pixel imageData
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