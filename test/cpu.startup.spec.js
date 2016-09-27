import CPU from '../src/cpu';
import MMU from '../src/mmu';
import Loader from '../src/loader';
import assert from 'assert';
import {describe, before, it} from 'mocha';
import lcdMock from './mock/lcdMock';

let cpu;

describe('Start BIOS', () => {

  before( () => {
    const loader = new Loader('./roms/blargg_cpu_instrs.gb');
    cpu = new CPU(new MMU(loader.asUint8Array()), new lcdMock());
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
    cpu.runUntil(0x0028);
    assert.equal(cpu.mmu.readByteAt(0x9fff), 0x00, 'Top VRAM empty');
    assert.equal(cpu.mmu.readByteAt(0x8000), 0x00, 'Bottom VRAM empty');
  });
});