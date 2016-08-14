import CPU from '../src/CPU';
import assert from 'assert';
import config from '../src/config';
import {describe, beforeEach, it} from 'mocha';

describe('CPU', function() {

  config.TEST = true;
  let cpu;

  beforeEach(function() {
    cpu = new CPU('./roms/tetris.gb');
  });

  it('should handle missing ROM filename', () => {

    assert.throws(() => {
      let cpu = new CPU();
    }, Error);

  });

  it('should handle missing ROM file', () => {

    assert.throws(() => {
      let cpu = new CPU('./roms/nope.gb');
    }, Error);

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

  it('should start with pc, sp and registers at right values', () => {

    assert.equal(cpu.pc(), 0x100, 'Program Counter should start at 0x100');
    assert.equal(cpu.a(), 0x01, 'Accumulator must start as 0x01 for GB');
    assert.equal(cpu.af(), 0x01, 'Register af must start as 0x0001');
    assert.equal(cpu.f(), 0b1011, 'Flag register must start as 0b1011');
    assert.equal(cpu.bc(), 0x0013, 'Register bc must start as 0x0013');
    assert.equal(cpu.de(), 0x00d8, 'Register de must start as 0x00d8');
    assert.equal(cpu.hl(), 0x014d, 'Register hl must start as 0x014d');
    assert.equal(cpu.sp(), 0xfffe, 'Stack Pointer must start as 0xfffe');
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
    assert.equal(cpu.pc(), 0x150);
    assert.equal(cpu.nextCommand(), 0xc3, 'c3 8b02; JP 0x028b');
    cpu.execute();
    assert.equal(cpu.pc(), 0x028b);
    assert.equal(cpu.nextCommand(), 0xaf, 'af; XOR a');

  });

  it('should jump to address', () => {
    cpu.jp(0x123);
    assert.equal(cpu.pc(), 0x123);
  });

  it('should XOR register a', () => {
    cpu.xor_a();
    assert.equal(cpu.a(), 0x00);
    assert.equal(cpu.f(), 0b1000, 'Z=1, N=0, h=0, c=0');
  });

  it('should XOR register a with n', () => {
    const a = cpu.a();
    cpu.xor_n(a);
    assert.equal(cpu.a(), 0x00, 'register a should be zero.');
    assert.equal(cpu.f(), 0b1000, 'Z=1, N=0, h=0, c=0');
  });

  it('should set Flag Z', () => {
    testSetGetFlag(cpu, cpu.setZ, cpu.getZ);
  });

  it('should set Flag N', () => {
    testSetGetFlag(cpu, cpu.setN, cpu.getN);
  });

  it('should set Flag h', () => {
    testSetGetFlag(cpu, cpu.setH, cpu.getH);
  });

  it('should set Flag c', () => {
    testSetGetFlag(cpu, cpu.setC, cpu.getC);
  });

  it('should load 16 bits into register', () => {

    cpu.ld_bc_nn(0xabcd);
    assert.equal(cpu.bc(), 0xabcd, 'load 0xabcd into bc');

    cpu.ld_de_nn(0xabcd);
    assert.equal(cpu.de(), 0xabcd, 'load 0xabcd into de');

    cpu.ld_hl_nn(0xabcd);
    assert.equal(cpu.hl(), 0xabcd, 'load 0xabcd into hl');

    cpu.ld_sp_nn(0xabcd);
    assert.equal(cpu.sp(), 0xabcd, 'load 0xabcd into sp');

  });

  it('should load 8 bits into registers', () => {
    cpu.ld_b_n(0xab);
    assert.equal(cpu.b(), 0xab, 'load 0xab into b');

    cpu.ld_c_n(0xab);
    assert.equal(cpu.c(), 0xab, 'load 0xab into c');

    cpu.ld_d_n(0xab);
    assert.equal(cpu.d(), 0xab, 'load 0xab into d');

    cpu.ld_e_n(0xab);
    assert.equal(cpu.e(), 0xab, 'load 0xab into e');

    cpu.ld_h_n(0xab);
    assert.equal(cpu.h(), 0xab, 'load 0xab into h');

    cpu.ld_l_n(0xab);
    assert.equal(cpu.l(), 0xab, 'load 0xab into l');
  });

});

function testSetGetFlag(cpu, setFn, getFn){
  setFn.call(cpu, 1);
  assert.equal(getFn.call(cpu), 1, 'Flag=1');
  setFn.call(cpu, 0);
  assert.equal(getFn.call(cpu), 0, 'Flag=0');
}