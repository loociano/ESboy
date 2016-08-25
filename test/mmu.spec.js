import MMU from '../src/mmu';
import assert from 'assert';
import config from '../src/config';
import {describe, beforeEach, it} from 'mocha';

describe('MMU', () => {

  config.DEBUG = false;
  config.TEST = true;

  let mmu;

  beforeEach(function() {
    mmu = new MMU('./roms/blargg_cpu_instrs.gb');
  });

  it('should write bytes in memory', () => {
    mmu.writeByteAt(0xc000, 0xab);
    assert.equal(mmu.readByteAt(0xc000), 0xab, 'write 0xab in memory address 0xc000');
  });

  it('should not write in Interrupt Enable register', () => {
    const ie = mmu.readByteAt(0xffff);

    assert.throws( () => {
      mmu.writeByteAt(0xffff, 0xab);
    }, Error, 'should not write on 0xffff');

    assert.equal(mmu.readByteAt(0xffff), ie, 'should not write on 0xffff');
  });

  it('should not write bytes in ROM', () => {
    
    let addr = 0x0000;
    let value = mmu.readByteAt(addr);

    assert.throws( () => {
      mmu.writeByteAt(addr, 0xab);
    }, Error, `should not write on ${addr}`);

    addr = 0x7fff;

    assert.throws( () => {
      mmu.writeByteAt(addr, 0xab);
    }, Error, `should not write on ${addr}`);

    addr = 0x8000;

    mmu.writeByteAt(addr, 0xab);

    assert.equal(mmu.readByteAt(addr), 0xab, `can write on ${addr}`);
  });

  it('should start the memory map', () => {

    assert.equal(mmu.memory.length, 0x10000, 'Memory size is 0x10000');

    // Starting values at addresses
    assert.equal(mmu.readByteAt(0xff05), 0x00);
    assert.equal(mmu.readByteAt(0xff06), 0x00);
    assert.equal(mmu.readByteAt(0xff07), 0x00);
    assert.equal(mmu.readByteAt(0xff10), 0x80);
    assert.equal(mmu.readByteAt(0xff14), 0xbf);
    assert.equal(mmu.readByteAt(0xff16), 0x3f);
    assert.equal(mmu.readByteAt(0xff17), 0x00);
    assert.equal(mmu.readByteAt(0xff19), 0xbf);
    assert.equal(mmu.readByteAt(0xff1a), 0x7f);
    assert.equal(mmu.readByteAt(0xff1b), 0xff);
    assert.equal(mmu.readByteAt(0xff1c), 0x9f);
    assert.equal(mmu.readByteAt(0xff1e), 0xbf);
    assert.equal(mmu.readByteAt(0xff20), 0xff);
    assert.equal(mmu.readByteAt(0xff21), 0x00);
    assert.equal(mmu.readByteAt(0xff22), 0x00);
    assert.equal(mmu.readByteAt(0xff23), 0xbf);
  });

  it('should load the BIOS in memory', () => {
    const bios = new Buffer('31feffaf21ff9f32cb7c20fb2126ff0e113e8032e20c3ef3e2323e77773efce0471104012110801acd9500cd9600137bfe3420f311d80006081a1322230520f93e19ea1099212f990e0c3d2808320d20f92e0f18f3673e6457e0423e91e040041e020e0cf044fe9020fa0d20f71d20f20e13247c1e83fe6228061ec1fe6420067be20c3e87e2f04290e0421520d205204f162018cb4f0604c5cb1117c1cb11170520f522232223c9ceed6666cc0d000b03730083000c000d0008111f8889000edccc6ee6ddddd999bbbb67636e0eecccdddc999fbbb9333e3c42b9a5b9a5423c21040111a8001a13be20fe237dfe3420f506197886230520fb8620fe3e01e050', 'hex');
    assert(mmu.readBuffer(0x0000, 0x0100).equals(bios), 'BIOS is in memory');
  });

  describe.skip('ROM checks', () => {

    it('should read the game header', () => {
      assert.equal(mmu.getGameTitle(), 'TETRIS', 'should read title');
      assert.equal(mmu.isGameInColor(), false, 'should not be gb color');
      assert.equal(mmu.isGameSuperGB(), false, 'should not be super GB');
      assert.equal(mmu.getCartridgeType(), 'ROM ONLY');
      assert.equal(mmu.getRomSize(), '32KB');
      assert.equal(mmu.getRAMSize(), 'None');
      assert.equal(mmu.getDestinationCode(), 'Japanese');
    });

    it('should read the nintendo graphic buffer', () => {

      const buf = new Buffer('CEED6666CC0D000B03730083000C000D0008' +
        '111F8889000EDCCC6EE6DDDDD999BBBB67636E0EECCCDDDC999FBBB9333E', 'hex');
      assert(mmu.getNintendoGraphicBuffer().equals(buf), 'Nintendo Graphic Buffer must match.');
    });

    it('should compute the checksum', () => {
      assert(mmu.isChecksumCorrect());
    });

  });

});