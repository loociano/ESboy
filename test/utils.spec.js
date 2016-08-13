import assert from 'assert';
import Utils from '../src/Utils';

describe('Utils', () => {

  it('should print hex string', () => {

    assert.equal(Utils.hexStr(0), '0x0');
    assert.equal(Utils.hexStr(100), '0x64');

  });
});