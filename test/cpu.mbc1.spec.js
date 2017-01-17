import CPU from '../src/cpu';
import MMU from '../src/mmu';
import assert from 'assert';
import {describe, before, it} from 'mocha';
import LCDMock from './mock/lcdMock';

let cpu, mmu, rom;

describe('MBC1', () => {

  before( () => {
    rom = new Uint8Array(0x10000);
    mmu = new MMU(rom);

    rom[0] = 0xa;
    rom[mmu.ADDR_CARTRIDGE_TYPE] = 1; // MBC1
    rom[mmu.ADDR_ROM_SIZE] = 1; // 64KB, 4 banks
    rom[mmu.ADDR_ROM_BANK_START * 1] = 0xb;
    rom[mmu.ADDR_ROM_BANK_START * 2] = 0xc;
    rom[mmu.ADDR_ROM_BANK_START * 3] = 0xd;

    mmu = new MMU(rom); // reload
    cpu = new CPU(mmu, new LCDMock());
  });

  it('should detect MBC1 with defaults', () => {
    assert.equal(mmu.getMBC1Mode(), 0, 'Mode 0: 2MB ROM, 8KB RAM');
    assert.equal(mmu.getRomSize(), '64KB');
    assert.equal(mmu.getNbBanks(), 4);

    assert.equal(mmu.getSelectedBankNb(), 1);
    assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 1]);
  });

  it('should detect unsupported 4Mb/32KB mode', () => {
    cpu.ld_hl_nn(0x6000);
    cpu.ld_a_n(1);
    assert.throws( () => cpu.ld_0xhl_a(), Error, 'Unsupported 4Mb/32KB mode');

    cpu.ld_hl_nn(0x7fff);
    assert.throws( () => cpu.ld_0xhl_a(), Error, 'Unsupported 4Mb/32KB mode');
  });

  it('should switch ROM banks', () => {
    cpu.ld_hl_nn(0x2000);

    cpu.ld_a_n(0);
    cpu.ld_0xhl_a();

    assert.equal(mmu.getSelectedBankNb(), 1);
    assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 1]);

    cpu.ld_a_n(1);
    cpu.ld_0xhl_a();

    assert.equal(mmu.getSelectedBankNb(), 1);
    assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 1]);

    cpu.ld_a_n(2);
    cpu.ld_0xhl_a();

    assert.equal(mmu.getSelectedBankNb(), 2);
    assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 2]);

    cpu.ld_a_n(3);
    cpu.ld_0xhl_a();

    assert.equal(mmu.getSelectedBankNb(), 3);
    assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 3]);

    cpu.ld_a_n(4); // 4 mod 4 = 0
    cpu.ld_0xhl_a();

    assert.equal(mmu.getSelectedBankNb(), 0);
    assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[0]);

    cpu.ld_a_n(5); // 5 mod 4 = 1
    cpu.ld_0xhl_a();

    assert.equal(mmu.getSelectedBankNb(), 1);
    assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 1]);

    // Max bank number
    cpu.ld_a_n(0x1f); // 0x1f mod 4 = 3
    cpu.ld_0xhl_a();

    assert.equal(mmu.getSelectedBankNb(), 3);
    assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 3]);
  });

  it('should switch ROM banks writing anywhere from 0x2000 to 0x3fff', () => {
    cpu.ld_hl_nn(0x3fff);
    cpu.ld_a_n(2);
    cpu.ld_0xhl_a();

    assert.equal(mmu.getSelectedBankNb(), 2);
    assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 2]);
  });

  it('should select bank 1 on invalid bank number', () => {
    cpu.ld_hl_nn(0x2000);
    cpu.ld_a_n(0); // bank < 0
    cpu.ld_0xhl_a();

    assert.equal(mmu.getSelectedBankNb(), 1);
    assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 1]);

    cpu.ld_a_n(0x20); // bank > 0x1f
    cpu.ld_0xhl_a();

    assert.equal(mmu.getSelectedBankNb(), 1);
    assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 1]);
  });
});