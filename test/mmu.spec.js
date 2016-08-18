import MMU from '../src/mmu';
import assert from 'assert';
import config from '../src/config';
import {describe, beforeEach, it} from 'mocha';

describe('MMU', () => {

  config.DEBUG = false;
  let mmu;

  beforeEach(function() {
    mmu = new MMU('./roms/bios.gb');
  });

  it('should write bytes in memory', () => {
    mmu.writeByteAt(0xc000, 0xab);
    assert.equal(mmu.byteAt(0xc000), 0xab, 'write 0xab in memory address 0xc000');
  });

  it('should not write in Interrupt Enable register', () => {
    const ie = mmu.byteAt(0xffff);
    mmu.writeByteAt(0xffff, 0xab);
    assert.equal(mmu.byteAt(0xffff), ie, 'should not write on 0xffff');
  });

  it('should not write bytes in ROM', () => {
    
    let addr = 0x0000;
    let value = mmu.byteAt(addr);
    mmu.writeByteAt(addr, 0xab);
    assert.equal(mmu.byteAt(addr), value, `should not write on ${addr}`);

    addr = 0x7fff;
    value = mmu.byteAt(addr);
    mmu.writeByteAt(addr, 0xab);
    assert.equal(mmu.byteAt(addr), value, `should not write on ${addr}`);

    addr = 0x8000;
    mmu.writeByteAt(addr, 0xab);
    assert.equal(mmu.byteAt(addr), 0xab, `can write on ${addr}`);
  
  });

  it('should start the memory map', () => {

    assert.equal(mmu.memory.length, 0x10000, 'Memory size is 0x10000');

    // Starting values at addresses
    assert.equal(mmu.byteAt(0xff05), 0x00);
    assert.equal(mmu.byteAt(0xff06), 0x00);
    assert.equal(mmu.byteAt(0xff07), 0x00);
    assert.equal(mmu.byteAt(0xff10), 0x80);
    assert.equal(mmu.byteAt(0xff11), 0xbf);
    assert.equal(mmu.byteAt(0xff12), 0xf3);
    assert.equal(mmu.byteAt(0xff14), 0xbf);
    assert.equal(mmu.byteAt(0xff16), 0x3f);
    assert.equal(mmu.byteAt(0xff17), 0x00);
    assert.equal(mmu.byteAt(0xff19), 0xbf);
    assert.equal(mmu.byteAt(0xff1a), 0x7f);
    assert.equal(mmu.byteAt(0xff1b), 0xff);
    assert.equal(mmu.byteAt(0xff1c), 0x9f);
    assert.equal(mmu.byteAt(0xff1e), 0xbf);
    assert.equal(mmu.byteAt(0xff20), 0xff);
    assert.equal(mmu.byteAt(0xff21), 0x00);
    assert.equal(mmu.byteAt(0xff22), 0x00);
    assert.equal(mmu.byteAt(0xff23), 0xbf);
    assert.equal(mmu.byteAt(0xff24), 0x77);
    assert.equal(mmu.byteAt(0xff25), 0xf3);
    assert.equal(mmu.byteAt(0xff26), 0xf1);
    assert.equal(mmu.byteAt(0xff40), 0x91);
    assert.equal(mmu.byteAt(0xff42), 0x00);
    assert.equal(mmu.byteAt(0xff43), 0x00);
    assert.equal(mmu.byteAt(0xff45), 0x00);
    assert.equal(mmu.byteAt(0xff47), 0xfc);
    assert.equal(mmu.byteAt(0xff48), 0xff);
    assert.equal(mmu.byteAt(0xff49), 0xff);
    assert.equal(mmu.byteAt(0xff4a), 0x00);
    assert.equal(mmu.byteAt(0xff4b), 0x00);
    assert.equal(mmu.byteAt(0xffff), 0x00);
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