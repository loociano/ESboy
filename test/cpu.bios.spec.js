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

  const loader = new Loader('./roms/blargg/cpu_instrs/cpu_instrs.gb'); // ROM has to have Nintendo logo
  const mmu = new MMU(loader.asUint8Array(), new StorageMock());
  const lcd = new LCD(mmu, new ContextMock());
  const cpu = new CPU(mmu, lcd);
//  mmu.writeByteAt(mmu.ADDR_LCDC, 0b10000000); // LCD on

  lcd.getBGTileLineData = function(grid_x, grid_y){
    const index = (grid_x*this.TILE_WIDTH + grid_y*this.TILE_WIDTH * this._HW_WIDTH) * 4;
    return this._imageData.data.slice(index, index + this.TILE_WIDTH*4);
  };

  cpu.runUntil(stopAt);

  it('should start with pc, sp and registers at right values', () => {
    assert.equal(cpu.pc(), 0x0100, 'Program Counter after BIOS');
    assert.equal(cpu.a(), 0x11, 'Accumulator must start as 0x11 for GBC');
    assert.equal(cpu.af(), 0x11b0, 'Register af must start as 0x01bc');
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

  it('should init IO registers', function() {
    assert.equal(cpu.pc(), 0x100, 'PC at 0x100');
    assert.equal(cpu.lcdc(), 0x91, 'LCDC initialized');
    assert.equal(cpu.scy(), 0x00, 'SCY initialized');
    assert.equal(cpu.scx(), 0x00, 'SCX initialized');
    assert.equal(cpu.ly(), 0x00, 'LY initialized');
    assert.equal(cpu.lyc(), 0x00, 'LYC initialized');
    assert.equal(cpu.bgp(), 0xfc, 'BGP Background Palette is initialized');
    assert.equal(cpu.wy(), 0x00, 'WY initialized');
    assert.equal(cpu.wx(), 0x00, 'WX initialized');
    assert.equal(cpu.If(), 0x00, 'IF initialized'); // TODO: bits 7,6,5 should be always set
    assert.equal(cpu.ie(), 0x00, 'IE initialized');
    assert.equal(cpu.ime(), 1, 'Interrupt Master Enabled');
  });
});