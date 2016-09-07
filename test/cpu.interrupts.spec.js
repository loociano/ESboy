import CPU from '../src/cpu';
import MMU from '../src/mmu';
import assert from 'assert';
import config from '../src/config';
import Utils from '../src/utils';
import ipcMock from './mock/ipcMock';

describe('Interruptions', () => {

  config.DEBUG = false;
  config.TEST = true;

  beforeEach(function() {
    this.cpu = new CPU(new MMU('./roms/blargg_cpu_instrs.gb'), new ipcMock());
    this.cpu.setPC = function(pc){
      this.mmu.inBIOS = false;
      this._r.pc = pc; // for testing!
    };
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