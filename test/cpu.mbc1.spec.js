import CPU from '../src/cpu';
import MMU from '../src/mmu';
import assert from 'assert';
import {describe, before, it} from 'mocha';
import LCDMock from './mock/lcdMock';
import StorageMock from './mock/StorageMock';

let cpu, mmu, rom, extRAM, storage;

describe('MBC1', () => {

  before( () => {
    storage = new StorageMock();
    rom = new Uint8Array(0x10000);
    mmu = new MMU(rom, storage);

    rom[0] = 0xa;
    rom[mmu.ADDR_CARTRIDGE_TYPE] = 1; // MBC1
    rom[mmu.ADDR_ROM_SIZE] = 1; // 64KB, 4 banks
    rom[mmu.ADDR_ROM_BANK_START * 1] = 0xb;
    rom[mmu.ADDR_ROM_BANK_START * 2] = 0xc;
    rom[mmu.ADDR_ROM_BANK_START * 3] = 0xd;

    mmu = new MMU(rom, storage); // reload
    cpu = new CPU(mmu, new LCDMock());

    extRAM = mmu.getExtRAM();
    extRAM[0] = 0x01;
    extRAM[mmu.MBC1_RAM_BANK_SIZE * 1] = 0x02;
    extRAM[mmu.MBC1_RAM_BANK_SIZE * 2] = 0x03;
    extRAM[mmu.MBC1_RAM_BANK_SIZE * 3] = 0x04;
  });

  it('should detect MBC1 with defaults', () => {
    assert.equal(mmu.getMBC1Mode(), 0, 'Mode 0: 2MB ROM, 8KB RAM');
    assert.equal(mmu.getRomSize(), '64KB');
    assert.equal(mmu.getNbOfROMBanks(), 4);

    assert.equal(mmu.getSelectedROMBankNb(), 1);
    assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 1]);
  });

  it('should detect unsupported 4Mb/32KB mode', () => {
    cpu.ld_hl_nn(0x6000);
    cpu.ld_a_n(1);
    assert.throws( () => cpu.ld_0xhl_a(), Error, 'Unsupported 4Mb/32KB mode');

    cpu.ld_hl_nn(0x7fff);
    assert.throws( () => cpu.ld_0xhl_a(), Error, 'Unsupported 4Mb/32KB mode');
  });

  describe('ROM bank', () => {

    it('should switch ROM banks', () => {
      cpu.ld_hl_nn(0x2000);

      cpu.ld_a_n(0);
      cpu.ld_0xhl_a();

      assert.equal(mmu.getSelectedROMBankNb(), 1);
      assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 1]);

      cpu.ld_a_n(1);
      cpu.ld_0xhl_a();

      assert.equal(mmu.getSelectedROMBankNb(), 1);
      assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 1]);

      cpu.ld_a_n(2);
      cpu.ld_0xhl_a();

      assert.equal(mmu.getSelectedROMBankNb(), 2);
      assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 2]);

      cpu.ld_a_n(3);
      cpu.ld_0xhl_a();

      assert.equal(mmu.getSelectedROMBankNb(), 3);
      assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 3]);

      cpu.ld_a_n(4); // 4 mod 4 = 0
      cpu.ld_0xhl_a();

      assert.equal(mmu.getSelectedROMBankNb(), 0);
      assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[0]);

      cpu.ld_a_n(5); // 5 mod 4 = 1
      cpu.ld_0xhl_a();

      assert.equal(mmu.getSelectedROMBankNb(), 1);
      assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 1]);

      // Max bank number
      cpu.ld_a_n(0x1f); // 0x1f mod 4 = 3
      cpu.ld_0xhl_a();

      assert.equal(mmu.getSelectedROMBankNb(), 3);
      assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 3]);
    });

    it('should switch ROM banks writing anywhere from 0x2000 to 0x3fff', () => {
      cpu.ld_hl_nn(0x3fff);
      cpu.ld_a_n(2);
      cpu.ld_0xhl_a();

      assert.equal(mmu.getSelectedROMBankNb(), 2);
      assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 2]);
    });

    it('should select bank 1 on invalid bank number', () => {
      cpu.ld_hl_nn(0x2000);
      cpu.ld_a_n(0); // bank < 0
      cpu.ld_0xhl_a();

      assert.equal(mmu.getSelectedROMBankNb(), 1);
      assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 1]);

      cpu.ld_a_n(0x20); // bank > 0x1f
      cpu.ld_0xhl_a();

      assert.equal(mmu.getSelectedROMBankNb(), 1);
      assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 1]);
    });
  });

  describe('RAM bank', () => {
    it('should read from 0-3 RAM banks writing the bank anywhere from 0x4000 to 0x5fff', () => {
      assert.equal(mmu.getSelectedRAMBankNb(), 0, 'Default');

      cpu.ld_hl_nn(0x4000);
      cpu.ld_a_n(0);
      cpu.ld_0xhl_a();

      assert.equal(mmu.getSelectedRAMBankNb(), 0);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[0]);

      cpu.ld_a_n(1);
      cpu.ld_0xhl_a();

      assert.equal(mmu.getSelectedRAMBankNb(), 1);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[mmu.MBC1_RAM_BANK_SIZE]);

      cpu.ld_a_n(2);
      cpu.ld_0xhl_a();

      assert.equal(mmu.getSelectedRAMBankNb(), 2);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[mmu.MBC1_RAM_BANK_SIZE * 2]);

      cpu.ld_a_n(3);
      cpu.ld_0xhl_a();

      assert.equal(mmu.getSelectedRAMBankNb(), 3);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[mmu.MBC1_RAM_BANK_SIZE * 3]);

      cpu.ld_hl_nn(0x5fff);

      cpu.ld_a_n(1);
      cpu.ld_0xhl_a();

      assert.equal(mmu.getSelectedRAMBankNb(), 1);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[mmu.MBC1_RAM_BANK_SIZE]);
    });

    it('should select banks on invalid bank number', () => {
      cpu.ld_hl_nn(0x4000);

      cpu.ld_a_n(4); // bank > 3
      cpu.ld_0xhl_a();

      assert.equal(mmu.getSelectedRAMBankNb(), 0 /* 4 mod 4 */);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[0]);
    });

    it('should write in external RAM', () => {
      // Select bank 1
      cpu.ld_hl_nn(0x4000);
      cpu.ld_a_n(1);
      cpu.ld_0xhl_a();

      // Write something
      cpu.ld_bc_nn(0xa000);
      cpu.ld_a_n(0xaa);
      cpu.ld_0xbc_a();

      cpu.ld_bc_nn(0xa001);
      cpu.ld_a_n(0xff);
      cpu.ld_0xbc_a();

      assert.equal(extRAM[mmu.MBC1_RAM_BANK_SIZE], 0xaa);
      assert.equal(extRAM[mmu.MBC1_RAM_BANK_SIZE + 1], 0xff);

      // Change bank
      cpu.ld_a_n(2);
      cpu.ld_0xhl_a();

      // Write something
      cpu.ld_bc_nn(0xa000);
      cpu.ld_a_n(0xbb);
      cpu.ld_0xbc_a();

      assert.equal(extRAM[mmu.MBC1_RAM_BANK_SIZE * 2], 0xbb);
      assert.equal(extRAM[mmu.MBC1_RAM_BANK_SIZE * 2 + 1], 0);
    });
  });

  describe('Battery', () => {
    it('should persist the external RAM', () => {
      cpu.ld_hl_nn(0x4000);
      cpu.ld_a_n(0);
      cpu.ld_0xhl_a();

      cpu.ld_bc_nn(0xa000);
      cpu.ld_a_n(0xaa);
      cpu.ld_0xbc_a();

      let savedRAM = mmu.getSavedRAM();
      assert.equal(savedRAM[0], 0xaa);

      mmu = new MMU(rom, storage); // reload
      cpu = new CPU(mmu, new LCDMock());

      assert.equal(mmu.getExtRAM()[0], 0xaa, 'should keep the ext RAM thanks to storage');
    });
  });
});