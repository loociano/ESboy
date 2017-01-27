import CPU from '../src/cpu';
import MMU from '../src/mmu';
import LCD from '../src/lcd';
import Loader from '../src/loader';
import assert from 'assert';
import {describe, beforeEach, it} from 'mocha';
import ContextMock from './mock/contextMock';
import StorageMock from './mock/storageMock';
import config from '../src/config';

describe('BIOS execution', function() {

  config.DEBUG = false;
  config.TEST = true;

  const stopAt = 0x0100;

  const loader = new Loader('./roms/blargg/cpu_instrs/cpu_instrs.gb');
  const mmu = new MMU(loader.asUint8Array(), new StorageMock());
  const lcd = new LCD(mmu, new ContextMock(), new ContextMock(), new ContextMock());
  const cpu = new CPU(mmu, lcd);

  lcd.getBGTileLineData = function(grid_x, grid_y){
    const index = (grid_x*this.TILE_WIDTH + grid_y*this.TILE_WIDTH * this._HW_WIDTH) * 4;
    return this._imageDataBG.data.slice(index, index + this.TILE_WIDTH*4);
  };

  cpu.runUntil(stopAt);

  it('should start with pc, sp and registers at right values', () => {
    assert.equal(cpu.pc(), 0x0100, 'Program Counter after BIOS');
    assert.equal(cpu.a(), 0x01, 'Accumulator must start as 0x01 for GB');
    assert.equal(cpu.af(), 0x01b0, 'Register af must start as 0x01bc');
    assert.equal(cpu.f(), 0b1011, 'Flag register must start as 0b1011');
    assert.equal(cpu.bc(), 0x0013, 'Register bc must start as 0x0013');
    assert.equal(cpu.de(), 0x00d8, 'Register de must start as 0x00d8');
    assert.equal(cpu.hl(), 0x014d, 'Register hl must start as 0x014d');
    assert.equal(cpu.sp(), 0xfffe, 'Stack Pointer must start as 0xfffe');
  });

  it('BIOS should start sound', function() {
    assert.equal(cpu.nr52(), 0x80, 'NR52');
    assert.equal(cpu.nr51(), 0xf3, 'NR51');
    assert.equal(cpu.nr50(), 0x77, 'NR50');
    assert.equal(cpu.nr12(), 0xf3, 'NR52');
    assert.equal(cpu.nr11(), 0x80, 'NR11');
  });

  it('should copy the nintendo tiles in VRAM', function() {
    // Nintendo tile 1
    assert.deepEqual(cpu.mmu.readBGData(0x1, 0), [0xf0,0x00]);
    assert.deepEqual(cpu.mmu.readBGData(0x1, 1), [0xf0,0x00]);
    assert.deepEqual(cpu.mmu.readBGData(0x1, 2), [0xfc,0x00]);
    assert.deepEqual(cpu.mmu.readBGData(0x1, 3), [0xfc,0x00]);
    assert.deepEqual(cpu.mmu.readBGData(0x1, 4), [0xfc,0x00]);
    assert.deepEqual(cpu.mmu.readBGData(0x1, 5), [0xfc,0x00]);
    assert.deepEqual(cpu.mmu.readBGData(0x1, 6), [0xf3,0x00]);
    assert.deepEqual(cpu.mmu.readBGData(0x1, 7), [0xf3,0x00]);
    //...
    // Nintendo tile 24
    assert.deepEqual(cpu.mmu.readBGData(0x19, 0), [0x3c,0x00]);
    assert.deepEqual(cpu.mmu.readBGData(0x19, 1), [0x42,0x00]);
    assert.deepEqual(cpu.mmu.readBGData(0x19, 2), [0xb9,0x00]);
    assert.deepEqual(cpu.mmu.readBGData(0x19, 3), [0xa5,0x00]);
    assert.deepEqual(cpu.mmu.readBGData(0x19, 4), [0xb9,0x00]);
    assert.deepEqual(cpu.mmu.readBGData(0x19, 5), [0xa5,0x00]);
    assert.deepEqual(cpu.mmu.readBGData(0x19, 6), [0x42,0x00]);
    assert.deepEqual(cpu.mmu.readBGData(0x19, 7), [0x3c,0x00]);
  });

  it('should write the map to tiles', function() {
    assert.equal(cpu.mmu.getBgCharCode(0x04, 0x08), 0x01, 'Tile 1 at 0x04,0x08');
    assert.equal(cpu.mmu.getBgCharCode(0x10, 0x08), 0x19, 'Tile 19 at 0x10,0x08');
  });

  it('should init IO registers', function() {
    assert.equal(cpu.pc(), 0x100, 'PC at 0x100');
    assert.equal(cpu.lcdc(), 0x91, 'LCDC initialized');
    // TODO: implement LCDC interruptions to decrease it to 0x00 (scrolling down Nintendo logo)
    //assert.equal(cpu.scy(), 0x00, 'SCY initialized'); // BIOS setting it at 0x64!
    assert.equal(cpu.scx(), 0x00, 'SCX initialized');
    assert.equal(cpu.ly(), 0x00, 'LY initialized');
    assert.equal(cpu.lyc(), 0x00, 'LYC initialized');
    assert.equal(cpu.bgp(), 0xfc, 'BGP Background Palette is initialized');
    assert.equal(cpu.wy(), 0x00, 'WY initialized');
    assert.equal(cpu.wx(), 0x00, 'WX initialized');
    assert.equal(cpu.If(), 0b00010, 'IF initialized'); // TODO: bits 7,6,5 should be always set
    assert.equal(cpu.ie(), 0x00, 'IE initialized');
    assert.equal(cpu.ime(), 1, 'Interrupt Master Enabled');
  });

  it('should override BIOS with ROM in range 0x0000 - 0x00ff', function() {
    assert.notDeepEqual(cpu.mmu.readBuffer(0x0000, 0x0100), cpu.mmu.getBIOS(), 'When BIOS finishes, memory 0x00-0xff is overriden by ROM');
    
    // Reset ROM addresses: 00, 08, 10, ... 38
    assert.equal(cpu.mmu.readByteAt(0x00), 0x3c);
    assert.equal(cpu.mmu.readByteAt(0x08), 0x3c);
    assert.equal(cpu.mmu.readByteAt(0x10), 0x3c);
    assert.equal(cpu.mmu.readByteAt(0x18), 0x3c);
    assert.equal(cpu.mmu.readByteAt(0x20), 0x3c);
    assert.equal(cpu.mmu.readByteAt(0x28), 0x3c);
    assert.equal(cpu.mmu.readByteAt(0x30), 0x3c);
    assert.equal(cpu.mmu.readByteAt(0x38), 0x3c);
  });

  it('should end up with the right values on registers', () => {
    assert.equal(cpu.a(), 0x01, 'a');
    assert.equal(cpu.b(), 0x00, 'b');
    assert.equal(cpu.c(), 0x13, 'c');
    assert.equal(cpu.d(), 0x00, 'd');
    assert.equal(cpu.e(), 0xd8, 'e');
    assert.equal(cpu.h(), 0x01, 'h');
    assert.equal(cpu.l(), 0x4d, 'l');
    assert.equal(cpu.sp(), 0xfffe, 'a');
    assert.equal(cpu.f(), 0b1011, 'flags');
  });

  it('should paint the Nintendo logo on screen', () => {
    const tile1Line0Data = [
      ...lcd.SHADES[lcd._bgp[3]],
      ...lcd.SHADES[lcd._bgp[3]],
      ...lcd.SHADES[lcd._bgp[3]],
      ...lcd.SHADES[lcd._bgp[3]],
      ...lcd.SHADES[lcd._bgp[0]],
      ...lcd.SHADES[lcd._bgp[0]],
      ...lcd.SHADES[lcd._bgp[0]],
      ...lcd.SHADES[lcd._bgp[0]]];

    assert.equal(cpu.mmu.getBgCharCode(4, 8), 0x01, 'Tile 1 at 0x04,0x08');
    assert.deepEqual(Array.from(lcd.getBGTileLineData(4, 8)), tile1Line0Data);
  });

});