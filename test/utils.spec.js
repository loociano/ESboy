import assert from 'assert';
import Utils from '../src/utils';
import {describe, beforeEach, it} from 'mocha';

describe('Utils', () => {

  it('should print hex string', () => {

    assert.equal(Utils.hexStr(0), '0x0');
    assert.equal(Utils.hexStr(100), '0x64');
    assert.equal(Utils.hexStr(), '');

  });

  it('should print 4 hex values', () => {
    assert.equal(Utils.hex4(), '0x0000');
    assert.equal(Utils.hex4(0), '0x0000');
    assert.equal(Utils.hex4(100), '0x0064');
    assert.equal(Utils.hex4(4096), '0x1000');
  });

  it('should return signed integers', () => {
    assert.equal(Utils.uint8ToInt8(0x7f), 127, 'Positive number');
    assert.equal(Utils.uint8ToInt8(0xfc), -4, 'Negative number');
    assert.equal(Utils.uint8ToInt8(0x00), 0, 'Zero');
    assert.equal(Utils.uint8ToInt8(0x80), -128, 'Negative number');
  });

  it('should pad 0 up to 1 byte', () => {
    assert.equal(Utils.hex2(), '0x00');
    assert.equal(Utils.hex2(0), '0x00');
    assert.equal(Utils.hex2(15), '0x0f');
    assert.equal(Utils.hex2(16), '0x10');
  });

  it('should return the lsb and msb', () => {

    assert.equal(Utils.lsb(0xabcd), 0xcd);
    assert.equal(Utils.msb(0xabcd), 0xab);

  });

  it('should convert to 8 bit binary string', () => {

    assert.equal(Utils.toBin8(0), '00000000');
    assert.equal(Utils.toBin8(255), '11111111');
    assert.equal(Utils.toBin8(0x2f), '00101111');

    assert.throws(() => {
      Utils.toBin8(256);
    }, Error, 'Number cannot be represented with 8 bits');

  });

});