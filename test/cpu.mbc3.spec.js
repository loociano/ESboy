import CPU from '../src/cpu';
import MMU from '../src/mmu';
import assert from 'assert';
import {describe, beforeEach, it, before} from 'mocha';
import LCDMock from './mock/lcdMock';
import StorageMock from './mock/storageMock';

let cpu, mmu, rom, storage, extRAM;

describe('Memory Bank Controller 3 ', () => {

  before( () => {
    storage = new StorageMock();
    rom = new Uint8Array(0x10000);
    mmu = new MMU(rom, storage);
    cpu = new CPU(mmu, new LCDMock());

    cpu.openRAMGate = function () {
      cpu.ld_hl_nn(0x0000);
      cpu.ld_a_n(mmu.MBC3_CSRAM_ON);
      cpu.ld_0xhl_a();
    };

    cpu.closeRAMGate = function () {
      cpu.ld_hl_nn(0x0000);
      cpu.ld_a_n(0); // anything but 0x0a
      cpu.ld_0xhl_a();
    };

    cpu.selectROMBank = function (bankNb) {
      cpu.ld_hl_nn(0x2000);
      cpu.ld_a_n(bankNb);
      cpu.ld_0xhl_a();
    };

    cpu.selectRAMBank = function (bankNb) {
      cpu.ld_hl_nn(0x4000);
      cpu.ld_a_n(bankNb);
      cpu.ld_0xhl_a();
    };

    cpu.write = function (addr, value) {
      cpu.ld_bc_nn(addr);
      cpu.ld_a_n(value);
      cpu.ld_0xbc_a();
    };
  });

  describe('MBC3 without RAM or Timer', () => {

    beforeEach( () => {
      rom[mmu.ADDR_CARTRIDGE_TYPE] = 0x11; // MBC3: 0x11
      rom[mmu.ADDR_ROM_SIZE] = 1; // 64KB, 4 banks

      // Sample data
      rom[0] = 0xa;
      rom[mmu.ADDR_ROM_BANK_START * 1] = 0xb;
      rom[mmu.ADDR_ROM_BANK_START * 2] = 0xc;
      rom[mmu.ADDR_ROM_BANK_START * 3] = 0xd;

      mmu = new MMU(rom, storage); // reload
      cpu.mmu = mmu;
      extRAM = storage.read('');
    });

    it('should detect MBC3 with defaults', () => {
      assert.equal(mmu.getRomSize(), '64KB');
      assert.equal(mmu.getNbOfROMBanks(), 4);

      assert.equal(mmu.getSelectedROMBankNb(), 1);
      assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START]);
    });

    describe('ROM bank', () => {

      it('should switch ROM banks', () => {
        cpu.selectROMBank(0);

        assert.equal(mmu.getSelectedROMBankNb(), 1);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START]);

        cpu.selectROMBank(1);

        assert.equal(mmu.getSelectedROMBankNb(), 1);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START]);

        cpu.selectROMBank(2);

        assert.equal(mmu.getSelectedROMBankNb(), 2);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 2]);

        cpu.selectROMBank(3);

        assert.equal(mmu.getSelectedROMBankNb(), 3);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 3]);

        cpu.selectROMBank(4); // 4 mod numberOfBanks = 0 --> 1

        assert.equal(mmu.getSelectedROMBankNb(), 1);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START]);

        cpu.selectROMBank(5); // 5 mod numberOfBanks = 1

        assert.equal(mmu.getSelectedROMBankNb(), 1);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START]);

        // Max bank number
        cpu.selectROMBank(0x7f); // 0x7f mod numberOfBanks = 3

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
        cpu.selectROMBank(0);

        assert.equal(mmu.getSelectedROMBankNb(), 1);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START]);

        cpu.selectROMBank(0x80); // 0x80 mod numberOfBanks = 0 -> 1

        assert.equal(mmu.getSelectedROMBankNb(), 1);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START]);

        cpu.selectROMBank(0x82); // 0x82 mod numberOfBanks = 2

        assert.equal(mmu.getSelectedROMBankNb(), 2);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom[mmu.ADDR_ROM_BANK_START * 2]);
      });
    });

    describe('RAM', () => {
      it('should not have any effect on RAM', () => {
        assert.equal(mmu.getSelectedRAMBankNb(), 0);
        assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), 0xff, 'RAM unavailable');
        cpu.openRAMGate();
        assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), 0xff, 'RAM unavailable');
      });
      it('should not be able to write on RAM', () => {
        assert.equal(mmu.getSelectedRAMBankNb(), 0);
        cpu.openRAMGate();
        cpu.write(0xa000, 0x01);
        assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), 0xff);
        assert.equal(extRAM, undefined);
        assert.equal(storage.read(''), undefined);
      });
    });
  });

  describe('MBC3 with RAM', () => {
    beforeEach( () => {
      rom[mmu.ADDR_CARTRIDGE_TYPE] = 0x12; // MBC3+RAM: 0x12, 0x13, with timers: 0xf 0x10

      mmu = new MMU(rom, storage); // reload
      cpu.mmu = mmu;
      mmu.flushExtRamToStorage();

      extRAM = storage.read('');
      extRAM[0] = 0x01;
      extRAM[mmu.MBC3_RAM_BANK_SIZE * 1] = 0x02;
      extRAM[mmu.MBC3_RAM_BANK_SIZE * 2] = 0x03;
      extRAM[mmu.MBC3_RAM_BANK_SIZE * 3] = 0x04;
    });

    it('should not read/write if the RAM gate is not opened', () => {
      assert.equal(mmu.getSelectedRAMBankNb(), 0);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), 0xff, 'RAM unavailable');

      cpu.openRAMGate();

      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[0], 'read RAM');

      cpu.closeRAMGate();

      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), 0xff, 'RAM unavailable');
    });

    it('should read from 0-3 RAM banks writing the bank anywhere from 0x4000 to 0x5fff', () => {
      assert.equal(mmu.getSelectedRAMBankNb(), 0, 'Default');

      cpu.openRAMGate();
      cpu.selectRAMBank(1);

      assert.equal(mmu.getSelectedRAMBankNb(), 1);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[mmu.MBC3_RAM_BANK_SIZE]);

      cpu.selectRAMBank(2);

      assert.equal(mmu.getSelectedRAMBankNb(), 2);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[mmu.MBC3_RAM_BANK_SIZE * 2]);

      cpu.selectRAMBank(3);

      assert.equal(mmu.getSelectedRAMBankNb(), 3);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[mmu.MBC3_RAM_BANK_SIZE * 3]);

      cpu.closeRAMGate();
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), 0xff);

      // Select bank with a different address
      cpu.ld_hl_nn(0x5fff);
      cpu.ld_a_n(1);
      cpu.ld_0xhl_a();
      cpu.openRAMGate();

      assert.equal(mmu.getSelectedRAMBankNb(), 1);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[mmu.MBC3_RAM_BANK_SIZE]);
    });

    it('should select banks on invalid bank number', () => {
      cpu.selectRAMBank(4);
      cpu.openRAMGate();

      assert.equal(mmu.getSelectedRAMBankNb(), 0 /* 4 mod ramBanks */);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[0]);

      cpu.selectRAMBank(7);
      cpu.openRAMGate();

      assert.equal(mmu.getSelectedRAMBankNb(), 3 /* 7 mod ramBanks */);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[mmu.MBC3_RAM_BANK_SIZE * 3]);
    });

    it('should write in external RAM', () => {
      cpu.selectRAMBank(1);

      cpu.write(0xa000, 0x01);

      assert.equal(extRAM[mmu.MBC3_RAM_BANK_SIZE], 0x02, 'no change');

      cpu.openRAMGate();

      cpu.write(0xa000, 0x01);

      assert.equal(extRAM[mmu.MBC3_RAM_BANK_SIZE], 0x01);

      cpu.write(0xa001, 0x02);

      assert.equal(extRAM[mmu.MBC3_RAM_BANK_SIZE], 0x01);
      assert.equal(extRAM[mmu.MBC3_RAM_BANK_SIZE + 1], 0x02);

      cpu.selectRAMBank(2);
      cpu.write(0xa000, 0x03);

      assert.equal(extRAM[mmu.MBC3_RAM_BANK_SIZE * 2], 0x03);
      assert.equal(extRAM[mmu.MBC3_RAM_BANK_SIZE * 2 + 1], 0);

      cpu.closeRAMGate();
      cpu.write(0xa000, 0x04);

      assert.equal(extRAM[mmu.MBC3_RAM_BANK_SIZE * 2], 0x03, 'no change');
    });

    it('should persist the external RAM', () => {
      cpu.openRAMGate();
      cpu.write(0xa000, 0xaa);

      let savedRAM = mmu.getSavedRAM();
      assert.equal(savedRAM[0], 0xaa);

      mmu = new MMU(rom, storage); // reload
      cpu.mmu = mmu;

      cpu.openRAMGate();

      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), 0xaa, 'should keep the ext RAM value thanks to storage');
    });
  });
});