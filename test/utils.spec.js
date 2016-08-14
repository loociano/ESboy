import assert from 'assert';
import Utils from '../src/Utils';

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
});