import MMU from '../src/mmu';
import Loader from '../src/loader';
import assert from 'assert';
import config from '../src/config';
import {describe, before, beforeEach, it} from 'mocha';
import StorageMock from './mock/storageMock';
import BrowserStorage from '../src/browserStorage';

describe('MMU', () => {

  config.DEBUG = false;
  config.TEST = true;

  let mmu, rom32KB;
  const GAME_NAME = 'CPU_INSTRS';

  beforeEach( () => {
    const loader = new Loader('./roms/blargg/cpu_instrs/cpu_instrs.gb');
    mmu = new MMU(loader.asUint8Array(), new StorageMock());
    mmu.If = function(){
      return this.readByteAt(mmu.ADDR_IF);
    };
  });

  describe('Initialization', () => {
    it('should handle missing ROM', () => {
      assert.throws(() => new MMU(undefined), Error, 'Missing ROM');
    });
    it('should start the memory map', () => {

      assert.equal(mmu._memory.length, 0x10000, 'Memory size is 0x10000');

      // Starting values at addresses
      assert.equal(mmu.readByteAt(0xff10), 0x80);
      assert.equal(mmu.readByteAt(0xff14), 0xbf);
      assert.equal(mmu.readByteAt(0xff16), 0x3f);
      assert.equal(mmu.readByteAt(0xff17), 0x00);
      assert.equal(mmu.readByteAt(0xff19), 0xbf);
      assert.equal(mmu.readByteAt(0xff1a), 0x7f);
      assert.equal(mmu.readByteAt(0xff1b), 0xff);
      assert.equal(mmu.readByteAt(0xff1c), 0x9f);
      assert.equal(mmu.readByteAt(0xff1e), 0xbf);
      assert.equal(mmu.readByteAt(0xff20), 0xff);
      assert.equal(mmu.readByteAt(0xff21), 0x00);
      assert.equal(mmu.readByteAt(0xff22), 0x00);
      assert.equal(mmu.readByteAt(0xff23), 0xbf);
      assert.equal(mmu.readByteAt(mmu.ADDR_IE), 0x01); // Allow vblank
    });
  });

  describe('Read/Write', () => {
    it('should write bytes in memory', () => {
      mmu.writeByteAt(0xc000, 0xab);
      assert.equal(mmu.readByteAt(0xc000), 0xab, 'write 0xab in memory address 0xc000');
    });

    it('should write without restrictions in the last memory address', () => {
      mmu.writeByteAt(0xffff, 0x0f);
      assert.equal(mmu.readByteAt(0xffff), 0x0f, 'should write on 0xffff');
    });

  });

  describe('Read/write ROM', () => {

    it('should read ROM', () => {
      rom32KB = new Uint8Array(0x8000);
      rom32KB[mmu.ADDR_CARTRIDGE_TYPE] = 0; // ROM
      rom32KB[mmu.ADDR_ROM_SIZE] = 0; // 32KB, no banks

      // Sample data
      rom32KB[0] = 1;
      rom32KB[0x4000] = 1;
      rom32KB[0x7fff] = 2;

      mmu = new MMU(rom32KB);
      mmu.setRunningBIOS(false);

      assert.equal(mmu.readByteAt(0), 1);
      assert.equal(mmu.readByteAt(0x4000), 1);
      assert.equal(mmu.readByteAt(0x7fff), 2);
    });
  });

  describe('BIOS', () => {
    it('should load the BIOS in memory', () => {
      assert.deepEqual(mmu.readBIOSBuffer(), mmu.getBIOS(), 'BIOS is in memory');
    });
    it('should read BIOS', () => {
      assert.equal(mmu.readByteAt(0x0000), 0x31, 'first BIOS byte');
      assert.equal(mmu.readByteAt(0x00ff), 0x50, 'last BIOS byte');
      assert.equal(mmu.readByteAt(0x0100), 0x00, 'first GAME byte');
      assert.equal(mmu.readByteAt(0x0101), 0xc3, 'second GAME byte');
    });
  });

  describe('ROM checks', () => {

    it('should read the game header', () => {
      assert.equal(mmu.getGameTitle(), GAME_NAME);
      assert.equal(mmu.isGameInColor(), true);
      assert.equal(mmu.isGameSuperGB(), false);
      assert.equal(mmu.isCartridgeSupported(), true, 'MBC1 is supported');
      assert.equal(mmu.getRomSize(), '64KB');
      assert.equal(mmu.getRAMSize(), 'None');
      assert.equal(mmu.getDestinationCode(), 'Japanese');
    });

    it('should read the nintendo graphic buffer', () => {
      const u8array = new Uint8Array([0xCE,0xED,0x66,0x66,0xCC,0x0D,0x00,0x0B,0x03,0x73,0x00,0x83,0x00,0x0C,0x00,0x0D,0x00,0x08,0x11,0x1F,0x88,0x89,0x00,0x0E,0xDC,0xCC,0x6E,0xE6,0xDD,0xDD,0xD9,0x99,0xBB,0xBB,0x67,0x63,0x6E,0x0E,0xEC,0xCC,0xDD,0xDC,0x99,0x9F,0xBB,0xB9,0x33,0x3E]);
      assert.deepEqual(mmu.getNintendoGraphicBuffer(), u8array, 'Nintendo Graphic Buffer must match.');
    });

    it('should compute the checksum', () => {
      assert(mmu.isChecksumCorrect());
    });

  });

  describe('LY Register', () => {

    it('should write ly', () => {
      mmu.setLy(0x01);
      assert.equal(mmu.ly(), 0x01, 'set ly');
    });

    it('should increment ly', () => {
      mmu.setLy(0);
      mmu.incrementLy();
      mmu.incrementLy();
      assert.equal(mmu.ly(), 2, 'LY incremented one');
    });

    it('should restart ly', () => {
      mmu.setLy(153);

      mmu.incrementLy();

      assert.equal(mmu.ly(), 0, 'LY reset');
    });

  });

  describe('LCD Control Register LCDC', () => {

    it('should read/write LCDC', () => {
      mmu.writeByteAt(mmu.ADDR_LCDC, 0x80);
      assert.equal(mmu.lcdc(), 0x80, 'LCD on');
    });

    it('should set LCD mode 0 when LCD is off', () => {
      mmu.writeByteAt(mmu.ADDR_LCDC, 0x80); // ON
      mmu.setLCDMode(1);

      mmu.writeByteAt(mmu.ADDR_LCDC, 0x00); // OFF
      assert.equal(mmu.getLCDMode(), 0, 'Reset LCD mode');
    });

    it('should turn on/off background based on LCDC bit 7', () => {
      const chrData = new Uint8Array([0xab,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xcd]);
      mmu.writeBuffer(chrData, 0x8000);
      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() | mmu.MASK_BG_ON | mmu.MASK_BG_CHAR_DATA_8000);

      assert.deepEqual([
        ...mmu.readBGData(0,0),
        ...mmu.readBGData(0,1),
        ...mmu.readBGData(0,2),
        ...mmu.readBGData(0,3),
        ...mmu.readBGData(0,4),
        ...mmu.readBGData(0,5),
        ...mmu.readBGData(0,6),
        ...mmu.readBGData(0,7)], chrData, 'Character data matches');

      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() & mmu.MASK_BG_OFF);

      assert.deepEqual([
        ...mmu.readBGData(0,0),
        ...mmu.readBGData(0,1),
        ...mmu.readBGData(0,2),
        ...mmu.readBGData(0,3),
        ...mmu.readBGData(0,4),
        ...mmu.readBGData(0,5),
        ...mmu.readBGData(0,6),
        ...mmu.readBGData(0,7)], new Uint8Array([0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]), 'Transparent');
    });

    it('should select Window Code Area based on LCDC bit 6', () => {
      mmu.writeByteAt(0x9800, 0xaa);
      mmu.writeByteAt(0x9bff, 0xbb);

      mmu.writeByteAt(0x9c00, 0xcc);
      mmu.writeByteAt(0x9fff, 0xdd);

      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() & mmu.MASK_WINDOW_CODE_AREA_0);

      assert.equal(mmu.getWindowCharCode(0, 0), 0xaa);
      assert.equal(mmu.getWindowCharCode(31, 31), 0xbb);

      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() | mmu.MASK_WINDOW_CODE_AREA_1);

      assert.equal(mmu.getWindowCharCode(0, 0), 0xcc);
      assert.equal(mmu.getWindowCharCode(31, 31), 0xdd);
    });

    it('should display the Window based on LCDC bit 5', () => {
      assert.equal(mmu.isWindowOn(), false);

      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() | mmu.MASK_WINDOW_ON);
      assert.equal(mmu.isWindowOn(), true);

      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() & mmu.MASK_WINDOW_OFF);
      assert.equal(mmu.isWindowOn(), false);
    });

    it('should return tile address for BG data based on LCDC bit 4', () => {
      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() | mmu.MASK_BG_CHAR_DATA_8000);
      assert.equal(mmu.getBgCharDataStartAddr(0x00), 0x8000);
      assert.equal(mmu.getBgCharDataStartAddr(0x7f), 0x87f0);
      assert.equal(mmu.getBgCharDataStartAddr(0x80), 0x8800);
      assert.equal(mmu.getBgCharDataStartAddr(0xff), 0x8ff0);

      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() & mmu.MASK_BG_CHAR_DATA_8800);
      assert.equal(mmu.getBgCharDataStartAddr(0x00), 0x9000);
      assert.equal(mmu.getBgCharDataStartAddr(0x7f), 0x97f0);
      assert.equal(mmu.getBgCharDataStartAddr(0x80), 0x8800);
      assert.equal(mmu.getBgCharDataStartAddr(0xff), 0x8ff0);
    });

    it('should read character data 0x8000-0x8fff based on LCDC bit 4', () => {
      const BGData_00 = new Uint8Array([0xab,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xcd]);
      const BGData_ff = new Uint8Array([0x11,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xff]);
      mmu.writeBuffer(BGData_00, 0x8000);
      mmu.writeBuffer(BGData_ff, 0x8ff0);
      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() | mmu.MASK_BG_CHAR_DATA_8000 | mmu.MASK_BG_ON);
      
      assert.deepEqual([
        ...mmu.readBGData(0x00, 0),
        ...mmu.readBGData(0x00, 1),
        ...mmu.readBGData(0x00, 2),
        ...mmu.readBGData(0x00, 3),
        ...mmu.readBGData(0x00, 4),
        ...mmu.readBGData(0x00, 5),
        ...mmu.readBGData(0x00, 6),
        ...mmu.readBGData(0x00, 7)]
        , BGData_00);

      assert.deepEqual([
        ...mmu.readBGData(0xff, 0),
        ...mmu.readBGData(0xff, 1),
        ...mmu.readBGData(0xff, 2),
        ...mmu.readBGData(0xff, 3),
        ...mmu.readBGData(0xff, 4),
        ...mmu.readBGData(0xff, 5),
        ...mmu.readBGData(0xff, 6),
        ...mmu.readBGData(0xff, 7)], BGData_ff);
    });

    it('should read character data 0x8800-0x97ff based on LCDC bit 4', () => {
      const BGData_00 = new Uint8Array([0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]);
      const BGData_7f = new Uint8Array([0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]);
      const BGData_80 = new Uint8Array([0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]);
      const BGData_ff = new Uint8Array([0x04,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]);
      mmu.writeBuffer(BGData_00, 0x9000);
      mmu.writeBuffer(BGData_7f, 0x97f0);
      mmu.writeBuffer(BGData_80, 0x8800);
      mmu.writeBuffer(BGData_ff, 0x8ff0);

      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() & mmu.MASK_BG_CHAR_DATA_8800 | mmu.MASK_BG_ON);

      assert.deepEqual([
        ...mmu.readBGData(0x00, 0),
        ...mmu.readBGData(0x00, 1),
        ...mmu.readBGData(0x00, 2),
        ...mmu.readBGData(0x00, 3),
        ...mmu.readBGData(0x00, 4),
        ...mmu.readBGData(0x00, 5),
        ...mmu.readBGData(0x00, 6),
        ...mmu.readBGData(0x00, 7)],
        BGData_00, 'BG data 0x00 data matches');
      assert.deepEqual([
        ...mmu.readBGData(0x7f, 0),
        ...mmu.readBGData(0x7f, 1),
        ...mmu.readBGData(0x7f, 2),
        ...mmu.readBGData(0x7f, 3),
        ...mmu.readBGData(0x7f, 4),
        ...mmu.readBGData(0x7f, 5),
        ...mmu.readBGData(0x7f, 6),
        ...mmu.readBGData(0x7f, 7)], BGData_7f, 'BG data 0x7f data matches');
      assert.deepEqual([
        ...mmu.readBGData(0x80, 0),
        ...mmu.readBGData(0x80, 1),
        ...mmu.readBGData(0x80, 2),
        ...mmu.readBGData(0x80, 3),
        ...mmu.readBGData(0x80, 4),
        ...mmu.readBGData(0x80, 5),
        ...mmu.readBGData(0x80, 6),
        ...mmu.readBGData(0x80, 7)], BGData_80, 'BG data 0x80 data matches');
      assert.deepEqual([
        ...mmu.readBGData(0xff, 0),
        ...mmu.readBGData(0xff, 1),
        ...mmu.readBGData(0xff, 2),
        ...mmu.readBGData(0xff, 3),
        ...mmu.readBGData(0xff, 4),
        ...mmu.readBGData(0xff, 5),
        ...mmu.readBGData(0xff, 6),
        ...mmu.readBGData(0xff, 7)], BGData_ff, 'BG data 0xff data matches');
    });

    it('should read character code from 0x9800 based on LCDC bit 3', () => {
      mmu.writeByteAt(0x9800, 0xab);
      mmu.writeByteAt(0x9bff, 0xcd);
      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() & mmu.MASK_BG_CODE_AREA_1);

      assert.equal(mmu.getBgCharCode(0, 0), 0xab, 'Block 0');
      assert.equal(mmu.getBgCharCode(31, 31), 0xcd, 'Block 1023');
    });

    it('should read character code from 0x9c00 based on LCDC bit 3', () => {
      mmu.writeByteAt(0x9c00, 0xab);
      mmu.writeByteAt(0x9fff, 0xcd);
      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() | mmu.MASK_BG_CODE_AREA_2);

      assert.equal(mmu.getBgCharCode(0, 0), 0xab, 'Block 0');
      assert.equal(mmu.getBgCharCode(31, 31), 0xcd, 'Block 1023');
    });

    it('should detect OBJ 8x16 as unsupported based on LCDC bit 2', () => {
      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() | mmu.MASK_OBJ_8x16_ON);
      assert.equal(mmu.areOBJDouble(), true);

      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() & mmu.MASK_OBJ_8x16_OFF);
      assert.equal(mmu.areOBJDouble(), false);
    });

    it('should enable OBJ based on LCDC bit 1', () => {
      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() | mmu.MASK_OBJ_ON);
      assert(mmu.areOBJOn());
      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() & mmu.MASK_OBJ_OFF);
      assert(!mmu.areOBJOn());
    });

  });

  describe('STAT or LCDC Status Flag', () => {
    
    it('should read/write STAT', () => {
      mmu.writeByteAt(mmu.ADDR_STAT, 0x00);
      assert.equal(mmu.stat(), 0x80, 'STAT.7 always set');

      mmu.writeByteAt(mmu.ADDR_STAT, 0x80);
      assert.equal(mmu.stat(), 0x80, 'STAT set');
    });

    it('should detect unsupported Interrupt selection', () => {
      assert.throws( () => mmu.writeByteAt(mmu.ADDR_STAT, 0b00001000), Error, 'Interrupt Mode 0 unsupported');
      assert.throws( () => mmu.writeByteAt(mmu.ADDR_STAT, 0b00010000), Error, 'Interrupt Mode 1 unsupported');
      assert.throws( () => mmu.writeByteAt(mmu.ADDR_STAT, 0b00100000), Error, 'Interrupt Mode 2 unsupported');
      mmu.writeByteAt(mmu.ADDR_STAT, 0b01000000); // LY=LYC is ok
    });

    it('should handle VRAM and OAM restrictions', () => {

      mmu.writeByteAt(mmu.ADDR_OAM_START, 0xab);
      mmu.writeByteAt(mmu.ADDR_VRAM_START, 0xbc);

      mmu.setLCDMode(2);

      // Cannot read/write OAM on mode 2
      mmu.writeByteAt(mmu.ADDR_OAM_START, 0x00);
      assert.equal(mmu.readByteAt(mmu.ADDR_OAM_START), 0xff, 'Cannot read OAM on mode 2');

      mmu.setLCDMode(3);

      // Cannot read/write OAM/VRAM on mode 3
      mmu.writeByteAt(mmu.ADDR_OAM_START, 0x01);
      mmu.writeByteAt(mmu.ADDR_VRAM_START, 0x01);
      assert.equal(mmu.readByteAt(mmu.ADDR_OAM_START), 0xff);
      assert.equal(mmu.readByteAt(mmu.ADDR_VRAM_START), 0xff);
    });

    it('should update STAT.2 when LY equals LYC', () => {
      mmu.writeByteAt(mmu.ADDR_STAT, 0b01000000);

      mmu.writeByteAt(mmu.ADDR_LYC, 1);
      mmu.setLy(2);

      assert.equal(mmu.lyEqualsLyc(), false, 'LYC !== LY');
      assert.equal(mmu.If(), 0b00000000);

      mmu.writeByteAt(mmu.ADDR_LYC, 2);
      
      assert.equal(mmu.lyEqualsLyc(), true, 'LYC === LY');
      assert.equal(mmu.If(), 0b00000010);

      mmu.setLy(3);

      assert.equal(mmu.lyEqualsLyc(), false, 'LYC !== LY');
      assert.equal(mmu.If(), 0b00000010, 'CPU will reset IF when interrupt is handled');

      mmu.writeByteAt(mmu.ADDR_LYC, 3);
      assert.equal(mmu.lyEqualsLyc(), true, 'LYC === LY');

      mmu.writeByteAt(mmu.ADDR_STAT, 0b01000000); // Reset match flag
      assert.equal(mmu.lyEqualsLyc(), false, 'LYC !== LY');

      mmu.writeByteAt(mmu.ADDR_LYC, 4);
      mmu.setLy(4);
      assert.equal(mmu.lyEqualsLyc(), true, 'LYC === LY');
    });

  });

  describe('Window', () => {
    it('should read/write windows registers', () => {
      mmu.writeByteAt(mmu.ADDR_WX, 0x20);
      assert.equal(mmu.wx(), 0x20);

      mmu.writeByteAt(mmu.ADDR_WY, 0x30);
      assert.equal(mmu.wy(), 0x30);

      mmu.writeByteAt(mmu.ADDR_WY, 0xff); // lcd will not accept wy > 143
      assert.equal(mmu.wy(), 0xff);
    });
  });

  describe('OBJ (Sprites)', () => {

    it('should return address for OBJ data', () => {
      assert.equal(mmu.getOBJCharDataStartAddr(0), 0x8000);
      // ...
      assert.equal(mmu.getOBJCharDataStartAddr(0xff), 0x8ff0);

    });

    it('should read OBJ data from 0x8000-0x8fff', () => {
      const OBJData_00 = new Uint8Array([0xab,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xcd]);
      const OBJData_ff = new Uint8Array([0x11,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xff]);
      mmu.writeBuffer(OBJData_00, 0x8000);
      mmu.writeBuffer(OBJData_ff, 0x8ff0);
      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() | mmu.MASK_OBJ_ON);

      assert.deepEqual([...mmu.readOBJData(0x00,0),
        ...mmu.readOBJData(0x00,1),
        ...mmu.readOBJData(0x00,2),
        ...mmu.readOBJData(0x00,3),
        ...mmu.readOBJData(0x00,4),
        ...mmu.readOBJData(0x00,5),
        ...mmu.readOBJData(0x00,6),
        ...mmu.readOBJData(0x00,7)], OBJData_00, 'OBJ 0x00 data matches');
      assert.deepEqual([...mmu.readOBJData(0xff,0),
        ...mmu.readOBJData(0xff,1),
        ...mmu.readOBJData(0xff,2),
        ...mmu.readOBJData(0xff,3),
        ...mmu.readOBJData(0xff,4),
        ...mmu.readOBJData(0xff,5),
        ...mmu.readOBJData(0xff,6),
        ...mmu.readOBJData(0xff,7)], OBJData_ff, 'OBJ 0xff data matches');
    });

    it('should read OBJs from OAM', () => {

      mmu.writeByteAt(mmu.ADDR_OAM_START, 0x01);
      mmu.writeByteAt(mmu.ADDR_OAM_START + 1, 0x02);
      mmu.writeByteAt(mmu.ADDR_OAM_START + 2, 0xab);
      mmu.writeByteAt(mmu.ADDR_OAM_START + 3, 0b00000000);

      const {y, x, chrCode, attr} = mmu.getOBJ(0);

      assert.equal(y, 0x01);
      assert.equal(x, 0x02);
      assert.equal(chrCode, 0xab);
      assert.equal(attr, 0x00);
    });

    it('should not allow reading object 40', () => {
      assert.throws( () => this.mmu.getOBJ(-1), Error, '-1 out of range');
      assert.throws( () => this.mmu.getOBJ(40), Error, '40 out of range');
    });
  });
  
  describe('Joypad', () => {
    it('should return all high by default', () => {
      assert.equal(mmu.p1(), 0xff, 'Default');
    });

    it('should select arrows by setting P14 low', () =>{

      mmu.pressRight();
      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11101110, 'Right pressed');

      mmu.liftRight();
      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11101111, 'Right lifted');

      mmu.pressLeft();
      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11101101, 'Left pressed');

      mmu.liftLeft();
      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11101111, 'Left lifted');

      mmu.pressUp();
      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11101011, 'Up pressed');

      mmu.liftUp();
      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11101111, 'Up lifted');

      mmu.pressDown();
      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11100111, 'Down pressed');

      mmu.liftDown();
      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11101111, 'Down lifted');
    });

    it('should select buttons by setting P15 low', () =>{

      mmu.pressA();
      mmu.writeByteAt(mmu.ADDR_P1, 0x10);
      assert.equal(mmu.p1(), 0b11011110, 'A pressed');

      mmu.liftA();
      mmu.writeByteAt(mmu.ADDR_P1, 0x10);
      assert.equal(mmu.p1(), 0b11011111, 'A lifted');

      mmu.pressB();
      mmu.writeByteAt(mmu.ADDR_P1, 0x10);
      assert.equal(mmu.p1(), 0b11011101, 'B pressed');

      mmu.liftB();
      mmu.writeByteAt(mmu.ADDR_P1, 0x10);
      assert.equal(mmu.p1(), 0b11011111, 'B lifted');

      mmu.pressSELECT();
      mmu.writeByteAt(mmu.ADDR_P1, 0x10);
      assert.equal(mmu.p1(), 0b11011011, 'SELECT pressed');

      mmu.liftSELECT();
      mmu.writeByteAt(mmu.ADDR_P1, 0x10);
      assert.equal(mmu.p1(), 0b11011111, 'SELECT pressed');

      mmu.pressSTART();
      mmu.writeByteAt(mmu.ADDR_P1, 0x10);
      assert.equal(mmu.p1(), 0b11010111, 'START pressed');

      mmu.liftSTART();
      mmu.writeByteAt(mmu.ADDR_P1, 0x10);
      assert.equal(mmu.p1(), 0b11011111, 'START lifted');
    });

    it('should detect buttons and arrows at the same bit position', () => {
      mmu.pressRight();

      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11101110, 'Right pressed');

      mmu.writeByteAt(mmu.ADDR_P1, 0x10);
      assert.equal(mmu.p1(), 0b11011111, 'A is not pressed');

      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11101110, 'Right keeps pressed');
    });

    it('should reset', () => {
      mmu.writeByteAt(mmu.ADDR_P1, 0x30);
      assert.equal(mmu.p1(), 0xff, 'Default');
    });
  });

  describe('DMA', () => {

    it('should not allow DMA from ROM area', () => {
      assert.throws( () => {
        mmu.writeByteAt(mmu.ADDR_DMA, mmu.ADDR_ROM_MAX >> 8);
      }, Error, 'No DMA allowed from ROM area');
    });

    it('should run DMA', () => {

      for(let i = 0; i < mmu.DMA_LENGTH; i++){
        mmu.writeByteAt(mmu.ADDR_WRAM_START + i, 0xaa);
      }

      mmu.writeByteAt(mmu.ADDR_DMA, mmu.ADDR_WRAM_START >> 8); // 0xc0

      assert.equal(mmu.readByteAt(mmu.ADDR_OAM_START), 0xff, 'Cannot access OAM until DMA completes');

      mmu.setDMA(false); // Mock DMA end

      for(let i = 0; i < mmu.DMA_LENGTH; i++){
        assert.equal(mmu.readByteAt(mmu.ADDR_OAM_START + i), 0xaa);
      }
    });

  });

  describe('Serial Cable Communication', () => {
    it('should detect serial communication', () => {
      assert.throws( () => mmu.readByteAt(mmu.ADDR_SB), Error, 'SB register unsupported');
      assert.equal(mmu.readByteAt(mmu.ADDR_SC), 0, 'SC register unsupported');
    });
  });

  describe('Timers', () => {
    it('should be able to write on TAC', () => {
      mmu.writeByteAt(mmu.ADDR_TAC, 0x07);
      assert.equal(mmu.readByteAt(mmu.ADDR_TAC), 0x07);

      mmu.writeByteAt(mmu.ADDR_TAC, 0xff);
      assert.equal(mmu.readByteAt(mmu.ADDR_TAC), 0x07, 'only bits 0,1,2 can be set');
    });
  });

  describe('Dividers', () => {
    it('should detect dividers', () => {
      assert.equal(mmu.readByteAt(mmu.ADDR_DIV), 0x00);
    });

    it('should set DIV with the msb', () => {
      mmu.setHWDivider(0x0000);
      assert.equal(mmu.readByteAt(mmu.ADDR_DIV), 0x00);

      mmu.setHWDivider(0xff00);
      assert.equal(mmu.readByteAt(mmu.ADDR_DIV), 0xff);

      mmu.setHWDivider(0x0100);
      assert.equal(mmu.readByteAt(mmu.ADDR_DIV), 0x00);
    });

    it('should reset DIV regardless of the value written', () => {
      mmu.writeByteAt(mmu.ADDR_DIV, 0xab);
      assert.equal(mmu.readByteAt(mmu.ADDR_DIV), 0x00);
    });
  });

  describe('Palettes', () => {
    it('should read palette registers', () => {
      mmu.writeByteAt(mmu.ADDR_BGP, 0xff);
      assert.equal(mmu.bgp(), 0xff);

      mmu.writeByteAt(mmu.ADDR_OBG0, 0xee);
      assert.equal(mmu.obg0(), 0xee);

      mmu.writeByteAt(mmu.ADDR_OBG1, 0xcc);
      assert.equal(mmu.obg1(), 0xcc);
    });
  });

  describe('Memory Bank Controllers (MBC)', () => {
    describe('MBC1', () => {
      it('should get mode', () => {
        assert.equal(mmu.getMBC1Mode(), 0);
      })

      it('should get number of ROM banks', () => {
        assert.equal(mmu.getNbOfROMBanks(), 4, 'Blargg test rom has 4 banks');
      });

      it('should get selected bank number', () => {
        assert.equal(mmu.getSelectedROMBankNb(), 1, 'default is bank 1');
      });
    });

    describe('Storage', () => {
      it('should not write any storage if there is no external RAM', () => {
        const rom = new Uint8Array(0x8000); // 32 KB
        rom[mmu.ADDR_CARTRIDGE_TYPE] = 0; // ROM ONLY
        rom[mmu.ADDR_TITLE_START] = 0x41; // 'A'
        const storage = new StorageMock();
        storage.write = (gameTitle, memory) => { throw new Error('Called!'); };
        mmu = new MMU(rom, storage);

        assert.equal(storage.read('A'), undefined);

        mmu.flushExtRamToStorage();

        assert.equal(storage.read('A'), undefined);
      });

      it('should sanity check the saved RAM in storage', () => {
        let localStorageMock = {
          table: {},
          getItem: function(key) {
            return this.table[key];
          },
          setItem: function(key, value) {
            this.table[key] = value;
          }
        };
        const brokenStorage = new BrowserStorage(localStorageMock);
        brokenStorage.write(GAME_NAME, 0);
        mmu._storage = brokenStorage;

        assert.equal(mmu.getSavedRAM(), null);

        brokenStorage.write(GAME_NAME, undefined);

        assert.equal(mmu.getSavedRAM(), null);

        brokenStorage.write(GAME_NAME, 'abc');

        assert.equal(mmu.getSavedRAM(), null);

        brokenStorage.write(GAME_NAME, '1,2,3');

        assert.equal(mmu.getSavedRAM(), null, 'not long enough');
      });
    })
  });

  describe('Operating speed (CGB only)', () => {
    it('should detect unsupported speed in DMG', () => {
      assert.equal(mmu.readByteAt(mmu.ADDR_KEY1), 0xff);
    })
  });

  describe('CGB LCD banking', () => {
    it('should read/write VBK register', () => {
      assert.equal(mmu.readByteAt(mmu.ADDR_VBK), 0xfe, 'default, bit 1-7 always set');

      mmu.writeByteAt(mmu.ADDR_VBK, 0xff);
      assert.equal(mmu.readByteAt(mmu.ADDR_VBK), 0xff);

      mmu.writeByteAt(mmu.ADDR_VBK, 0);
      assert.equal(mmu.readByteAt(mmu.ADDR_VBK), 0xfe, 'bit 1-7 always set');
    });

    it('should switch LCD banks', () => {
      mmu.writeByteAt(mmu.ADDR_VRAM_START, 0xab);
      assert.equal(mmu.readByteAt(mmu.ADDR_VRAM_START), 0xab);

      mmu.writeByteAt(mmu.ADDR_VBK, 1);
      mmu.writeByteAt(mmu.ADDR_VRAM_START, 0xcd);
      assert.equal(mmu.readByteAt(mmu.ADDR_VRAM_START), 0xcd);

      mmu.writeByteAt(mmu.ADDR_VBK, 0);
      assert.equal(mmu.readByteAt(mmu.ADDR_VRAM_START), 0xab, 'value was saved');

      mmu.writeByteAt(mmu.ADDR_VBK, 1);
      assert.equal(mmu.readByteAt(mmu.ADDR_VRAM_START), 0xcd, 'value was saved');
    });

  });

  describe('CGB WRAM banking', () => {
    it('should read/write in the SVBK register', () => {
      assert.equal(mmu.readByteAt(mmu.ADDR_SVBK), 0xf8, 'default, bit 3-7 always set');

      mmu.writeByteAt(mmu.ADDR_SVBK, 0xff);
      assert.equal(mmu.readByteAt(mmu.ADDR_SVBK), 0xff);

      mmu.writeByteAt(mmu.ADDR_SVBK, 0);
      assert.equal(mmu.readByteAt(mmu.ADDR_SVBK), 0xf8, 'bit 3-7 always set');
    });

    it('should switch WRAM banks', () => {
      mmu.writeByteAt(mmu.ADDR_WRAM_START, 0xab);
      assert.equal(mmu.readByteAt(mmu.ADDR_WRAM_START), 0xab, 'bank 0');

      mmu.writeByteAt(mmu.ADDR_SVBK, 1);
      mmu.writeByteAt(mmu.ADDR_WRAM_CGB_UPPER_BANK_START, 1);
      assert.equal(mmu.readByteAt(mmu.ADDR_WRAM_CGB_UPPER_BANK_START), 1, 'bank 1');

      mmu.writeByteAt(mmu.ADDR_SVBK, 0);
      assert.equal(mmu.readByteAt(mmu.ADDR_WRAM_CGB_UPPER_BANK_START), 1, 'still bank 1');
      mmu.writeByteAt(mmu.ADDR_WRAM_CGB_UPPER_BANK_START, 0xf);
      assert.equal(mmu.readByteAt(mmu.ADDR_WRAM_CGB_UPPER_BANK_START), 0xf);

      mmu.writeByteAt(mmu.ADDR_SVBK, 2);
      mmu.writeByteAt(mmu.ADDR_WRAM_CGB_UPPER_BANK_START, 2);
      assert.equal(mmu.readByteAt(mmu.ADDR_WRAM_CGB_UPPER_BANK_START), 2, 'bank 2');

      mmu.writeByteAt(mmu.ADDR_SVBK, 7);
      mmu.writeByteAt(mmu.ADDR_WRAM_CGB_UPPER_BANK_START, 7);
      assert.equal(mmu.readByteAt(mmu.ADDR_WRAM_CGB_UPPER_BANK_START), 7, 'bank 7');

      mmu.writeByteAt(mmu.ADDR_SVBK, 8); // 3 lower bits are zero, hence 0, hence bank 1
      assert.equal(mmu.readByteAt(mmu.ADDR_WRAM_CGB_UPPER_BANK_START), 0xf, 'bank 1');

      mmu.writeByteAt(mmu.ADDR_WRAM_CGB_UPPER_BANK_START, 0xcd);
      assert.equal(mmu.readByteAt(mmu.ADDR_WRAM_CGB_UPPER_BANK_START), 0xcd);

      mmu.writeByteAt(mmu.ADDR_SVBK, 2);
      assert.equal(mmu.readByteAt(mmu.ADDR_WRAM_CGB_UPPER_BANK_START), 2, 'value was saved');

      mmu.writeByteAt(mmu.ADDR_SVBK, 7);
      assert.equal(mmu.readByteAt(mmu.ADDR_WRAM_CGB_UPPER_BANK_START), 7, 'value was saved');
    });

  });

  describe('CGB Palettes', () => {
    it('should read/write background palettes', () => {
      assert.deepEqual(mmu.getBgPalette(0), [[0x1f,0x1f,0x1f], [0x1f,0x1f,0x1f], [0x1f,0x1f,0x1f], [0x1f,0x1f,0x1f]], 'default');

      mmu.writeByteAt(mmu.ADDR_BCPS, 0b10000000); // auto=y, palette 0, palette data 0, L
      mmu.writeByteAt(mmu.ADDR_BCPD, 0x00);

      for(let i = 0; i < mmu.PALETTES_SIZE; i++){
        mmu.writeByteAt(mmu.ADDR_BCPD, 0x00);
      }

      assert.deepEqual(mmu.getBgPalette(0), [[0,0,0], [0,0,0], [0,0,0], [0,0,0]]);

      // last palette, first data, pure red
      mmu.writeByteAt(mmu.ADDR_BCPS, 0b00111000);
      mmu.writeByteAt(mmu.ADDR_BCPD, 0x1f);
      mmu.writeByteAt(mmu.ADDR_BCPS, 0b00111001);
      mmu.writeByteAt(mmu.ADDR_BCPD, 0);

      // last palette, first data, pure green
      mmu.writeByteAt(mmu.ADDR_BCPS, 0b00111010);
      mmu.writeByteAt(mmu.ADDR_BCPD, 0xe0);
      mmu.writeByteAt(mmu.ADDR_BCPS, 0b00111011);
      mmu.writeByteAt(mmu.ADDR_BCPD, 0x03);

      // last palette, first data, pure blue
      mmu.writeByteAt(mmu.ADDR_BCPS, 0b00111100);
      mmu.writeByteAt(mmu.ADDR_BCPD, 0);
      mmu.writeByteAt(mmu.ADDR_BCPS, 0b00111101);
      mmu.writeByteAt(mmu.ADDR_BCPD, 0x7c);

      // last palette, first data, pure black
      mmu.writeByteAt(mmu.ADDR_BCPS, 0b00111110);
      mmu.writeByteAt(mmu.ADDR_BCPD, 0);
      mmu.writeByteAt(mmu.ADDR_BCPS, 0b00111111);
      mmu.writeByteAt(mmu.ADDR_BCPD, 0);

      assert.deepEqual(mmu.getBgPalette(7), [[0x1f,0,0], [0,0x1f,0], [0,0,0x1f], [0,0,0]]);
    });

    it('should read/write object palettes', () => {
      assert.deepEqual(mmu.getObjPalette(0), [[0,0,0], [0,0,0], [0,0,0], [0,0,0]], 'default');

      mmu.writeByteAt(mmu.ADDR_OCPS, 0b10000000); // auto=y, palette 0, palette data 0, L
      mmu.writeByteAt(mmu.ADDR_OCPD, 0x00);

      for(let i = 0; i < mmu.PALETTES_SIZE; i++){
        mmu.writeByteAt(mmu.ADDR_OCPD, 0xff);
      }

      assert.deepEqual(mmu.getObjPalette(0), [[0x1f,0x1f,0x1f], [0x1f,0x1f,0x1f], [0x1f,0x1f,0x1f], [0x1f,0x1f,0x1f]]);

      // last palette, first data, pure red
      mmu.writeByteAt(mmu.ADDR_OCPS, 0b00111000);
      mmu.writeByteAt(mmu.ADDR_OCPD, 0x1f);
      mmu.writeByteAt(mmu.ADDR_OCPS, 0b00111001);
      mmu.writeByteAt(mmu.ADDR_OCPD, 0);

      // last palette, first data, pure green
      mmu.writeByteAt(mmu.ADDR_OCPS, 0b00111010);
      mmu.writeByteAt(mmu.ADDR_OCPD, 0xe0);
      mmu.writeByteAt(mmu.ADDR_OCPS, 0b00111011);
      mmu.writeByteAt(mmu.ADDR_OCPD, 0x03);

      // last palette, first data, pure blue
      mmu.writeByteAt(mmu.ADDR_OCPS, 0b00111100);
      mmu.writeByteAt(mmu.ADDR_OCPD, 0);
      mmu.writeByteAt(mmu.ADDR_OCPS, 0b00111101);
      mmu.writeByteAt(mmu.ADDR_OCPD, 0x7c);

      // last palette, first data, pure black
      mmu.writeByteAt(mmu.ADDR_OCPS, 0b00111110);
      mmu.writeByteAt(mmu.ADDR_OCPD, 0);
      mmu.writeByteAt(mmu.ADDR_OCPS, 0b00111111);
      mmu.writeByteAt(mmu.ADDR_OCPD, 0);

      assert.deepEqual(mmu.getObjPalette(7), [[0x1f,0,0], [0,0x1f,0], [0,0,0x1f], [0,0,0]]);
    });

    it('should read color palette for a given background tile', () => {
      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() & mmu.MASK_BG_CODE_AREA_1);
      mmu.writeByteAt(0x9800, 0xab); // bank 0
      mmu.writeByteAt(0x9bff, 0xcd); // bank 0

      assert.equal(mmu.getBgCharCode(0, 0), 0xab, 'Block 0');
      assert.equal(mmu.getBgCharCode(31, 31), 0xcd, 'Block 1023');

      mmu.writeByteAt(mmu.ADDR_VBK, 1);
      mmu.writeByteAt(0x9800, 0x01/*palette 1*/); // bank 1
      mmu.writeByteAt(0x9bff, 0x02/*palette 2*/); // bank 1

      assert.equal(mmu.getBgPaletteNb(0, 0), 1);
      assert.equal(mmu.getBgPaletteNb(31, 31), 2);

      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() | mmu.MASK_BG_CODE_AREA_2);

      assert.equal(mmu.getBgPaletteNb(0, 0), 0); // no palette was set, default: 0
      assert.equal(mmu.getBgPaletteNb(31, 31), 0);
    });

  });

});