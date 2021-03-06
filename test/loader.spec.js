import assert from 'assert';
import Loader from '../src/loader';

describe('Loader', () => {
  it('should read Uint8Array from file', () => {

    const u8array = Uint8Array.from([0x3c,0xc9,0x00,0x00,0x00,0x00,0xff,0xff]);
    const loader = new Loader('./test/files/dummy.gb');

    assert.deepEqual(loader.asUint8Array(), u8array);
  });
});