import CPU from '../src/cpu';
import MMU from '../src/mmu';
import Loader from '../src/loader';
import assert from 'assert';
import config from '../src/config';
import Utils from '../src/utils';
import ipcMock from './mock/ipcMock';
import {describe, beforeEach, it} from 'mocha';

describe('Interruptions', () => {

  config.DEBUG = false;
  config.TEST = true;

  beforeEach(function() {
    const loader = new Loader('./roms/blargg_cpu_instrs.gb');
    this.cpu = new CPU(new MMU(loader.asUint8Array()), new ipcMock());

    this.cpu.setPC = function(pc){
      this.mmu.inBIOS = false;
      this._r.pc = pc; // for testing!
    };
  });

  describe('LCD modes', () => {

    it('should start on LCD mode 0', function() {
      this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_LCDC, 0b10000000); // LCD on
      assert.equal(this.cpu.mmu.getLCDMode(), 0, 'Mode 0');
    });

  });

  describe('VBL Interrupt', () => {

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

        this.cpu.setPC(0x100); // NOP
        this.cpu.setIf(0b00001);
        this.cpu._t = 0xff;
        this.cpu.ei();
        this.cpu.mmu.writeByteAt(this.cpu.mmu.ADDR_IE, 0x01); // Allow vblank
        assert.equal(this.cpu.ie() & 0x01, 1, 'Vblank allowed');

        const pc = this.cpu.pc();
        assert.equal(this.cpu.pc(), 0x100);

        const returnPC = 0x0637; // must execute pc+1 (JP 0x0637), next pc is 0x0637
        const sp = this.cpu.sp();

        assert.equal(this.cpu.ime(), 1, 'IME enabled');
        assert.equal(this.cpu.If(), 0b00001, 'Vblank requested');

        this.cpu.start();

        assert.equal(this.cpu.ime(), 0, 'IME disabled');
        assert.equal(this.cpu.peek_stack(1), Utils.msb(returnPC), 'high pc on stack');
        assert.equal(this.cpu.peek_stack(), Utils.lsb(returnPC), 'low pc on stack');
        assert.equal(this.cpu.pc(), this.cpu.ADDR_VBLANK_INTERRUPT);

        this.cpu.runUntil(this.cpu.ADDR_VBLANK_INTERRUPT + 1);

        assert.equal(this.cpu.pc(), this.cpu.ADDR_VBLANK_INTERRUPT + 1, 'PC advances in vblank routine');
        assert.equal(this.cpu.If(), 0x00, 'Vblank dispatched');
    });
  });
});