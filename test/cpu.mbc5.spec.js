import CPU from '../src/cpu';
import MMU from '../src/mmu';
import assert from 'assert';
import {describe, beforeEach, it, before} from 'mocha';
import LCDMock from './mock/lcdMock';
import StorageMock from './mock/storageMock';

let cpu, mmu, rom64KB, rom512KB, rom1024KB, storage, extRAM;

describe('Memory Bank Controller 5 MBC5', () => {

  before( () => {
    storage = new StorageMock();
    rom64KB = new Uint8Array(0x10000);
    rom512KB = new Uint8Array(0x80000);
    rom1024KB = new Uint8Array(0x100000);
    mmu = new MMU(rom64KB, storage);
    cpu = new CPU(mmu, new LCDMock());

    cpu.selectROMBank = function(bankNb) {
      cpu.ld_hl_nn(0x2000);
      cpu.ld_a_n(bankNb & 0xff);
      cpu.ld_0xhl_a();
      if (bankNb > 0xff){
        cpu.ld_hl_nn(0x3000);
        cpu.ld_a_n(1);
        cpu.ld_0xhl_a();
      }
    };

    cpu.openRAMGate = function () {
      cpu.ld_hl_nn(0x0000);
      cpu.ld_a_n(mmu.MBC1_CSRAM_ON);
      cpu.ld_0xhl_a();
    };

    cpu.closeRAMGate = function () {
      cpu.ld_hl_nn(0x0000);
      cpu.ld_a_n(0);
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

  describe('MBC5 without RAM', () => {

    beforeEach( () => {
      rom64KB[mmu.ADDR_CARTRIDGE_TYPE] = mmu._ROM_MBC5;
      // Sample data
      rom64KB[0] = 0xa;
      rom64KB[mmu.ADDR_ROM_SIZE] = 1; // 64KB, 4 banks
      rom64KB[mmu.ADDR_ROM_BANK_START * 1] = 0xb;
      rom64KB[mmu.ADDR_ROM_BANK_START * 2] = 0xc;
      rom64KB[mmu.ADDR_ROM_BANK_START * 3] = 0xd;

      mmu = new MMU(rom64KB, storage); // reload
      cpu.mmu = mmu;
      extRAM = storage.read('');
    });

    it('should detect MBC5 with defaults', () => {
      assert.equal(mmu.getRomSize(), '64KB');
      assert.equal(mmu.getNbOfROMBanks(), 4);

      assert.equal(mmu.getSelectedROMBankNb(), 1);
      assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom64KB[mmu.ADDR_ROM_BANK_START * 1]);
    });

    describe('ROM bank', () => {

      it('should switch ROM banks', () => {
        cpu.selectROMBank(0);

        assert.equal(mmu.getSelectedROMBankNb(), 1);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom64KB[mmu.ADDR_ROM_BANK_START]);

        cpu.selectROMBank(1);

        assert.equal(mmu.getSelectedROMBankNb(), 1);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom64KB[mmu.ADDR_ROM_BANK_START]);

        cpu.selectROMBank(2);

        assert.equal(mmu.getSelectedROMBankNb(), 2);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom64KB[mmu.ADDR_ROM_BANK_START * 2]);

        cpu.selectROMBank(3);

        assert.equal(mmu.getSelectedROMBankNb(), 3);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom64KB[mmu.ADDR_ROM_BANK_START * 3]);

        cpu.selectROMBank(4); // 4 mod romBanks = 0 -> 1

        assert.equal(mmu.getSelectedROMBankNb(), 1);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom64KB[mmu.ADDR_ROM_BANK_START]);

        cpu.selectROMBank(4); // 5 mod romBanks = 1

        assert.equal(mmu.getSelectedROMBankNb(), 1);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom64KB[mmu.ADDR_ROM_BANK_START]);

        // Max bank number
        cpu.selectROMBank(0x1ff); // 0x1ff mod romBanks = 3

        assert.equal(mmu.getSelectedROMBankNb(), 3);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom64KB[mmu.ADDR_ROM_BANK_START * 3]);
      });

      it('should switch ROM banks writing anywhere from 0x2000 to 0x2fff', () => {
        cpu.ld_hl_nn(0x2fff);
        cpu.ld_a_n(2);
        cpu.ld_0xhl_a();

        assert.equal(mmu.getSelectedROMBankNb(), 2);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom64KB[mmu.ADDR_ROM_BANK_START * 2]);
      });

      it('should select bank 1 on invalid bank number', () => {
        cpu.ld_hl_nn(0x2000);
        cpu.ld_a_n(0); // bank === 0
        cpu.ld_0xhl_a();

        assert.equal(mmu.getSelectedROMBankNb(), 1);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom64KB[mmu.ADDR_ROM_BANK_START * 1]);

        cpu.ld_a_n(0x22); // bank > 0x1f
        cpu.ld_0xhl_a();

        assert.equal(mmu.getSelectedROMBankNb(), 2);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom64KB[mmu.ADDR_ROM_BANK_START * 2]);
      });

      it('should select ROM banks on 512KB roms', () => {

        rom512KB[mmu.ADDR_CARTRIDGE_TYPE] = 1; // MBC1
        rom512KB[mmu.ADDR_ROM_SIZE] = 4; // 512KB, 32 banks
        // Sample data
        for(let b = 0; b < 32; b++){
          rom512KB[mmu.ADDR_ROM_BANK_START * b] = b; // each bank is tagged with its number (0..0x1f)
        }

        mmu = new MMU(rom512KB, storage); // reload
        cpu.mmu = mmu;

        cpu.selectROMBank(0);
        assert.equal(mmu.getSelectedROMBankNb(), 1);
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom512KB[mmu.ADDR_ROM_BANK_START]);

        for(let b = 1; b < 32; b++){
          cpu.selectROMBank(b);
          assert.equal(mmu.getSelectedROMBankNb(), b, 'selected ROM bank');
          assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom512KB[mmu.ADDR_ROM_BANK_START * b]);
        }
      });

      it('should select ROM banks on roms larger than 512KB', () => {

        rom1024KB[mmu.ADDR_CARTRIDGE_TYPE] = mmu._ROM_MBC5;
        rom1024KB[mmu.ADDR_ROM_SIZE] = 5; // 1024KB, 64 banks
        // Sample data
        for(let b = 0; b < 64; b++){
          rom1024KB[mmu.ADDR_ROM_BANK_START * b] = b; // each bank is tagged with its number (0..0x3f)
        }

        mmu = new MMU(rom1024KB, storage); // reload
        cpu.mmu = mmu;

        for(let b = 1; b < 64; b++){
          cpu.selectROMBank(b);
          assert.equal(mmu.getSelectedROMBankNb(), b, 'selected ROM bank');
          assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom1024KB[mmu.ADDR_ROM_BANK_START * b]);
        }

        // Special cases
        cpu.selectROMBank(0);
        assert.equal(mmu.getSelectedROMBankNb(), 1, 'selected ROM bank');
        assert.equal(mmu.readByteAt(mmu.ADDR_ROM_BANK_START), rom1024KB[mmu.ADDR_ROM_BANK_START]);
      });

      it('should select ROM banks on 8MB ROMs', () => {
        // TODO
      });
    });
  });
  describe('MBC5 with RAM', () => {
    beforeEach( () => {
      rom64KB[mmu.ADDR_CARTRIDGE_TYPE] = mmu._ROM_MBC5_RAM;

      mmu = new MMU(rom64KB, storage); // reload
      cpu.mmu = mmu;
      mmu.flushExtRamToStorage();

      extRAM = storage.read('');
      extRAM[0] = 1;
      extRAM[mmu.MBC5_RAM_BANK_SIZE * 1] = 2;
      extRAM[mmu.MBC5_RAM_BANK_SIZE * 2] = 3;
      extRAM[mmu.MBC5_RAM_BANK_SIZE * 3] = 4;
      extRAM[mmu.MBC5_RAM_BANK_SIZE * 15] = 16;
    });

    it('should not read/write if the RAM gate is not opened', () => {
      assert.equal(mmu.getSelectedRAMBankNb(), 0);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), 0xff, 'RAM unavailable');

      cpu.openRAMGate();

      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[0], 'read RAM');

      cpu.closeRAMGate();

      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), 0xff, 'RAM unavailable');
    });

    it('should read from 0-15 RAM banks writing the bank anywhere from 0x4000 to 0x5fff', () => {
      assert.equal(mmu.getSelectedRAMBankNb(), 0, 'Default');

      cpu.openRAMGate();

      cpu.selectRAMBank(1);

      assert.equal(mmu.getSelectedRAMBankNb(), 1);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[mmu.MBC5_RAM_BANK_SIZE]);

      cpu.selectRAMBank(2);

      assert.equal(mmu.getSelectedRAMBankNb(), 2);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[mmu.MBC5_RAM_BANK_SIZE * 2]);

      cpu.selectRAMBank(3);

      assert.equal(mmu.getSelectedRAMBankNb(), 3);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[mmu.MBC5_RAM_BANK_SIZE * 3]);

      cpu.selectRAMBank(15);

      assert.equal(mmu.getSelectedRAMBankNb(), 15);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[mmu.MBC5_RAM_BANK_SIZE * 15]);

      cpu.selectRAMBank(16);

      assert.equal(mmu.getSelectedRAMBankNb(), 0);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[0]);

      cpu.closeRAMGate();
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), 0xff);

      // Select bank with a different address
      cpu.ld_hl_nn(0x5fff);
      cpu.ld_a_n(1);
      cpu.ld_0xhl_a();
      cpu.openRAMGate();

      assert.equal(mmu.getSelectedRAMBankNb(), 1);
      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), extRAM[mmu.MBC5_RAM_BANK_SIZE]);
    });

    it('should write in external RAM', () => {
      cpu.selectRAMBank(1);

      cpu.write(0xa000, 0x01);

      assert.equal(extRAM[mmu.MBC5_RAM_BANK_SIZE], 0x02, 'no change');

      cpu.openRAMGate();

      cpu.write(0xa000, 0x01);

      assert.equal(extRAM[mmu.MBC5_RAM_BANK_SIZE], 0x01);

      cpu.write(0xa001, 0x02);

      assert.equal(extRAM[mmu.MBC5_RAM_BANK_SIZE], 0x01);
      assert.equal(extRAM[mmu.MBC5_RAM_BANK_SIZE + 1], 0x02);

      cpu.selectRAMBank(2);
      cpu.write(0xa000, 0x03);

      assert.equal(extRAM[mmu.MBC5_RAM_BANK_SIZE * 2], 0x03);
      assert.equal(extRAM[mmu.MBC5_RAM_BANK_SIZE * 2 + 1], 0);

      cpu.closeRAMGate();
      cpu.write(0xa000, 0x04);

      assert.equal(extRAM[mmu.MBC5_RAM_BANK_SIZE * 2], 0x03, 'no change');
    });

    it('should persist the external RAM', () => {
      cpu.openRAMGate();
      cpu.write(0xa000, 0xaa);

      let savedRAM = mmu.getSavedRAM();
      assert.equal(savedRAM[0], 0xaa);

      mmu = new MMU(rom64KB, storage); // reload
      cpu.mmu = mmu;

      cpu.openRAMGate();

      assert.equal(mmu.readByteAt(mmu.ADDR_EXT_RAM_START), 0xaa, 'should keep the ext RAM value thanks to storage');
    });
  });
});