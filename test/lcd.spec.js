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
    lcd = new LCD(new MMUMock(), new ContextMock(), WIDTH, HEIGHT);
  });

  it('should _clear the LCD', () => {

    lcd._clear();

    for(let i = 0; i < WIDTH * HEIGHT * 4; i++) {
      assert.equal(lcd.imageData.data[i], 0);
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
    const data = lcd.imageData.data;

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

    lcd = new LCD(mmuMock, new ContextMock(), WIDTH, HEIGHT);

    lcd.drawTile({tile_number: 1, grid_x: 0, grid_y: 0});
    lcd.drawTile({tile_number: 1, grid_x: 10, grid_y: 9});
    lcd.drawTile({tile_number: 1, grid_x: 19, grid_y: 17});

    lcd.assertBlackTile = assertBlackTile;

    lcd.assertBlackTile(0, 0);
    lcd.assertBlackTile(10, 9);
    lcd.assertBlackTile(19, 17);
  });

});

function assertBlackTile(grid_x, grid_y){

  for(let x = grid_x*8; x < (grid_x+1)*8; x++){
    for(let y = grid_y*8; y < (grid_y+1)*8; y++){
       assert.deepEqual(this.getPixelData(x, y), [0, 0, 0, 255], 'pixel is black');
    } 
  }
}