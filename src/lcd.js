import Utils from './utils';
import Logger from './logger';

export default class LCD {

  constructor(mmu, ctx, width, height){
    
    this.mmu = mmu;
    this.ctx = ctx;
    this.width = width;
    this.height = height;

    this.imageData = this.ctx.createImageData(this.width, this.height);

    // Constants
    this.TILE_WIDTH = 8;
    this.TILE_HEIGHT = this.TILE_WIDTH;

    this.H_TILES = width / this.TILE_WIDTH;
    this.V_TILES = height / this.TILE_HEIGHT;

    this.VBLANK = 10;

    this._clear();
  }

  /** 
   * Clears the LCD by writing transparent pixels
   * @private
   */
  _clear(){
    for(let p = 0; p < this.width * this.height * 4; p++){
      this.imageData.data[p] = 0;
    }
  }

  /** 
   * Draw all tiles on screen
   */
  drawTiles(){
    for(let x = 0; x < this.H_TILES; x++){
      for(let y = 0; y < this.V_TILES; y++){
        this.drawTile({tile_number: this.mmu.getCharCode(x, y), grid_x: x, grid_y: y});
      }
    }
  }

  /**
   * Draws all pixels from a tile in the image data
   *
   * @param {number} tile_number
   * @param {number} tile_x from 0x00 to 0x1f
   * @param {number} tile_y from 0x00 to 0x1f
   */
  drawTile({tile_number, grid_x, grid_y}){

    const x_start = grid_x * this.TILE_WIDTH;
    const y_start = grid_y * this.TILE_HEIGHT;

    let x = x_start;
    let y = y_start;

    const tileBuffer = this.mmu.readTile(tile_number);
    const array = LCD.tileToMatrix(tileBuffer);

    for(let i = 0; i < array.length; i++){
      if (i > 0 && i % this.TILE_WIDTH === 0){
        x = x_start;
        y++;
      }
      this.drawPixel(x++, y, array[i]);
    }

    this.ctx.putImageData(this.imageData, 0, 0);
  }

  /**
   * Converts a 16 bits tile buffer into array of level of grays [0-3]
   * Example: [1, 0, 2, 3, 0, 1 ...]  
   * @param {Buffer} buffer
   */
  static tileToMatrix(buffer){
    const array = [];
    for(let i = 0; i < 16; i++){
      
      const msb = Utils.toBin8(buffer.readUInt8(i++));
      const lsb = Utils.toBin8(buffer.readUInt8(i));

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
  drawPixel(x, y, level) {
    
    if (level < 0 || level > 3){
      Logger.error(`Unrecognized level gray level ${level}`); 
      return;
    }

    let intensity = level * 85; // 255/3
    const index = (x + y * this.width) * 4;
    const alpha = level === 0 ? 0 : 255;

    this.imageData.data[index + 0] = 255 - intensity;
    this.imageData.data[index + 1] = 255 - intensity;
    this.imageData.data[index + 2] = 255 - intensity;
    this.imageData.data[index + 3] = alpha;
  }

  getPixelData(x, y){
    const index = (x + y * this.width) * 4;
    return this.imageData.data.slice(index, index + 4);
  }

  isControlOp(){
    return ((this.mmu.lcdc() & 0x80) >> 7) === 1;
  }

  getTileDataSelect(){
    return (this.mmu.lcdc() & 0x10) >> 4;
  }
}