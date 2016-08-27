import assert from 'assert';
import LCD from '../src/lcd';
import ContextMock from '../src/contextMock';
import {describe, beforeEach, it} from 'mocha';

describe('LCD', () => {

  let lcd;
  const WIDTH = 160;
  const HEIGHT = 144;

  beforeEach(function() {
    lcd = new LCD(new Object(), new ContextMock(), WIDTH, HEIGHT);
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

    lcd.drawPixel(0, 0, 1);
    lcd.drawPixel(WIDTH-1, 0, 2);
    lcd.drawPixel(WIDTH-1, HEIGHT-1, 3);

    assert.deepEqual([data[0], data[1], data[2], data[3]], [85, 85, 85, 255]);
    assert.deepEqual([data[WIDTH*4-4], data[WIDTH*4-3], data[WIDTH*4-2], data[WIDTH*4-1]], [170, 170, 170, 255]);
    assert.deepEqual([data[lastIndex-3], data[lastIndex-2], data[lastIndex-1], data[lastIndex]], [255, 255, 255, 255]);
  });

});