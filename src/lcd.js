import Utils from './utils';
import Logger from './logger';

export default class LCD {

  constructor(mmu, ctx, width, height){
    
    this.mmu = mmu;
    this.ctx = ctx;
    this.width = width;
    this.height = height;

    this.imageData = ctx.createImageData(width, height);

    // Constants
    this.TILE_WIDTH = 8;
    this.TILE_HEIGHT = this.TILE_WIDTH;
  }

  drawTiles(){
    for(let x = 0; x < 0x14; x++){
      for(let y = 0; y < 0x12; y++){
        this.drawTile({tile_number: this.mmu.getTileNbAtCoord(x, y), grid_x: x, grid_y: y});
      }
    }
  }

  /**
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
    ctx.putImageData(this.imageData, 0, 0);
  }

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

  drawPixel(x, y, level) {
    
    if (level === 0) return;

    var index = (x + y * this.width) * 4;
    let intensity;

    switch(level){
      case 1: intensity = 85; break;
      case 2: intensity = 170; break;
      case 3: intensity = 255; break;
      default: 
        Logger.error(`Unrecognized level gray level ${level}`); 
        return;
    }

    this.imageData.data[index + 0] = intensity;
    this.imageData.data[index + 1] = intensity;
    this.imageData.data[index + 2] = intensity;
    this.imageData.data[index + 3] = 255; // alpha channel, always opaque
  }
}