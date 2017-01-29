import CPU from '../src/cpu';
import MMU from '../src/mmu';
import Loader from '../src/loader';
import assert from 'assert';
import config from '../src/config';
import Utils from '../src/utils';
import lcdMock from './mock/lcdMock';
import StorageMock from './mock/storageMock';
import {describe, beforeEach, it} from 'mocha';

describe('Interruptions', () => {

  config.DEBUG = false;
  config.TEST = true;

  beforeEach(function() {
    const loader = new Loader('./roms/blargg/cpu_instrs/cpu_instrs.gb');
    this.cpu = new CPU(new MMU(loader.asUint8Array(), new StorageMock()), new lcdMock());
    /**
     * @param {number} pc
     */
    this.cpu.setPC = function(pc){
      this.mmu.setRunningBIOS(false);
      this._r.pc = pc;
    };
    /**
     * @param {number} If
     */
    this.cpu.setIf = function(If){
      this._setIf(If);
    };
    /**
     * NOP
     */
    this.cpu.nop = function(){
      this._m++;
    };

    /**
     * @param {number} opcode
     * @param {number|undefined} param1 (optional)
     * @param {number|undefined} param2 (optional)
     */
    this.cpu.mockInstruction = function(opcode, param1=undefined, param2=undefined){
      if (opcode !== undefined) this.mmu.writeByteAt(this.pc(), opcode);
      if (param1 !== undefined) this.mmu.writeByteAt(this.pc()+1, param1);
      if (param2 !== undefined) this.mmu.writeByteAt(this.pc()+2, param2);
    };
  });

  describe('Interruptions', () => {

    it('should read/write the interrupt enable register', function() {
      this.cpu.setIe(0x01);
      assert.equal(this.cpu.ie(), 0x01);
    });

    it('should read/write the interrupt request register', function() {
      this.cpu.setIf(0x01);
      assert.equal(this.cpu.If(), 0x01);
    });
  });

  describe('LCD modes', () => {

    it('should start on LCD mode 0', function() {
      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_LCDC, 0b10000000); // LCD on
      assert.equal(this.cpu.mmu.getLCDMode(), 0, 'Mode 0');
    });

  });

  describe('HALT', () => {

    it('should stop executing instructions on HALT mode', function() {

      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_LCDC, 0b10000000); // LCD on
      this.cpu.execute = () => fail();
      this.cpu.halt();

      this.cpu.frame();

      assert(!this.cpu.isHalted(), 'VBL interrupt stops HALT mode');
    });

  });

  describe('STAT interrupt', () => {

    it('should STAT interrupt LYC=LY', function() {

      let called = 0;

      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_LYC, 2);
      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_LCDC, 0b10000000); // LCD on
      this.cpu.mmu.setLy(0);
      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_STAT, 0b01000000); // LYC=LY interrupt on 
      this.cpu.setIe(0b00000011); // Allow STAT, VBL interrupt
      this.cpu.execute = () => this.cpu.nop();
      this.cpu._handleLYCInterrupt = () => {
        this.cpu.setIf(this.cpu.If() & this.cpu.mmu.IF_STAT_OFF);
        called++;
      };

      this.cpu.ei();
      this.cpu.frame();

      assert.equal(called, 1);
    });

  });

  describe('Vertical Blank Interrupt', () => {

    it('should not scan lines with lcd off', function() {

      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_LCDC, 0b00000000); // LCD off
      assert.equal(this.cpu.ly(), 0x00, 'LY reset');

      for (let i = 0; i < this.cpu.M_CYCLES_PER_LINE * this.cpu.mmu.NUM_LINES; i++) {
        this.cpu.nop();
      }

      assert.equal(this.cpu.ly(), 0x00, 'LY remains reset');
    });

    it('should scan lines with lcd on', function() {

      let ly = 0x00;
      assert.equal(this.cpu.ly(), ly, 'LY reset');

      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_LCDC, 0b10000000); // LCD on

      this.cpu.execute = () => this.cpu.nop();
      this.cpu.frame();

      assert.equal(this.cpu.ly(), 144, `LY increased to 144`);
      assert.equal(this.cpu.m(), 144*114, 'Machine cycles in 144 scanlines');
    });

    it('should restart scan line when lcd is turned off', function() {

      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_LCDC, 0b10000000); // LCD on
      this.cpu.mmu.setLy(0x05);

      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_LCDC, 0b00000000); // LCD off
      assert.equal(this.cpu.ly(), 0x00, 'LY reset');
    });
  
    it('should handle vertical blanking interrupt', function() {

        this.cpu.setPC(0xc000);
        this.cpu.setIf(0b00001);
        this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_IE, 0x01); // Allow vblank
        assert.equal(this.cpu.ie() & 0x01, 1, 'Vblank allowed');

        this.cpu.mockInstruction(0xfb/* ei */);
        this.cpu.start();
        assert.equal(this.cpu.If() & this.cpu.IF_VBLANK_ON, 1, 'Interrupt Request is turned on');

        const pc = this.cpu.pc();
        assert.equal(this.cpu.pc(), 0xc001);

        this.cpu.mockInstruction(0xc3/* jp */,0x37,0x06);

        assert.equal(this.cpu.ime(), 1, 'IME enabled');
        assert.equal(this.cpu.If(), 0b00001, 'Vblank requested');

        this.cpu.start();

        assert.equal(this.cpu.ime(), 0, 'IME disabled');
        assert.equal(this.cpu.If() & this.cpu.IF_VBLANK_OFF, 0, 'Interrupt Request is turned off');
        assert.equal(this.cpu.peek_stack(1), 0x06, 'high pc on stack');
        assert.equal(this.cpu.peek_stack(), 0x37, 'low pc on stack');
        assert.equal(this.cpu.pc(), this.cpu.ADDR_VBLANK_INTERRUPT);

        this.cpu.runUntil(this.cpu.ADDR_VBLANK_INTERRUPT + 1);

        assert.equal(this.cpu.pc(), this.cpu.ADDR_VBLANK_INTERRUPT + 1, 'PC advances in vblank routine');
        assert.equal(this.cpu.If(), 0x00, 'Vblank dispatched');
    });
  });

  describe('Timer overflow interrupt', () => {

    it('should request interrupt when timer overflows', function() {
      this.cpu.setPC(0x150);
      this.cpu.execute = () => { this.cpu._m++; };
      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_TAC, 1); // chose 262,144 Khz (overflow in ~1ms)
      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_TIMA, 0);
      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_TAC, 0x05); // start timer

      assert.equal(this.cpu.If(), 0x00, 'interrupt not requested');

      for(let m = 0; m < 0x100*4; m++) {
        this.cpu._cpuCycle();
      }

      assert.equal(this.cpu.If(), 0x04, 'timer overflow interrupt requested');
    });

    it('should jump to timer overflow routine', function() {
      this.cpu.setPC(0x150);
      this.cpu._r.sp = 0xfffe;
      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_IE, 0b00000100);
      this.cpu.mockInstruction(0xfb/* ei */);
      this.cpu.execute();

      assert.equal(this.cpu.ie(), 0x04, 'Timer overflow interrup is allowed');
      this.cpu.setIf(0b00000101); // Trigger timer overflow + vblank to stop the frame

      this.cpu.runUntil(this.cpu.ADDR_TIMER_INTERRUPT + 1); // stop when the first instruction in the routine is executed

      assert.equal(this.cpu.pc(), this.cpu.ADDR_TIMER_INTERRUPT + 1, 'PC is in Timer overflow routine');
    });

  });
});

function fail(){
  assert(false);
}