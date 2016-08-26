export default class LCD {

  constructor(mmu, ctx, width, height){
    this.mmu = mmu;
    this.ctx = ctx;
    this.width = width;
    this.height = height;

    this.imageData = ctx.createImageData(width, height);

    this.tileWidth = 8;
  }

  /**
   * @param {number} tile_number
   * @param {number} tile_x from 0x00 to 0x1f
   * @param {number} tile_y from 0x00 to 0x1f
   */
  drawTile({tile_number, grid_x, grid_y}){

    const x_start = grid_x * this.tileWidth;
    const y_start = grid_y * this.tileWidth;
    
    let x = x_start;
    let y = y_start;

    const tileBuffer = this.mmu.readTile(tile_number);
    const array = this._tileToMatrix(tileBuffer);
    
    for(let i = 0; i < array.length; i++){
      if (i > 0 && i % this.tileWidth === 0){
        x = x_start;
        y++;
      }
      this.drawPixel(x++, y, array[i]);
    }
    ctx.putImageData(this.imageData, 0, 0);
  }

  _tileToMatrix(buffer){
    const array = [];
    for(let i = 0; i < 16; i = i + 2){
      const value = buffer.readUInt8(i);
      const binary = value.toString(2);
      for (let b of binary){
        array.push(parseInt(b, 2));
      }
    }
    // TODO: support greys
    return array;
  }

  drawPixel(x, y, level) {
    var index = (x + y * this.width) * 4;
    if (level === 1){
      this.imageData.data[index + 0] = 0;
      this.imageData.data[index + 1] = 0;
      this.imageData.data[index + 2] = 0;
      this.imageData.data[index + 3] = 255;
    }
  }
}