import CPU from '../src/cpu';
import MMU from '../src/mmu';
import Loader from '../src/loader';
import assert from 'assert';
import config from '../src/config';
import lcdMock from './mock/lcdMock';
import StorageMock from './mock/storageMock';
import {describe, beforeEach, it} from 'mocha';

describe('Dividers', () => {

  config.DEBUG = false;
  config.TEST = true;
  let cpu;

  beforeEach( () => {
    const loader = new Loader('./roms/blargg_cpu_instrs.gb');
    cpu = new CPU(new MMU(loader.asUint8Array(), new StorageMock()), new lcdMock());
    cpu._handle_lcd = () => {};
    cpu.execute = () => cpu.nop();
    /**
     * NOP
     */
    cpu.nop = () => cpu._m++;
  });

  it('should increase first bit of divider', () => {

    cpu._isVBlankTriggered = () => cpu._m >= (1 << 7); // stop execution at 2^7 machine cycles

    cpu.frame();

    assert.equal(cpu.mmu.readByteAt(cpu.mmu.ADDR_DIV), 0x01);

    for(let f = 0; f < 100; f++) {
      cpu._m = 0;
      cpu.frame();
    }

    assert.equal(cpu.mmu.readByteAt(cpu.mmu.ADDR_DIV), 101);
  });

  it('should increase last bit of divider', () => {

    cpu._isVBlankTriggered = () => cpu._m >= (1 << 14); // stop execution at 2^7 machine cycles

    cpu.frame();

    assert.equal(cpu.mmu.readByteAt(cpu.mmu.ADDR_DIV), 0x80);
  });
});