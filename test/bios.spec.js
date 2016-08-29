import CPU from '../src/cpu';
import assert from 'assert';
import config from '../src/config';
import {describe, beforeEach, it} from 'mocha';
import Utils from '../src/utils';
import ContextMock from './mock/contextMock';

let cpu;

describe('Start BIOS', () => {

  before(() => {
    cpu = new CPU('./roms/blargg_cpu_instrs.gb', new ContextMock());
  });

  it('should start with pc, sp and registers at right values', () => {
    assert.equal(cpu.pc(), 0x0000, 'Program Counter should start at 0x0000 in BIOS');
    assert.equal(cpu.a(), 0x01, 'Accumulator must start as 0x01 for GB');
    assert.equal(cpu.af(), 0x01b0, 'Register af must start as 0x01bc');
    assert.equal(cpu.f(), 0b1011, 'Flag register must start as 0b1011');
    assert.equal(cpu.bc(), 0x0013, 'Register bc must start as 0x0013');
    assert.equal(cpu.de(), 0x00d8, 'Register de must start as 0x00d8');
    assert.equal(cpu.hl(), 0x014d, 'Register hl must start as 0x014d');
    assert.equal(cpu.sp(), 0xfffe, 'Stack Pointer must start as 0xfffe');
  });

  it('BIOS should reset VRAM', () => {
    cpu.startUntil(0x0028);
    assert.equal(cpu.mmu.readByteAt(0x9fff), 0x00, 'Top VRAM empty');
    assert.equal(cpu.mmu.readByteAt(0x8000), 0x00, 'Bottom VRAM empty');
  });
});

describe('End BIOS', () => {

  before(() => {
    cpu = new CPU('./roms/blargg_cpu_instrs.gb', new ContextMock());
    cpu.startUntil(0x0100);
  });

  it('BIOS should start sound', () => {
    assert.equal(cpu.nr52(), 0x80, 'NR52');
    assert.equal(cpu.nr51(), 0xf3, 'NR51');
    assert.equal(cpu.nr50(), 0x77, 'NR50');
    assert.equal(cpu.nr12(), 0xf3, 'NR52');
    assert.equal(cpu.nr11(), 0x80, 'NR11');
  });

  it('should copy the nintendo tiles in VRAM', () => {
    assert(cpu.mmu.readTile(0x1).equals(B('f000f000fc00fc00fc00fc00f300f300')), 'Nintendo tile 1');
    assert(cpu.mmu.readTile(0x2).equals(B('3c003c003c003c003c003c003c003c00')), 'Nintendo tile 2');
    assert(cpu.mmu.readTile(0x3).equals(B('f000f000f000f00000000000f300f300')), 'Nintendo tile 3');
    //...
    assert(cpu.mmu.readTile(0x19).equals(B('3c004200b900a500b900a50042003c00')), 'Nintendo tile 24');
  });

  it('should write the map to tiles', () => {
    assert.equal(cpu.mmu.getTileNbAtCoord(0x04, 0x08), 0x01, 'Tile 1 at 0x04,0x08');
    assert.equal(cpu.mmu.getTileNbAtCoord(0x10, 0x08), 0x19, 'Tile 19 at 0x10,0x08');
  });

  it('should init IO registers', () => {
    assert.equal(cpu.pc(), 0x100);
    assert.equal(cpu.lcdc(), 0x91, 'LCDC initialized');
    //assert.equal(cpu.scy(), 0x00, 'SCY initialized'); // BIOS setting it at 0x64!
    assert.equal(cpu.scx(), 0x00, 'SCX initialized');
    assert.equal(cpu.lyc(), 0x00, 'LYC initialized');
    assert.equal(cpu.bgp(), 0xfc, 'BGP Background Palette is initialized');
    assert.equal(cpu.wy(), 0x00, 'WY initialized');
    assert.equal(cpu.wx(), 0x00, 'WX initialized');
    assert.equal(cpu.ie(), 0x00, 'IE initialized');
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