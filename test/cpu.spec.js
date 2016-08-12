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

    const buf = new Buffer('CEED6666CC0D000B03730083000C000D0008' +
      '111F8889000EDCCC6EE6DDDDD999BBBB67636E0EECCCDDDC999FBBB9333E', 'hex');
    assert(cpu.getNintendoGraphicBuffer().equals(buf), 'Nintendo Graphic Buffer must match.');
  });

  it('should compute the checksum', () => {
    assert(cpu.isChecksumCorrect());
  });

  it('should start with PC, SP and registers at right values', () => {

    assert.equal(cpu.PC, 0x100, 'Program Counter should start at 0x100');
    assert.equal(cpu.A, 0x01, 'Accumulator must start as 0x01 for GB');
    assert.equal(cpu.AF(), 0x01, 'Register AF must start as 0x0001');
    assert.equal(cpu.F, 0xb0, 'Flag register must start as 0xb0');
    assert.equal(cpu.BC(), 0x0013, 'Register BC must start as 0x0013');
    assert.equal(cpu.DE(), 0x00d8, 'Register DE must start as 0x00d8');
    assert.equal(cpu.HL(), 0x014d, 'Register HL must start as 0x014d');
    assert.equal(cpu.SP, 0xfffe, 'Stack Pointer must start as 0xfffe');
  });

  it('should start the memory map', () => {

    assert.equal(cpu.memory.length, 0x10000, 'Memory size is 0x10000');

    // Starting values at addresses
    assert.equal(cpu.byteAt(0xff05), 0x00);
    assert.equal(cpu.byteAt(0xff06), 0x00);
    assert.equal(cpu.byteAt(0xff07), 0x00);
    assert.equal(cpu.byteAt(0xff10), 0x80);
    assert.equal(cpu.byteAt(0xff11), 0xbf);
    assert.equal(cpu.byteAt(0xff12), 0xf3);
    assert.equal(cpu.byteAt(0xff14), 0xbf);
    assert.equal(cpu.byteAt(0xff16), 0x3f);
    assert.equal(cpu.byteAt(0xff17), 0x00);
    assert.equal(cpu.byteAt(0xff19), 0xbf);
    assert.equal(cpu.byteAt(0xff1a), 0x7f);
    assert.equal(cpu.byteAt(0xff1b), 0xff);
    assert.equal(cpu.byteAt(0xff1c), 0x9f);
    assert.equal(cpu.byteAt(0xff1e), 0xbf);
    assert.equal(cpu.byteAt(0xff20), 0xff);
    assert.equal(cpu.byteAt(0xff21), 0x00);
    assert.equal(cpu.byteAt(0xff22), 0x00);
    assert.equal(cpu.byteAt(0xff23), 0xbf);
    assert.equal(cpu.byteAt(0xff24), 0x77);
    assert.equal(cpu.byteAt(0xff25), 0xf3);
    assert.equal(cpu.byteAt(0xff26), 0xf1);
    assert.equal(cpu.byteAt(0xff40), 0x91);
    assert.equal(cpu.byteAt(0xff42), 0x00);
    assert.equal(cpu.byteAt(0xff43), 0x00);
    assert.equal(cpu.byteAt(0xff45), 0x00);
    assert.equal(cpu.byteAt(0xff47), 0xfc);
    assert.equal(cpu.byteAt(0xff48), 0xff);
    assert.equal(cpu.byteAt(0xff49), 0xff);
    assert.equal(cpu.byteAt(0xff4a), 0x00);
    assert.equal(cpu.byteAt(0xff4b), 0x00);
    assert.equal(cpu.byteAt(0xffff), 0x00);
  });

  it('should execute instructions', () => {

    assert.equal(cpu.nextCommand(), 0x00, 'Tetris starts with NOP (0x00)');
    cpu.execute();
    assert.equal(cpu.nextCommand(), 0xc3, 'c3 5001; JP 0x0150');
    cpu.execute();
    assert.equal(cpu.PC, 0x150);
  });

});