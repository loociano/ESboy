import CPU from '../src/cpu';
import assert from 'assert';
import config from '../src/config';
import LCDMock from './mock/lcdMock';
import MMUMock from './mock/mmuMock';
import {describe, beforeEach, it} from 'mocha';
import Utils from '../src/utils';

describe('Dividers', () => {

  config.DEBUG = false;
  config.TEST = true;
  let cpu, mmu;

  beforeEach( () => {
    mmu = new MMUMock();
    mmu.lcdc = () => 0; // OFF
    cpu = new CPU(mmu, new LCDMock());
    cpu.setIe(0x1); // enable vblank interruption
    cpu.execute = () => { cpu._m++ };
  });

  it('should increase first bit of divider', () => {

    mmu.setHWDivider = function(n){
      this._div = (this._div + n) % 0xffff;
      this._memory[this.ADDR_DIV] = Utils.msb(this._div);
      if (this._div >= (1 << 8)){
        this._memory[mmu.ADDR_IF] = 1; // request vblank interrupt
      }
    };

    cpu.frame();

    assert.equal(cpu.mmu.readByteAt(cpu.mmu.ADDR_DIV), 0x01);
  });

  it('should increase last bit of divider', () => {

    mmu.setHWDivider = function(n){
      this._div = (this._div + n) % 0xffff;
      this._memory[this.ADDR_DIV] = Utils.msb(this._div);
      if (this._div >= (1 << 15)){
        this._memory[this.ADDR_IF] = 1; // request vblank interrupt
      }
    };

    cpu.frame();

    assert.equal(cpu.mmu.readByteAt(cpu.mmu.ADDR_DIV), 0x80);
  });
});