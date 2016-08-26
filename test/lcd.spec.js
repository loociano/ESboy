import assert from 'assert';
import LCD from '../src/lcd';
import {describe, beforeEach, it} from 'mocha';

describe('LCD', () => {

  it('should transform tile buffer into pixel values', () => {

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

});