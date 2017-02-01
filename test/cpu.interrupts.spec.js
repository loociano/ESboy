import CPU from '../src/cpu';
import MMU from '../src/mmu';
import Loader from '../src/loader';
import assert from 'assert';
import config from '../src/config';
import LCDMock from './mock/lcdMock';
import StorageMock from './mock/storageMock';
import {describe, beforeEach, it} from 'mocha';

describe('Interruptions', () => {

  config.DEBUG = false;
  config.TEST = true;

  beforeEach(function() {
    this.rom32KB = new Uint8Array(0x8000);
    this.cpu = new CPU(new MMU(this.rom32KB, new StorageMock()), new LCDMock());
    /**
     * @param {number} pc
     */
    this.cpu.setPC = function(pc){
      this.mmu.setRunningBIOS(false);
      this._r.pc = pc;
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

    it('should exit halt', function() {
      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_LCDC, 0b10000000); // LCD on
      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_STAT, 0b01000000); // LYC=LY interrupt on
      this.cpu.setIe(0b00000010); // Allow STAT interrupt
      this.cpu.setPC(0xc000);
      this.cpu.mockInstruction(0x76/* halt */);

      this.cpu.runUntil(0x48/* stat interrupt addr */);

      assert.equal(this.cpu.isHalted(), false);
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
      this.cpu.mmu.setRunningBIOS(false);
      this.cpu._r.pc = 0xc000;
      this.cpu.setIf(0b00001); // Request vblank
      this.cpu.setIe(0b00001); // Allow vblank
      this.cpu._r.ime = 0;
      this.cpu.mockInstruction(0xfb/* ei */);

      this.cpu.runCycles(1); // should NOT vblank interrupt, last instruction was EI

      assert.equal(this.cpu.pc(), 0xc001);
      assert.equal(this.cpu.If(), 1);
      assert.equal(this.cpu.ie(), 1);
      assert.equal(this.cpu.ime(), 1);

      this.cpu.mockInstruction(0xc3/* jp */,0x37,0x06);

      this.cpu.frame();

      assert.equal(this.cpu.pc(), 0x40 /* vbl */);
      assert.equal(this.cpu.ime(), 0, 'IME disabled');
      assert.equal(this.cpu.If(), 0);
      assert.equal(this.cpu.ie(), 1);
      assert.equal(this.cpu.peek_stack(1), 0x06, 'high pc on stack');
      assert.equal(this.cpu.peek_stack(), 0x37, 'low pc on stack');

      this.cpu.runCycles(1);

      assert.equal(this.cpu.pc(), 0x41, 'PC advances in vblank routine');

      this.cpu.mmu._rom[0x41] = 0xd9; /* reti */

      this.cpu.runCycles(1); // reti

      assert.equal(this.cpu.pc(), 0x0637);
      assert.equal(this.cpu.ime(), 1);
      assert.equal(this.cpu.If(), 0);
      assert.equal(this.cpu.ie(), 1);
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
        this.cpu.cpuCycle();
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

    it('should exit halt on timer interrupt', function() {
      let called = 0;
      this.cpu.setPC(0x150);
      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_IE, 0b00000100);
      this.cpu.execute = () => called++;
      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_TAC, 1); // chose 262,144 Khz (overflow in ~1ms)
      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_TIMA, 0);
      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_TAC, 0x05); // start timer

      assert.equal(this.cpu.pc(), 0x150);

      this.cpu.halt();

      for(let m = 0; m < 0x100*4; m++) {
        this.cpu.cpuCycle(); // cause time overflow
      }
      this.cpu.cpuCycle(); // cpu exits halts and enters the timer routine
      this.cpu.cpuCycle(); // execute opcode

      assert.equal(called, 1, 'called when timer exits halt');
    });

  });

  describe('Interrupt priority VBL > LCD > TIM', () => {
    it('should handle interrupts with priority', function() {
      const rom32KB = new Uint8Array(0x8000);
      rom32KB[0x40/* vbl */] = 0; /* nop */
      rom32KB[0x41/* vbl */] = 0xd9; /* reti */
      rom32KB[0x48/* stat */] = 0;
      rom32KB[0x49/* stat */] = 0xd9;
      rom32KB[0x50/* timer */] = 0;
      rom32KB[0x51/* timer */] = 0xd9;

      const mmu = new MMU(rom32KB);
      mmu.setRunningBIOS(false);

      this.cpu = new CPU(mmu, new LCDMock());

      this.cpu.setIe(0b00000111); // VBL + LCD + TIMER
      this.cpu._r.pc = 0x150;
      this.cpu.setIf(0b00000111);

      this.cpu.frame(); // execute until VBL is handled

      assert.equal(this.cpu.pc(), 0x40);
      assert.equal(this.cpu.If(), 0b00000110, 'VBL dispatched');
      assert.equal(this.cpu.ie(), 0b00000111);
      assert.equal(this.cpu.ime(), 0);

      this.cpu.runCycles(1); // inside routine: execute nop

      assert.equal(this.cpu.pc(), 0x41);

      this.cpu.runCycles(1); // inside routine: execute reti

      assert.equal(this.cpu.pc(), 0x150);
      assert.equal(this.cpu.If(), 0b00000110);
      assert.equal(this.cpu.ie(), 0b00000111);
      assert.equal(this.cpu.ime(), 1);

      this.cpu.runCycles(1); // STAT interrupt

      assert.equal(this.cpu.pc(), 0x48);
      assert.equal(this.cpu.If(), 0b00000100, 'LCD dispatched');
      assert.equal(this.cpu.ie(), 0b00000111);
      assert.equal(this.cpu.ime(), 0);

      this.cpu.runCycles(1); // execute nop

      assert.equal(this.cpu.pc(), 0x49);

      this.cpu.runCycles(1); // execute reti

      assert.equal(this.cpu.pc(), 0x150);
      assert.equal(this.cpu.If(), 0b00000100);
      assert.equal(this.cpu.ie(), 0b00000111);
      assert.equal(this.cpu.ime(), 1);

      this.cpu.runCycles(1); // TIMER interrupt

      assert.equal(this.cpu.pc(), 0x50);
      assert.equal(this.cpu.If(), 0b00000000, 'TIM dispatched');
      assert.equal(this.cpu.ie(), 0b00000111);
      assert.equal(this.cpu.ime(), 0);

      this.cpu.runCycles(1); // nop

      assert.equal(this.cpu.pc(), 0x51);

      this.cpu.runCycles(1); // reti

      assert.equal(this.cpu.pc(), 0x150);
      assert.equal(this.cpu.If(), 0b00000000);
      assert.equal(this.cpu.ie(), 0b00000111);
      assert.equal(this.cpu.ime(), 1);
    });
  });
});

function fail(){
  assert(false);
}