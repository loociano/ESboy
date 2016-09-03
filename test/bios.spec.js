import CPU from '../src/cpu';
import MMU from '../src/mmu';
import assert from 'assert';
import {describe, beforeEach, it} from 'mocha';
import ipcMock from './mock/ipcMock';
import sinon from 'sinon';

describe.skip('BIOS', () => {

  beforeEach(function() {
    this.clock = sinon.useFakeTimers();
    this.cpu = new CPU(new MMU('./roms/blargg_cpu_instrs.gb'), new ipcMock());
    this.cpu.startUntil(0x0100);
  });

  afterEach(function() {
    this.clock = sinon.restore();
  });

  it('BIOS should start sound', function() {
    assert.equal(this.cpu.nr52(), 0x80, 'NR52');
    assert.equal(this.cpu.nr51(), 0xf3, 'NR51');
    assert.equal(this.cpu.nr50(), 0x77, 'NR50');
    assert.equal(this.cpu.nr12(), 0xf3, 'NR52');
    assert.equal(this.cpu.nr11(), 0x80, 'NR11');
  });

  it('should copy the nintendo tiles in VRAM', function() {
    assert(this.cpu.mmu.readTile(0x1).equals(B('f000f000fc00fc00fc00fc00f300f300')), 'Nintendo tile 1');
    assert(this.cpu.mmu.readTile(0x2).equals(B('3c003c003c003c003c003c003c003c00')), 'Nintendo tile 2');
    assert(this.cpu.mmu.readTile(0x3).equals(B('f000f000f000f00000000000f300f300')), 'Nintendo tile 3');
    //...
    assert(this.cpu.mmu.readTile(0x19).equals(B('3c004200b900a500b900a50042003c00')), 'Nintendo tile 24');
  });

  it('should write the map to tiles', function() {
    assert.equal(this.cpu.mmu.getTileNbAtCoord(0x04, 0x08), 0x01, 'Tile 1 at 0x04,0x08');
    assert.equal(this.cpu.mmu.getTileNbAtCoord(0x10, 0x08), 0x19, 'Tile 19 at 0x10,0x08');
  });

  it('should init IO registers', function() {
    assert.equal(this.cpu.pc(), 0x100, 'PC at 0x100');
    assert.equal(this.cpu.lcdc(), 0x91, 'LCDC initialized');
    //assert.equal(this.cpu.scy(), 0x00, 'SCY initialized'); // BIOS setting it at 0x64!
    assert.equal(this.cpu.scx(), 0x00, 'SCX initialized');
    assert.equal(this.cpu.lyc(), 0x00, 'LYC initialized');
    assert.equal(this.cpu.bgp(), 0xfc, 'BGP Background Palette is initialized');
    assert.equal(this.cpu.wy(), 0x00, 'WY initialized');
    assert.equal(this.cpu.wx(), 0x00, 'WX initialized');
    assert.equal(this.cpu.ie(), 0x00, 'IE initialized');
  });

  it('should override BIOS with ROM in range 0x0000 - 0x00ff', function() {
    assert(!this.cpu.mmu.readBuffer(0x0000, 0x0100).equals(this.cpu.mmu.getBIOS()), 'When BIOS finishes, memory 0x00-0xff is overriden by ROM');
    
    // Reset ROM addresses: 00, 08, 10, ... 38
    assert.equal(this.cpu.mmu.readByteAt(0x00), 0x3c);
    assert.equal(this.cpu.mmu.readByteAt(0x08), 0x3c);
    assert.equal(this.cpu.mmu.readByteAt(0x10), 0x3c);
    assert.equal(this.cpu.mmu.readByteAt(0x18), 0x3c);
    assert.equal(this.cpu.mmu.readByteAt(0x20), 0x3c);
    assert.equal(this.cpu.mmu.readByteAt(0x28), 0x3c);
    assert.equal(this.cpu.mmu.readByteAt(0x30), 0x3c);
    assert.equal(this.cpu.mmu.readByteAt(0x38), 0x3c);
  });

});

/**
 * Returns a new Buffer given a hexadecimal string
 * @param hex_string
 * @returns {*|Buffer}
 * @constructor
 */
function B(hex_string){
  return new Buffer(hex_string, 'hex');
}