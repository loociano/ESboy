import assert from 'assert';
import LCD from '../src/lcd';
import MMU from '../src/mmu';
import ContextMock from './mock/contextMock';
import MMUMock from './mock/mmuMock';
import {describe, beforeEach, it} from 'mocha';

describe('LCD', () => {

  let lcd;
  const WIDTH = 160;
  const HEIGHT = 144;

  beforeEach(function() {
    lcd = new LCD(new MMUMock(), new ContextMock(), new ContextMock(), WIDTH, HEIGHT);
  });

  it('should _clear the LCD', () => {

    lcd._clear();

    for(let i = 0; i < WIDTH * HEIGHT * 4; i++) {
      assert.equal(lcd.imageDataBG.data[i], 0);
    }

  });

  it('should transform a Nintendo tile buffer into a matrix', () => {
    const array = LCD.tileToMatrix(new Buffer('3c004200b900a500b900a50042003c00', 'hex'));
    assert.deepEqual(array, [0,0,2,2,2,2,0,0,
                             0,2,0,0,0,0,2,0,
                             2,0,2,2,2,0,0,2,
                             2,0,2,0,0,2,0,2,
                             2,0,2,2,2,0,0,2,
                             2,0,2,0,0,2,0,2,
                             0,2,0,0,0,0,2,0,
                             0,0,2,2,2,2,0,0]);
  });

  it('should transform a tile buffer into levels of gray matrix', () => {
    const array = LCD.tileToMatrix(new Buffer('3355ccaa3355ccaa3355ccaa3355ccaa', 'hex'));
    assert.deepEqual(array, [0,1,2,3,0,1,2,3,
                             3,2,1,0,3,2,1,0,
                             0,1,2,3,0,1,2,3,
                             3,2,1,0,3,2,1,0,
                             0,1,2,3,0,1,2,3,
                             3,2,1,0,3,2,1,0,
                             0,1,2,3,0,1,2,3,
                             3,2,1,0,3,2,1,0]);
  });

  it('should transform a tile buffer into a transparent matrix', () => {
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

  it('should transform a tile buffer into a black matrix', () => {
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

    const lastIndex = WIDTH*HEIGHT*4 - 1;
    const data = lcd.imageDataBG.data;

    lcd.setBgp([0, 1, 2, 3]);

    assert.deepEqual(lcd.bgp, [0, 1, 2, 3]);

    let pixel = {x: 0, y:0, level:0};
    lcd.drawPixel(pixel);

    assert.deepEqual([data[0], data[1], data[2], data[3]], lcd.SHADES[lcd.bgp[pixel.level]]);

    pixel = {x: 1, y:0, level: 1};
    lcd.drawPixel(pixel);

    assert.deepEqual([data[4], data[5], data[6], data[7]], lcd.SHADES[lcd.bgp[pixel.level]]);

    pixel = {x: WIDTH-1, y:0, level:2};
    lcd.drawPixel(pixel);

    assert.deepEqual([data[WIDTH*4-4], data[WIDTH*4-3], data[WIDTH*4-2], data[WIDTH*4-1]], lcd.SHADES[lcd.bgp[pixel.level]]);

    pixel = {x: WIDTH-1, y:HEIGHT-1, level:3};
    lcd.drawPixel(pixel);

    assert.deepEqual([data[lastIndex-3], data[lastIndex-2], data[lastIndex-1], data[lastIndex]], lcd.SHADES[lcd.bgp[pixel.level]]);
  });

  it('should not write tiles out of screen', () => {
    lcd.mmu.readBGData = function(any){
      return new Buffer('ffffffffffffffffffffffffffffffff', 'hex');
    };

    const bg = lcd.imageDataBG;

    // Max x is 19
    lcd.drawTile({tile_number: 0, grid_x: 20, grid_y: 0});

    assert.deepEqual(bg, lcd.imageDataBG, 'No change');

    // Max y is 17
    lcd.drawTile({tile_number: 0, grid_x: 0, grid_y: 18});

    assert.deepEqual(bg, lcd.imageDataBG, 'No change');
  });

  it('should write black tiles on screen', () => {

    lcd.mmu.readBGData = function(tile_number){
        return new Buffer('ffffffffffffffffffffffffffffffff', 'hex');
    };

    lcd.drawTile({tile_number: 1, grid_x: 0, grid_y: 0});
    lcd.drawTile({tile_number: 1, grid_x: 10, grid_y: 9});
    lcd.drawTile({tile_number: 1, grid_x: 19, grid_y: 17});

    assertDarkestTile.call(lcd, 0, 0, lcd.imageDataBG);
    assertDarkestTile.call(lcd, 10, 9, lcd.imageDataBG);
    assertDarkestTile.call(lcd, 19, 17, lcd.imageDataBG);
  });

  describe('OBJ (Sprites)', () => {
    it('should write OBJ on top of BG', () => {

      lcd.mmu.readBGData = function(tile_number) {
        return new Buffer('00000000000000000000000000000000', 'hex');
      };
      lcd.mmu.readOBJData = function() {
        return new Buffer('ffffffffffffffffffffffffffffffff', 'hex');
      };
      lcd.mmu.getOBJ = function(obj_number) {
        if (obj_number === 0) {
          return {y: 16, x: 8, chrCode: 0x01, attr: 0x00};
        } else if (obj_number === 1){
          return {y: 8, x: 0, chrCode: 0x01, attr: 0x00}; // hidden as x < 8 and y < 16
        } else {
          return {y: 0, x: 0, chrCode: 0x00, attr: 0x00}; // Empty OBJ, should not paint
        }
      };
      lcd.mmu.getCharCode = function(x, y){
        return 0x00;
      };
      lcd.mmu._VRAMRefreshed = true;

      lcd.drawTiles();

      for(let x = 0; x < lcd.H_TILES; x++){
        for(let y = 0; y < lcd.V_TILES; y++){
          if (x === 0 && y === 0){
            assertDarkestTile.call(lcd, x, y, lcd.imageDataOBJ);
          } else {
            assertLightestTile.call(lcd, x, y, lcd.imageDataBG);
          }
        }
      }
    });

    it('should flip matrix horizontally', () => {
      const matrix =  [3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0];
      const flipped = [0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3,0,0,0,0,3,3,3,3];

      assert.deepEqual(lcd.flipMatrixHorizontally(matrix), flipped);
    });

    it('should flip OBJ horizontally', () => {

      lcd.mmu.getOBJ = function(obj_number) {
        return {y: 16, x: 8, chrCode: 0x00, attr: 0b00100000};
      };

      lcd.mmu.readOBJData = function(tile_number) {
        // Left half is darkest, right half is lightest
        return new Buffer('f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0', 'hex');
      };

      lcd.drawTiles();

      for(let x = 0; x < 8; x++){
        for(let y = 0; y < 8; y++){
          if (x < 4){
            assert.deepEqual(lcd.getPixelData(x, y, lcd.imageDataOBJ), lcd.SHADES[0], 'Left half is lightest');
          } else {
            assert.deepEqual(lcd.getPixelData(x, y, lcd.imageDataOBJ), lcd.SHADES[3], 'Left half is darkest');
          }
        }
      }

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
