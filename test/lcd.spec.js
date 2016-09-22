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

    lcd.drawPixel(0, 0, 0);
    lcd.drawPixel(1, 0, 1);
    lcd.drawPixel(WIDTH-1, 0, 2);
    lcd.drawPixel(WIDTH-1, HEIGHT-1, 3);

    const black = 0, grey66 = 85, grey33 = 170, white = 255;
    const transparent = 0, opaque = 255;

    assert.deepEqual([data[0], data[1], data[2], data[3]], [white, white, white, transparent]);
    assert.deepEqual([data[4], data[5], data[6], data[7]], [grey33, grey33, grey33, opaque]);
    assert.deepEqual([data[WIDTH*4-4], data[WIDTH*4-3], data[WIDTH*4-2], data[WIDTH*4-1]], [grey66, grey66, grey66, opaque]);
    assert.deepEqual([data[lastIndex-3], data[lastIndex-2], data[lastIndex-1], data[lastIndex]], [black, black, black, opaque]);
  });

  it('should write black tiles on screen', () => {

    const mmuMock = {
        readTile: function(tile_number){
            return new Buffer('ffffffffffffffffffffffffffffffff', 'hex');
        }
    };

    lcd = new LCD(mmuMock, new ContextMock(), new ContextMock(), WIDTH, HEIGHT);

    lcd.drawTile({tile_number: 1, grid_x: 0, grid_y: 0});
    lcd.drawTile({tile_number: 1, grid_x: 10, grid_y: 9});
    lcd.drawTile({tile_number: 1, grid_x: 19, grid_y: 17});

    assertBlackTile.call(lcd, 0, 0, lcd.imageDataBG);
    assertBlackTile.call(lcd, 10, 9, lcd.imageDataBG);
    assertBlackTile.call(lcd, 19, 17, lcd.imageDataBG);
  });

  it('should write OBJ on top of BG', () => {

    const mmuMock = {
      readTile: function(tile_number){
        if (tile_number === 0x01 || tile_number === 0x02) {
          return new Buffer('ffffffffffffffffffffffffffffffff', 'hex');
        } else {
          return new Buffer('00000000000000000000000000000000', 'hex');
        }
      },
      areOBJOn: function() {
        return true;
      },
      getOBJ: function(obj_number) {
        if (obj_number === 0) {
          return {y: 16, x: 8, chrCode: 0x01, attr: 0x00};
        } else if (obj_number === 1){
          return {y: 8, x: 0, chrCode: 0x01, attr: 0x00}; // hidden as x < 8 and y < 16
        } else {
          return {y: 0, x: 0, chrCode: 0x00, attr: 0x00}; // Empty OBJ, should not paint
        }
      },
      getCharCode: function(x, y){
        return 0x00;
      },
      MAX_OBJ: 40,
      _VRAMRefreshed: true
    };

    lcd = new LCD(mmuMock, new ContextMock(), new ContextMock(), WIDTH, HEIGHT);

    lcd.drawTiles();

    for(let x = 0; x < lcd.H_TILES; x++){
      for(let y = 0; y < lcd.V_TILES; y++){
        if (x === 0 && y === 0){
          assertBlackTile.call(lcd, x, y, lcd.imageDataOBJ);
        } else {
          assertWhiteTile.call(lcd, x, y, lcd.imageDataBG);
        }
      }
    }
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

function assertBlackTile(grid_x, grid_y, imageData){
  assertTile.call(this, grid_x, grid_y, [0, 0, 0, 255], imageData);
}

function assertWhiteTile(grid_x, grid_y, imageData){
  assertTile.call(this, grid_x, grid_y, [255, 255, 255, 0], imageData);
}
