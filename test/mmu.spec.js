import MMU from '../src/mmu';
import Loader from '../src/loader';
import assert from 'assert';
import config from '../src/config';
import {describe, beforeEach, it} from 'mocha';
import StorageMock from './mock/storageMock';
import fs from 'fs';

describe('MMU', () => {

  config.DEBUG = false;
  config.TEST = true;

  let mmu;

  beforeEach( () => {
    const loader = new Loader('./roms/blargg_cpu_instrs.gb');
    mmu = new MMU(loader.asUint8Array(), new StorageMock());
    mmu.assertTileLineDrawn = function(posX, posY, expected){
      for(let i = 0; i < 8; i++){
        assert.equal(mmu.isTileLineDrawn(mmu.getTileLinePos(posX, posY) + i*20), expected);
      }
    };
    mmu.setTileDrawn = function(posX, posY){
      for(let i = 0; i < 8; i++){
        mmu.setTileLineDrawn(mmu.getTileLinePos(posX, posY) + i*20);
      }
    };
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
      assert.equal(mmu.getGameTitle(), 'CPU_INSTRS', 'should read title');
      assert.equal(mmu.isGameInColor(), true, 'is gb color');
      assert.equal(mmu.isGameSuperGB(), false, 'should not be super GB');
      assert.equal(mmu.getCartridgeType(), 'ROM+MBC1');
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

  describe('Bank Registers (CGB only)', () => {
    it('should detect bank register', () => {
      assert.throws(() => mmu.readByteAt(mmu.ADDR_SVBK), Error, 'SVBK register unsupported');
    });

    it('should not write VBK in DMG mode', () => {
      assert.equal(mmu.vbk(), 0, 'VBK always zero in DMG');
      mmu.writeByteAt(mmu.ADDR_VBK, 0xab);
      assert.equal(mmu.vbk(), 0, 'VBK always zero in DMG');
    });
  });

  describe('Timers', () => {
    it('should detect timers', () => {
      assert.throws( () => mmu.readByteAt(mmu.ADDR_TIMA), Error, 'TIMA register unsupported');
      assert.throws( () => mmu.readByteAt(mmu.ADDR_TMA), Error, 'TMA register unsupported');
      assert.throws( () => mmu.readByteAt(mmu.ADDR_TAC), Error, 'TAC register unsupported');
    });
  });

  describe('Dividers', () => {
    it('should detect dividers', () => {
      assert.equal(mmu.readByteAt(mmu.ADDR_DIV), 0x00);
    });

    it('should set DIV with the msb', () => {
      mmu.set_HW_DIV(0x0000);
      assert.equal(mmu.readByteAt(mmu.ADDR_DIV), 0x00);

      mmu.set_HW_DIV(0xff00);
      assert.equal(mmu.readByteAt(mmu.ADDR_DIV), 0xff);

      mmu.set_HW_DIV(0x0100);
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

  describe('Memory dumps', () => {

    it('should dump a memory snapshot', () => {
      const filename = mmu.dumpMemoryToFile(); // TODO: mock fs in tests
      assert.doesNotThrow( () => {
          fs.accessSync(filename);
      });
      fs.unlinkSync(filename);

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
  });

});