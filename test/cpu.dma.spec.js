import CPU from '../src/cpu';
import assert from 'assert';
import config from '../src/config';
import MMUMock from './mock/mmuMock';
import LCDMock from './mock/lcdMock';
import {describe, beforeEach, it} from 'mocha';

describe('DMA', () => {

  config.DEBUG = false;
  config.TEST = true;
  let cpu;

  beforeEach( () => {
    cpu = new CPU(new MMUMock(), new LCDMock());
    /**
     * NOP
     */
    cpu.nop = function(){
      this._m++;
    };
  });

  it('should indicate to the MMU that DMA is done', () => {

    cpu.mmu.writeByteAt(cpu.mmu.ADDR_LCDC, 0b10000000); // LCD on
    cpu.setIe(1); // enable vblank
    cpu.mmu.setDMA(true);

    cpu.execute = () => cpu.nop();
    cpu.frame();

    assert(!cpu.mmu.isDMA());
  });

});