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

    const buf = new Buffer('CEED6666CC0D000B03730083000C000D0008111F8889000EDCCC6EE6DDDDD999BBBB67636E0EECCCDDDC999FBBB9333E', 'hex');
    assert(cpu.getNintendoGraphicBuffer().equals(buf), 'Nintendo Graphic Buffer must match.');
  });

  it('should compute the checksum', () => {
    assert(cpu.isChecksumCorrect());
  });

  it('should read first instruction', () => {

    assert.equal(cpu.PC, '0x100', 'PC should start at 0x100');
    assert.equal(cpu.nextCommand(), 'NOP', 'Tetris starts with NOP.');

  });

});