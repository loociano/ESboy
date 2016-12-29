import assert from 'assert';
import LCD from '../src/lcd';
import MMU from '../src/mmu';
import ContextMock from './mock/contextMock';
import MMUMock from './mock/mmuMock';
import {describe, beforeEach, it} from 'mocha';

describe('LCD', () => {

  let lcd;

  beforeEach(function() {
    lcd = new LCD(new MMUMock(), new ContextMock(), new ContextMock());
  });

  it('should transform a Nintendo tile buffer into a matrix', () => {
    const array = LCD.tileToMatrix(new Buffer('3c004200b900a500b900a50042003c00', 'hex'));
    assert.deepEqual(array, [0,0,1,1,1,1,0,0,
                             0,1,0,0,0,0,1,0,
                             1,0,1,1,1,0,0,1,
                             1,0,1,0,0,1,0,1,
                             1,0,1,1,1,0,0,1,
                             1,0,1,0,0,1,0,1,
                             0,1,0,0,0,0,1,0,
                             0,0,1,1,1,1,0,0]);
  });

  it('should transform a tile buffer into levels of gray matrix', () => {
    const array = LCD.tileToMatrix(new Buffer('5533aacc5533aacc5533aacc5533aacc', 'hex'));
    assert.deepEqual(array, [0,1,2,3,0,1,2,3,
                             3,2,1,0,3,2,1,0,
                             0,1,2,3,0,1,2,3,
                             3,2,1,0,3,2,1,0,
                             0,1,2,3,0,1,2,3,
                             3,2,1,0,3,2,1,0,
                             0,1,2,3,0,1,2,3,
                             3,2,1,0,3,2,1,0]);
  });

  it('should transform a tile buffer into a the lightest matrix', () => {
    const array = LCD.tileToMatrix(new Buffer('00000000000000000000000000000000', 'hex'));
    assert.deepEqual(array, [0,0,0,0,0,0,0,0,
                             0,0,0,0,0,0,0,0,
                             0,0,0,0,0,0,0,0,
                             0,0,0,0,0,0,0,0,
                             0,0,0,0,0,0,0,0,
                             0,0,0,0,0,0,0,0,
                             0,0,0,0,0,0,0,0,
                             0,0,0,0,0,0,0,0]);
  });

  it('should transform a tile buffer into a darkest matrix', () => {
    const array = LCD.tileToMatrix(new Buffer('ffffffffffffffffffffffffffffffff', 'hex'));
    assert.deepEqual(array, [3,3,3,3,3,3,3,3,
                             3,3,3,3,3,3,3,3,
                             3,3,3,3,3,3,3,3,
                             3,3,3,3,3,3,3,3,
                             3,3,3,3,3,3,3,3,
                             3,3,3,3,3,3,3,3,
                             3,3,3,3,3,3,3,3,
                             3,3,3,3,3,3,3,3]);
  });

  it('should write pixel data', () => {

    const WIDTH = lcd._HW_WIDTH;
    const HEIGHT = lcd._HW_HEIGHT;
    const lastIndex = WIDTH*HEIGHT*4 - 1;
    const data = lcd.getImageDataBG().data;

    let pixel = {x: 0, y:0, level:0};
    lcd.drawPixel(pixel);

    assert.deepEqual([data[0], data[1], data[2], data[3]], lcd.SHADES[lcd._bgp[pixel.level]]);

    pixel = {x: 1, y:0, level: 1};
    lcd.drawPixel(pixel);

    assert.deepEqual([data[4], data[5], data[6], data[7]], lcd.SHADES[lcd._bgp[pixel.level]]);

    pixel = {x: WIDTH-1, y:0, level:2};
    lcd.drawPixel(pixel);

    assert.deepEqual([data[WIDTH*4-4], data[WIDTH*4-3], data[WIDTH*4-2], data[WIDTH*4-1]], lcd.SHADES[lcd._bgp[pixel.level]]);

    pixel = {x: WIDTH-1, y:HEIGHT-1, level:3};
    lcd.drawPixel(pixel);

    assert.deepEqual([data[lastIndex-3], data[lastIndex-2], data[lastIndex-1], data[lastIndex]], lcd.SHADES[lcd._bgp[pixel.level]]);
  });

  it('should not write tiles out of screen', () => {
    lcd.mmu.readBGData = () => { return new Buffer('ffffffffffffffffffffffffffffffff', 'hex'); };
    const bg = lcd.getImageDataBG();

    // Max x is 19
    lcd.drawTile({tile_number: 0, grid_x: 20, grid_y: 0});

    assert.deepEqual(bg, lcd.getImageDataBG(), 'No change');

    // Max y is 17
    lcd.drawTile({tile_number: 0, grid_x: 0, grid_y: 18});

    assert.deepEqual(bg, lcd.getImageDataBG(), 'No change');
  });

  it('should write darkest tiles on screen', () => {

    lcd.mmu.readBGData = () => { return new Buffer('ffffffffffffffffffffffffffffffff', 'hex'); };

    lcd.drawTile({tile_number: 1, grid_x: 0, grid_y: 0});
    lcd.drawTile({tile_number: 1, grid_x: 10, grid_y: 9});
    lcd.drawTile({tile_number: 1, grid_x: 19, grid_y: 17});

    assertDarkestTile.call(lcd, 0, 0, lcd.getImageDataBG());
    assertDarkestTile.call(lcd, 10, 9, lcd.getImageDataBG());
    assertDarkestTile.call(lcd, 19, 17, lcd.getImageDataBG());
  });

  describe('OBJ (Sprites)', () => {
    it('should write OBJ on top of BG', () => {

      lcd.mmu.readBGData = (any) => { return new Buffer('00000000000000000000000000000000', 'hex'); };
      lcd.mmu.readOBJData = (any) => { return new Buffer('ffffffffffffffffffffffffffffffff', 'hex'); };
      lcd.mmu.getOBJ = function(obj_number) {
        if (obj_number === 0) {
          return {y: 16, x: 8, chrCode: 0x01, attr: 0x00};
        } else if (obj_number === 1){
          return {y: 8, x: 0, chrCode: 0x01, attr: 0x00}; // hidden as x < 8 and y < 16
        } else {
          return {y: 0, x: 0, chrCode: 0x00, attr: 0x00}; // Empty OBJ, should not paint
        }
      };
      lcd.mmu.getCharCode = (any) => { return 0x00; };
      lcd.mmu._VRAMRefreshed = true;

      lcd.drawTiles();

      for(let x = 0; x < lcd.H_TILES; x++){
        for(let y = 0; y < lcd.V_TILES; y++){
          if (x === 0 && y === 0){
            assertDarkestTile.call(lcd, x, y, lcd.getImageDataOBJ());
          } else {
            assertLightestTile.call(lcd, x, y, lcd.getImageDataBG());
          }
        }
      }
    });

    it('should detect transparency on OBJ', () => {

      lcd.mmu.readOBJData = () => { return new Buffer('00000000000000000000000000000000', 'hex'); };
      lcd.mmu.getOBJ = () => { return {y: 16, x: 8, chrCode: 0x00, attr: 0x00}; };
      lcd.mmu.getCharCode = () => { return 0x00; };
      lcd.mmu.obg0 = () => { return 0b11100100; };

      lcd.drawTiles();

      // Everything must be darkest, as the OBJ is all transparent
      assertTransparentTile.call(lcd, 0, 0, lcd.getImageDataOBJ());
    });

    it('should not paint pixels 00 from OBJ regardless of their palette', () => {
      lcd.mmu.readOBJData = () => { return new Buffer('00000000000000000000000000000000', 'hex'); };
      lcd.mmu.getOBJ = () => { return {y: 16, x: 8, chrCode: 0x00, attr: 0x00}; };
      lcd.mmu.getCharCode = () => { return 0x00; };
      lcd.mmu.obg0 = () => { return 0b11111111; }; // force lightest level bit0,1 to darkest

      lcd.drawTiles();

      // Still, no OBJ is painted as the buffer is zero
      assertTransparentTile.call(lcd, 0, 0, lcd.getImageDataOBJ());
    });

    it('should transform palettes to intensity array', () => {
      assert.deepEqual(LCD.paletteToArray(0b11100100), [0, 1, 2, 3]);
      assert.deepEqual(LCD.paletteToArray(0b00000000), [0, 0, 0, 0]);
      assert.deepEqual(LCD.paletteToArray(0b11111111), [3, 3, 3, 3]);
    });

    it('should detect palette on OBJ', () => {

      lcd.mmu.readOBJData = () => { return new Buffer('ff00ff00ff00ff00ff00ff00ff00ff00', 'hex'); };
      lcd.mmu.getCharCode = () => { return 0x00; };
      lcd.mmu.getOBJ = () => { return {y: 16, x: 8, chrCode: 0x00, attr: 0x00}; };
      lcd.mmu.obg0 = () => { return 0b00000000; };

      lcd.drawTiles();

      assertTile.call(lcd, 0, 0, lcd.SHADES[0], lcd.getImageDataOBJ());

      // Use OBG1
      lcd.mmu.getOBJ = () => { return {y: 16, x: 8, chrCode: 0x00, attr: 0x10}; };
      lcd.mmu.obg1 = () => { return 0b00000100; };

      lcd.drawTiles();

      assertTile.call(lcd, 0, 0, lcd.SHADES[1], lcd.getImageDataOBJ());

      lcd.mmu.obg1 = () => { return 0b00001000; };

      lcd.drawTiles();

      assertTile.call(lcd, 0, 0, lcd.SHADES[2], lcd.getImageDataOBJ());

      lcd.mmu.obg1 = () => { return 0b00001100; };

      lcd.drawTiles();

      assertTile.call(lcd, 0, 0, lcd.SHADES[3], lcd.getImageDataOBJ());
    });

    it('should flip matrix horizontally', () => {
      const matrix =  [3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0];
      const flipped = [0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3];

      assert.deepEqual(lcd.flipMatrixHorizontally(matrix), flipped);
    });

    it('should flip matrix vertically', () => {
      const matrix =  [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
      const flipped = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,];

      assert.deepEqual(lcd.flipMatrixVertically(matrix), flipped);
    });

    it('should flip matrix both horizontally and vertically', () => {
      // x0 --> 00
      // 00     0x
      const matrix =  [3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
      const flipped = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3];

      assert.deepEqual(lcd.flipMatrixHorizontally(lcd.flipMatrixVertically(matrix)), flipped);
    });

    it('should flip OBJ horizontally', () => {

      lcd.mmu.getOBJ = (any) => { return {y: 16, x: 8, chrCode: 0x00, attr: 0b00100000}; };

      lcd.mmu.readOBJData = (any) => {
        // Left half is darkest, right half is transparent
        return new Buffer('f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0', 'hex');
      };

      lcd.drawTiles();

      for(let x = 0; x < 8; x++){
        for(let y = 0; y < 8; y++){
          if (x < 4){
            assert.deepEqual(lcd.getPixelData(x, y, lcd.getImageDataOBJ()), [0, 0, 0, 0], 'Left half is transparent');
          } else {
            assert.deepEqual(lcd.getPixelData(x, y, lcd.getImageDataOBJ()), lcd.SHADES[3], 'Right half is darkest');
          }
        }
      }

    });

    it('should flip OBJ vertically', () => {

      lcd.mmu.getOBJ = (any) => { return {y: 16, x: 8, chrCode: 0x00, attr: 0b01000000}; };

      lcd.mmu.readOBJData = (any) => {
        // Top half is darkest, bottom half is transparent
        return new Buffer('ffffffffffffffff0000000000000000', 'hex');
      };

      lcd.drawTiles();

      for(let x = 0; x < 8; x++){
        for(let y = 0; y < 8; y++){
          if (y < 4){
            assert.deepEqual(lcd.getPixelData(x, y, lcd.getImageDataOBJ()), [0, 0, 0, 0], 'Top half is transparent');
          } else {
            assert.deepEqual(lcd.getPixelData(x, y, lcd.getImageDataOBJ()), lcd.SHADES[3], 'Bottom half is darkest');
          }
        }
      }

    });

    it('should detect OBJ priority flag', () => {

      lcd.mmu.readBGData = (any) => { return new Buffer('ffffffffffffffffffffffffffffffff', 'hex'); };
      lcd.mmu.readOBJData = (any) => { return new Buffer('ff00ff00ff00ff00ff00ff00ff00ff00', 'hex'); };
      lcd.mmu.getCharCode = (any) => { return 0x00; };
      lcd.mmu.getOBJ = (any) => { return {y: 16, x: 8, chrCode: 0x00, attr: 0b00000000}; };
      lcd.mmu.obg0 = () => { return 0b11100100; };

      lcd.drawTiles();

      assertTile.call(lcd, 0, 0, lcd.SHADES[1], lcd.getImageDataOBJ());

      // Priority flag: BG over OBJ
      lcd.mmu.getOBJ = (any) => { return {y: 16, x: 8, chrCode: 0x00, attr: 0b10000000}; };

      lcd.drawTiles();

      assertTransparentTile.call(lcd, 0, 0, lcd.getImageDataOBJ());
    });

    it('should display an OBJ with a priority flag only if the BG behind is zero', () => {

      lcd.mmu.readBGData = (any) => { return new Buffer('00000000000000000000000000000000', 'hex'); };
      lcd.mmu.readOBJData = (any) => { return new Buffer('ff00ff00ff00ff00ff00ff00ff00ff00', 'hex'); };
      lcd.mmu.getCharCode = (any) => { return 0x00; };
      lcd.mmu.getOBJ = (any) => { return {y: 16, x: 8, chrCode: 0x00, attr: 0b10000000}; };
      lcd.mmu.obg0 = () => { return 0b11100100; };

      lcd.drawTiles();

      assertTile.call(lcd, 0, 0, lcd.SHADES[1], lcd.getImageDataOBJ());
    });
  });

  describe('Scaling', () => {

    it('should scale an imageData', () => {
      const width = 2;
      const data2x2 = [0,0,0,0, 1,1,1,1, 2,2,2,2, 3,3,3,3];

      assert.deepEqual(LCD.scaleImageData(data2x2, width, 1), data2x2);
      assert.deepEqual(LCD.scaleImageData(data2x2, width, 2),
        [ 0,0,0,0, 0,0,0,0, 1,1,1,1, 1,1,1,1,
          0,0,0,0, 0,0,0,0, 1,1,1,1, 1,1,1,1,
          2,2,2,2, 2,2,2,2, 3,3,3,3, 3,3,3,3,
          2,2,2,2, 2,2,2,2, 3,3,3,3, 3,3,3,3 ]);
      assert.deepEqual(LCD.scaleImageData(data2x2, width, 3),
        [ 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,1,1,1, 1,1,1,1, 1,1,1,1,
          0,0,0,0, 0,0,0,0, 0,0,0,0, 1,1,1,1, 1,1,1,1, 1,1,1,1,
          0,0,0,0, 0,0,0,0, 0,0,0,0, 1,1,1,1, 1,1,1,1, 1,1,1,1,
          2,2,2,2, 2,2,2,2, 2,2,2,2, 3,3,3,3, 3,3,3,3, 3,3,3,3,
          2,2,2,2, 2,2,2,2, 2,2,2,2, 3,3,3,3, 3,3,3,3, 3,3,3,3,
          2,2,2,2, 2,2,2,2, 2,2,2,2, 3,3,3,3, 3,3,3,3, 3,3,3,3 ]);

      const data3x1 = [0,0,0,0, 1,1,1,1, 2,2,2,2, 3,3,3,3, 4,4,4,4, 5,5,5,5];

      assert.deepEqual(LCD.scaleImageData(data3x1, 3, 2),
        [ 0,0,0,0, 0,0,0,0, 1,1,1,1, 1,1,1,1, 2,2,2,2, 2,2,2,2,
          0,0,0,0, 0,0,0,0, 1,1,1,1, 1,1,1,1, 2,2,2,2, 2,2,2,2,
          3,3,3,3, 3,3,3,3, 4,4,4,4, 4,4,4,4, 5,5,5,5, 5,5,5,5,
          3,3,3,3, 3,3,3,3, 4,4,4,4, 4,4,4,4, 5,5,5,5, 5,5,5,5 ]);
    });

  });
});

/**
 * Asserts that each pixel of a tile at x,y equals to rbga
 * @param grid_x
 * @param grid_y
 * @param {array} rgba
 */
function assertTile(grid_x, grid_y, rgba, imageData){

  for(let x = grid_x*8; x < (grid_x+1)*8; x++){
    for(let y = grid_y*8; y < (grid_y+1)*8; y++){
       assert.deepEqual(this.getPixelData(x, y, imageData), rgba, `Tile: ${grid_x},${grid_y} x=${x}, y=${y} pixel data ${rgba}`);
    } 
  }
}

function assertDarkestTile(grid_x, grid_y, imageData){
  assertTile.call(this, grid_x, grid_y, this.SHADES[3], imageData);
}

function assertLightestTile(grid_x, grid_y, imageData){
  assertTile.call(this, grid_x, grid_y, this.SHADES[0], imageData);
}

function assertTransparentTile(grid_x, grid_y, imageData){
  assertTile.call(this, grid_x, grid_y, [0, 0, 0, 0], imageData);
}
