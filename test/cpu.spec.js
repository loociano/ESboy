import Loader from '../src/Loader';
import CPU from '../src/CPU';
import assert from 'assert';

describe('CPU', function() {

  let loader = new Loader();
  loader.load('./roms/tetris.gb');
  let cpu = new CPU(loader);

  it('should fail without loader', () => {
    (function(){
      let cpu = new CPU();
    }).should.throw();
  });

  it('should read the game header', () => {
    assert.equal(cpu.getGameTitle(), 'TETRIS', 'should read title');
    assert.equal(cpu.isGameInColor(), false, 'should not be gb color');
    assert.equal(cpu.isGameSuperGB(), false, 'should not be super GB');
    assert.equal(cpu.getCartridgeType(), 'ROM ONLY');
    assert.equal(cpu.getRomSize(), '32KB');
    assert.equal(cpu.getRAMSize(), 'None');
    assert.equal(cpu.getDestinationCode(), 'Japanese');
  });

  it('should read the nintendo graphic buffer', () => {

    const buf = new Buffer(48);
    buf.writeUIntBE(0xCEED6666CC0D, 0, 6);
    buf.writeUIntBE(0x000B03730083, 6, 6);
    buf.writeUIntBE(0x000C000D0008, 12, 6);
    buf.writeUIntBE(0x111F8889000E, 18, 6);
    buf.writeUIntBE(0xDCCC6EE6DDDD, 24, 6);
    buf.writeUIntBE(0xD999BBBB6763, 30, 6);
    buf.writeUIntBE(0x6E0EECCCDDDC, 36, 6);
    buf.writeUIntBE(0x999FBBB9333E, 42, 6);

    assert(cpu.getNintendoGraphicBuffer().equals(buf), 'Nintendo Graphic Buffer must match.');
  });

});