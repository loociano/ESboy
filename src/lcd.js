import Utils from './utils';
import Logger from './logger';

export default class LCD {

  /**
   * @param {MMU|MMUMock} mmu
   * @param {CanvasRenderingContext2D|ContextMock} ctx
   */
  constructor(mmu, ctx){

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
    this._ctx = ctx;
    this._bgp = null;
    this._bgn = null; // will hold array of 8 bg colour palettes
    this._obg0 = null;
    this._obg1 = null;
    this._objn = null; // will hold array of 8 obj colour palettes
    this._imageData = this._ctx.createImageData(this._HW_WIDTH, this._HW_HEIGHT);
    this._IS_COLOUR = this._mmu.isGameInColor();

    this._clear();
    this._readPalettes();

    this.paint();
  }

  getImageData(){
    return this._imageData;
  }

  /**
   * @param {number} line 0..143
   */
  drawLine(line){
    if (line < 0 || line >= this._HW_HEIGHT) {
      Logger.warn(`Cannot draw line ${line}`);
      return;
    }
    this._readPalettes();
    this._drawLineBG(line);
    if (this._mmu.isWindowOn()) this._drawLineWindow(line);
    if (this._mmu.areOBJOn()) this._drawLineOBJ(line);
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
   * Writes (paints) the imageData into the actual HTML canvas (refresh)
   * NOTE: EXPENSIVE, should be called once per frame (not per line)
   */
  paint(){
    this._ctx.putImageData(this._imageData, 0, 0);
  }

  /**
   * Draws pixel in image data, given its coords and palette data nb
   *
   * @param {number} x
   * @param {number} y
   * @param {number} paletteDataNb 0-3
   * @param {Array} palette
   * @param {boolean} isOBJ
   */
  drawPixel({x, y, paletteDataNb}, palette=this._bgp, isOBJ) {

    if (paletteDataNb < 0 || paletteDataNb > 3){
      Logger.error(`Unrecognized palette data nb ${paletteDataNb}`);
      return;
    }

    if (x < 0 || y < 0 || x >= this._HW_WIDTH || y >= this._HW_HEIGHT) return;

    if (isOBJ && paletteDataNb === 0) {
      return; // Transparent
    }

    this._setPixelData(x, y, palette[paletteDataNb]);
  }

  /** 
   * Clears the LCD by writing transparent pixels
   * @private
   */
  _clear(){
    const size = this._HW_WIDTH * this._HW_HEIGHT * 4;
    for(let p = 0; p < size; p++){
      this._imageData.data[p] = 0;
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
    const tileLine = ((line + scy) % this._OUT_HEIGHT) % this._TILE_HEIGHT;

    for(let x = 0; x < max; x += this.TILE_WIDTH){
      const gridX = this._getHorizontalGrid(x);
      const gridY = this.getVerticalGrid(line, scy);
      const tileNumber = this._mmu.getBgCharCode(gridX, gridY);
      let palette = this._bgp;
      if (this._IS_COLOUR){
        palette = this._bgn[this._mmu.getBgPaletteNb(gridX, gridY)];
      }
      this._drawTileLine({
        tileNumber: tileNumber,
        tileLine: tileLine,
        startX: this._getScrolledX(x, scx)
      }, line, true /* isBG */, palette);
    }
  }

  /**
   * @param x
   * @param scx
   * @returns {number}
   * @private
   */
  _getScrolledX(x, scx){
    return (x + this._OUT_WIDTH - scx) % this._OUT_WIDTH;
  }

  /**
   * @param {number} line
   * @private
   */
  _drawLineOBJ(line){
    const doubleOBJ = this._mmu.areOBJDouble();

    for(let n = 0; n < this._mmu.MAX_OBJ; n++){
      const OBJ = this._mmu.getOBJ(n);
      if (LCD._isValidOBJ(OBJ)){

        let chrCode = OBJ.chrCode;
        if (doubleOBJ && (chrCode % 2 !== 0)){
          chrCode -= 1; // nearest even down
        }

        let topTileY = OBJ.y;
        let bottomTileY = OBJ.y + this._TILE_HEIGHT;
        const palette = this._getOBJPalette(OBJ.attr);

        if (doubleOBJ){
          if (this._isFlipY(OBJ.attr)){
            // Swap
            topTileY = OBJ.y + this._TILE_HEIGHT;
            bottomTileY = OBJ.y;
          }
          if (this._isOBJInLine(line, bottomTileY)){
            this._drawTileLine({
              tileNumber: chrCode + 1,
              tileLine: line - (bottomTileY - this._MAX_TILE_HEIGHT),
              startX: OBJ.x - this.TILE_WIDTH,
              OBJAttr: OBJ.attr,
            }, line, false/* isBg */, palette);
          }
        }

        if (this._isOBJInLine(line, topTileY)){
          this._drawTileLine({
            tileNumber: chrCode,
            tileLine: line - (topTileY - this._MAX_TILE_HEIGHT),
            startX: OBJ.x - this.TILE_WIDTH,
            OBJAttr: OBJ.attr,
          }, line, false/* isBg */, palette);
        }
      }
    }
  }

  /**
   * @param {number} line
   * @private
   */
  _drawLineWindow(line){
    const wy = this._mmu.wy();
    let wx = this._mmu.wx();
    if (wx < this._MIN_WINDOW_X) wx = this._MIN_WINDOW_X;

    if ( (line - wy < 0) || wx > this._MAX_WINDOW_X ) return;

    for(let x = 0; x < this._HW_WIDTH; x += this.TILE_WIDTH){
      const tileNumber = this._mmu.getWindowCharCode(this._getHorizontalGrid(x), this.getVerticalGrid(line - wy, 0));
      this._drawTileLine({
        tileNumber: tileNumber,
        tileLine: (line - wy) % this._TILE_HEIGHT,
        startX: x + wx - this._MIN_WINDOW_X
      }, line);
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
   * @param tileLine
   * @param startX
   * @param OBJAttr
   * @param line
   * @param isBG
   */
  _drawTileLine({tileNumber, tileLine, startX, OBJAttr}, line, isBG, palette=this._bgp){

    const isOBJ = OBJAttr !== undefined;
    let intensityVector = this._getIntensityVector(tileNumber, tileLine, isOBJ);

    if(isOBJ){
      intensityVector = this._handleOBJAttributes(intensityVector, tileNumber, tileLine, OBJAttr);
    }

    for(let i = 0; i < intensityVector.length; i++){
      let x = startX + i;
      if (isBG) {
        x %= this._OUT_WIDTH;
      }
      if(isOBJ) {
        if (this._hasBgPriority(OBJAttr)){
          if (this._isBgPixelFirstPaletteColor(x, line)){
            this.drawPixel({x: x, y: line, paletteDataNb: intensityVector[i]}, palette, isOBJ);
          }
        } else {
          this.drawPixel({x: x, y: line, paletteDataNb: intensityVector[i]}, palette, isOBJ);
        }
      } else {
        this.drawPixel({x: x, y: line, paletteDataNb: intensityVector[i]}, palette, isOBJ);
      }
    }
    return intensityVector;
  }

  /**
   * @param x
   * @param y
   * @returns {boolean} true if the pixel in background is painted with the first colour from
   * the background palette
   * @private
   */
  _isBgPixelFirstPaletteColor(x, y){
    const data = this._getPixelData(x, y);
    // TODO: implement for CGB
    return data[0] === this._bgp[0][0]
      && data[1] === this._bgp[0][1]
      && data[2] === this._bgp[0][2]
      && data[3] === this._bgp[0][3];
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {Array} value
   * @private
   */
  _setPixelData(x, y, value){
    this._imageData.data.set(value, (x + y * this._HW_WIDTH) * 4);
  }

  /**
   * @param x
   * @param y
   * @param imageData
   * @returns {Array}
   * @private
   */
  _getPixelData(x, y){
    const index = (x + y * this._HW_WIDTH) * 4;
    return this._imageData.data.slice(index, index + 4);
  }

  /**
   * Reads palettes
   * @private
   */
  _readPalettes(){
    if (this._IS_COLOUR) {
      this._bgn = this._transformPalettesFromMemory(this._mmu.getBgPalette);
      this._objn = this._transformPalettesFromMemory(this._mmu.getObjPalette);
    } else {
      this._bgp = this._generatePalette(this._mmu.bgp());
      this._obg0 = this._generatePalette(this._mmu.obg0());
      this._obg1 = this._generatePalette(this._mmu.obg1());
    }
  }

  /**
   * @param {function} mmuCallFn
   * @returns {Array}
   * @private
   */
  _transformPalettesFromMemory(mmuCallFn){
    const array = [];
    for (let p = 0; p < 8; p++) {
      const rgb15Palette = mmuCallFn.call(this._mmu, p);
      const rgba32Palette = rgb15Palette.map((i) => LCD.RGB15toRGBA32(i));
      array.push(rgba32Palette);
    }
    return array;
  }

  /**
   * @param source
   * @private
   */
  _generatePalette(source){
    const palette = [];
    const bgpOrder = LCD.paletteToArray(source);
    for(let i of bgpOrder){
      palette.push(this.SHADES[i]);
    }
    return palette;
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
    if (this._IS_COLOUR){
      return this._objn[OBJAttr & 0x07];
    } else {
      if ((OBJAttr & this._mmu.MASK_OBJ_ATTR_OBG) === 0){
        return this._obg0;
      } else {
        return this._obg1;
      }
    }
  }

  /**
   * @param {Array} intensityVector
   * @param {number} tileNumber
   * @param {number} tileLine
   * @param {number} OBJAttr
   * @private
   */
  _handleOBJAttributes(intensityVector, tileNumber, tileLine, OBJAttr){
    // Flipping order matters
    if (this._isFlipY(OBJAttr)){
      intensityVector = this._getIntensityVector(tileNumber, this._getVerticalMirrorLine(tileLine), true);
    }
    if (this._isFlipX(OBJAttr)){
      const copy = intensityVector.slice();
      copy.reverse();
      intensityVector = copy;
    }
    return intensityVector;
  }

  /**
   * @param OBJAttr
   * @returns {boolean}
   * @private
   */
  _hasBgPriority(OBJAttr){
    return (OBJAttr & this._mmu.MASK_OBJ_ATTR_PRIORITY) === this._mmu.MASK_OBJ_ATTR_PRIORITY;
  }

  /**
   * @param OBJAttr
   * @returns {boolean} true if the object should be flipped vertically
   * @private
   */
  _isFlipY(OBJAttr){
    return (OBJAttr & this._mmu.MASK_OBJ_ATTR_VFLIP) === this._mmu.MASK_OBJ_ATTR_VFLIP;
  }

  /**
   * @param OBJAttr
   * @returns {boolean} true if the object should be flipped horizontally
   * @private
   */
  _isFlipX(OBJAttr){
    return (OBJAttr & this._mmu.MASK_OBJ_ATTR_HFLIP) === this._mmu.MASK_OBJ_ATTR_HFLIP;
  }

  _getCharCodeByPx(x, y){
    return this._mmu.getBgCharCode(
      this._getHorizontalGrid(this._getScrolledX(x, this._mmu.scx())),
      this.getVerticalGrid(y, this._mmu.scy())
    );
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
   * Calculates palette matrix given a tile number.
   * Expensive operation.
   * @param {number} tileNumber
   * @param {number} tileLine
   * @param {boolean} isOBJ
   * @returns {Array}
   * @private
   */
  _getIntensityVector(tileNumber, tileLine, isOBJ){
    let tileLineData;
    if (isOBJ) {
      tileLineData = this._mmu.readOBJData(tileNumber, tileLine);
    } else {
      tileLineData = this._mmu.readBGData(tileNumber, tileLine);
    }
    return LCD.tileToIntensityVector(tileLineData);
  }

  /**
   * Converts a 16 bits tile buffer into array of levels [0-3]
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
    if (OBJ == null) return false;
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
   * @param {Array} rgb15
   * @returns {Array} rgba32
   * @constructor
   */
  static RGB15toRGBA32(rgb15){
    const rgba24 = rgb15.map( (i) => i*8 );
    rgba24.push(255);
    return rgba24;
  }
}