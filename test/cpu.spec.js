import CPU from '../src/cpu';
import assert from 'assert';
import config from '../src/config';
import {describe, beforeEach, it} from 'mocha';
import Utils from '../src/utils';
import ContextMock from './mock/contextMock';

describe('CPU Unit tests', function() {

  config.DEBUG = true;
  config.TEST = true;
  let cpu;

  beforeEach(function() {
    cpu = new CPU('./roms/blargg_cpu_instrs.gb', new ContextMock());
  });

  describe('ROM file loading', () => {
    it('should handle missing ROM filename', () => {

      assert.throws(() => {
        let cpu = new CPU();
      }, Error);
    });

    it('should handle missing ROM file', () => {
      assert.throws(() => {
        let cpu = new CPU('./roms/nope.gb');
      }, Error);
    });
  });

  it('should understand prefix cb instructions', () => {
    const start = 0xc000; // internal RAM
    cpu.mmu.writeByteAt(start, 0xcb);
    cpu.mmu.writeByteAt(start+1, 0x7c);
    cpu.jp(start);
    cpu.execute();
    assert.equal(cpu.pc(), start+2);
  });

  describe('Flags setters and getters', () => {

    it('should set Flag Z', () => {
      testSetGetFlag(cpu, cpu.setZ, cpu.Z);
    });

    it('should set Flag N', () => {
      testSetGetFlag(cpu, cpu.setN, cpu.N);
    });

    it('should set Flag h', () => {
      testSetGetFlag(cpu, cpu.setH, cpu.H);
    });

    it('should set Flag c', () => {
      testSetGetFlag(cpu, cpu.setC, cpu.C);
    });

  });

  describe('Jumps', () => {
    it('should jump to address', () => {
      cpu.jp(0x123);
      assert.equal(cpu.pc(), 0x123);
    });

    it('should jump to signed offset', () => {
      let pc = cpu.pc(); // 0
      let offset = Utils.uint8ToInt8(0x05);

      assert.throws( () => {
        cpu.jp_n(0xff); // -1
      }, Error, 'cannot jump outside memory space');

      cpu.jp_n(0x05);

      assert.equal(cpu.pc(), pc + offset, `jump forward ${offset}`);

      pc = cpu.pc();
      offset = Utils.uint8ToInt8(0xff);

      cpu.jp_n(0xff);

      assert.equal(cpu.pc(), pc + offset, `jump backward ${offset}`);

    });

    describe('Jump NZ', () => {
      it('should jump forward if Z is reset', () => {
        cpu.setZ(0);
        const pc = cpu.pc();

        cpu.jr_nz_n(0x05);

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0x05), 'jump forward');
      });

      it('should jump backwards if Z is reset', () => {
        cpu.setZ(0);
        const pc = cpu.pc();

        cpu.jr_nz_n(0xfc);

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0xfc), 'jump backward');
      });

      it('should not jump if Z is set', () => {
        cpu.setZ(1);
        const pc = cpu.pc();

        cpu.jr_nz_n(0xfc);

        assert.equal(cpu.pc(), pc, 'do not jump, move to the next instruction');
      });
    });

    describe('Jump Z', () => {
      it('should jump forward if Z is set', () => {
        cpu.setZ(1);
        const pc = cpu.pc();

        cpu.jr_z_n(0x05);

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0x05), 'jump forward');
      });

      it('should jump backwards if Z is set', () => {
        cpu.setZ(1);
        const pc = cpu.pc();

        cpu.jr_z_n(0xfc);

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0xfc), 'jump backward');
      });

      it('should not jump if Z is reset', () => {
        cpu.setZ(0);
        const pc = cpu.pc();

        cpu.jr_z_n(0xfc);

        assert.equal(cpu.pc(), pc, 'do not jump, move to the next instruction');
      });
    });

    describe('Jump NC', () => {
      it('should jump forward if C is reset', () => {
        cpu.setC(0);
        const pc = cpu.pc();

        cpu.jr_nc_n(0x05);

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0x05), 'jump forward');
      });

      it('should jump backwards if C is reset', () => {
        cpu.setC(0);
        const pc = cpu.pc();

        cpu.jr_nc_n(0xfc);

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0xfc), 'jump backward');
      });

      it('should not jump if C is set', () => {
        cpu.setC(1);
        const pc = cpu.pc();

        cpu.jr_nc_n(0xfc);

        assert.equal(cpu.pc(), pc, 'do not jump, move to the next instruction');
      });
    });

    describe('Jump C', () => {
      it('should jump forward if C is set', () => {
        cpu.setC(1);
        const pc = cpu.pc();

        cpu.jr_c_n(0x05);

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0x05), 'jump forward');
      });

      it('should jump backwards if C is set', () => {
        cpu.setC(1);
        const pc = cpu.pc();

        cpu.jr_c_n(0xfc);

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0xfc), 'jump backward');
      });

      it('should not jump if C is reset', () => {
        cpu.setC(0);
        const pc = cpu.pc();

        cpu.jr_c_n(0xfc);

        assert.equal(cpu.pc(), pc, 'do not jump, move to the next instruction');
      });
    });

  });

  describe('8 bit arithmetic', () => {

    it('should XOR register a', () => {
      cpu.xor_a();
      assert.equal(cpu.a(), 0x00);
      assert.equal(cpu.f(), 0b1000, 'Z=1, N=0, h=0, c=0');
    });

    it('should XOR register a with n', () => {
      const a = cpu.a();
      cpu.xor_n(a);
      assert.equal(cpu.a(), 0x00, 'register a should be zero.');
      assert.equal(cpu.f(), 0b1000, 'Z=1, N=0, h=0, c=0');
    });

    it('should xor register a with memory address hl', () => {
      const a = cpu.a();
      const hl = cpu.hl();
      const value = cpu.mmu.readByteAt(hl);
      cpu.xor_0xhl();
      assert.equal(cpu.a(), a ^ value, `register a should be ${Utils.hexStr(a)} xor ${Utils.hexStr(value)}`);
    });

    it('should decrement 8 bits register', () => {
      assertDecrementRegister(cpu, cpu.a, cpu.dec_a);
      assertDecrementRegister(cpu, cpu.b, cpu.dec_b);
      assertDecrementRegister(cpu, cpu.c, cpu.dec_c);
      assertDecrementRegister(cpu, cpu.d, cpu.dec_d);
      assertDecrementRegister(cpu, cpu.e, cpu.dec_e);
      assertDecrementRegister(cpu, cpu.h, cpu.dec_h);
      assertDecrementRegister(cpu, cpu.l, cpu.dec_l);
    });

    it('should set flags on decrement', () => {
      cpu.ld_b_n(0xff);
      cpu.dec_b();
      assert.equal(cpu.b(), 0xfe);
      assert.equal(cpu.Z(), 0, 'Not result zero');
      assert.equal(cpu.N(), 1, 'Substracting');
      assert.equal(cpu.H(), 0, 'Not half carry');
    });

    it('should set half carry on decrement', () => {
      cpu.ld_b_n(0xf0);
      cpu.dec_b();
      assert.equal(cpu.b(), 0xef);
      assert.equal(cpu.Z(), 0, 'Not result zero');
      assert.equal(cpu.N(), 1, 'Substracting');
      assert.equal(cpu.H(), 1, 'Half carry');
    });

    it('should loop value on decrement', () => {
      cpu.ld_a_n(0x00);
      cpu.dec_a();
      assert.equal(cpu.a(), 0xff, 'loop value');
      assert.equal(cpu.Z(), 0, 'Not result zero');
      assert.equal(cpu.N(), 1, 'Substracting');
      assert.equal(cpu.H(), 1, 'Half carry');
    });

    // TODO decrement with 0x01 to assert flag Z

    it('should decrement a value at a memory location', () => {
      const value = 0xab;
      cpu.mmu.writeByteAt(0xdfff, value);
      cpu.ld_hl_nn(0xdfff);
      cpu.dec_0xhl();
      assert.equal(cpu.mmu.readByteAt(0xdfff), value - 1, 'Value at memory 0xdfff is decremented');
      // TODO check flags
    });

    it('should compare register a with itself', () => {
      cpu.ld_a_n(0xab);
      cpu.cp_a();
      assertFlagsCompareEqualValue(cpu);
    });

    it('it should compare registers with register a', () => {

      [ {ld: cpu.ld_b_n, cp: cpu.cp_b},
        {ld: cpu.ld_c_n, cp: cpu.cp_c},
        {ld: cpu.ld_d_n, cp: cpu.cp_d},
        {ld: cpu.ld_e_n, cp: cpu.cp_e},
        {ld: cpu.ld_h_n, cp: cpu.cp_h},
        {ld: cpu.ld_l_n, cp: cpu.cp_l} ].map( ({ld, cp}) => {

        cpu.ld_a_n(0xab);

        // Same value
        ld.call(cpu, 0xab);
        cp.call(cpu);
        assertFlagsCompareEqualValue(cpu);

        // Lower value
        ld.call(cpu, 0x01);
        cp.call(cpu);
        assertFlagsCompareLowerValue(cpu);

        // Greater value
        ld.call(cpu, 0xff);
        cp.call(cpu);
        assertFlagsCompareGreaterValue(cpu);

      });
    });

    it('should compare register a with value at memory address hl', () => {

      cpu.ld_a_n(0xab);
      cpu.ld_hl_nn(0xfffe);

      // Lower value
      cpu.mmu.writeByteAt(cpu.hl(), 0x01);
      cpu.cp_0xhl();
      assertFlagsCompareLowerValue(cpu);

      // Equal value
      cpu.mmu.writeByteAt(cpu.hl(), 0xab);
      cpu.cp_0xhl();
      assertFlagsCompareEqualValue(cpu);

      // Greater value
      cpu.mmu.writeByteAt(cpu.hl(), 0xff);
      cpu.cp_0xhl();
      assertFlagsCompareGreaterValue(cpu);
    });

    it('should compare register a with lower value n', () => {
      const n = 0x01;
      cpu.ld_a_n(0xab);
      cpu.cp_n(n);
      assertFlagsCompareLowerValue(cpu);
    });

    it('should compare register a with equal value n', () => {
      const n = 0xab;
      cpu.ld_a_n(0xab);
      cpu.cp_n(n);
      assertFlagsCompareEqualValue(cpu);
    });

    it('should compare register a with greater value n', () => {
      const n = 0xff;
      cpu.ld_a_n(0xab);
      cpu.cp_n(n);
      assertFlagsCompareGreaterValue(cpu);
    });

    it('should increment register by 1', () => {

      [ {r: cpu.a, ld: cpu.ld_a_n, inc: cpu.inc_a},
        {r: cpu.b, ld: cpu.ld_b_n, inc: cpu.inc_b},
        {r: cpu.c, ld: cpu.ld_c_n, inc: cpu.inc_c},
        {r: cpu.d, ld: cpu.ld_d_n, inc: cpu.inc_d},
        {r: cpu.e, ld: cpu.ld_e_n, inc: cpu.inc_e},
        {r: cpu.h, ld: cpu.ld_h_n, inc: cpu.inc_h},
        {r: cpu.l, ld: cpu.ld_l_n, inc: cpu.inc_l} ].map( ({r, ld, inc}) => {

        ld.call(cpu, 0x00);
        let value = r.call(cpu);
        
        inc.call(cpu);
        
        assert.equal(r.call(cpu), value+1, 'a incremented.');
        assert.equal(cpu.Z(), 0, 'Z set if result is zero');
        assert.equal(cpu.N(), 0, 'N is always reset');
        assert.equal(cpu.H(), 0, 'H reset as no half carry');

        ld.call(cpu, 0x0f);
        value = r.call(cpu);
        
        inc.call(cpu);
        
        assert.equal(r.call(cpu), value+1, 'a incremented.');
        assert.equal(cpu.Z(), 0, 'Z set if result is zero');
        assert.equal(cpu.N(), 0, 'N is always reset');
        assert.equal(cpu.H(), 1, 'H set as half carry');

        ld.call(cpu, 0xff);
        
        inc.call(cpu);
        
        assert.equal(r.call(cpu), 0x00, 'a resets to 0x00.');
        assert.equal(cpu.Z(), 1, 'Z set if result is zero');
        assert.equal(cpu.N(), 0, 'N is always reset');
        assert.equal(cpu.H(), 0, 'H reset as no half carry');

      });
    });

    it('should increment memory value at hl 0x00 by 1', () => {

      const addr = 0xc000;
      cpu.ld_hl_nn(addr);
      let value = 0x00;
      cpu.mmu.writeByteAt(addr, value);

      cpu.inc_0xhl();

      assert.equal(cpu.mmu.readByteAt(cpu.hl()), value+1, 'value at memory (hl) incremented.');
      assert.equal(cpu.Z(), 0, 'Z set if result is zero');
      assert.equal(cpu.N(), 0, 'N is always reset');
      assert.equal(cpu.H(), 0, 'H reset as no half carry');

      value = 0x0f;
      cpu.mmu.writeByteAt(addr, value);

      cpu.inc_0xhl();

      assert.equal(cpu.mmu.readByteAt(cpu.hl()), value+1, 'value at memory (hl) incremented.');
      assert.equal(cpu.Z(), 0, 'Z set if result is zero');
      assert.equal(cpu.N(), 0, 'N is always reset');
      assert.equal(cpu.H(), 1, 'H set as half carry');

      value = 0xff;
      cpu.mmu.writeByteAt(addr, value);

      cpu.inc_0xhl();

      assert.equal(cpu.mmu.readByteAt(cpu.hl()), 0x00, 'value at memory (hl) resets to 0x00.');
      assert.equal(cpu.Z(), 1, 'Z set if result is zero');
      assert.equal(cpu.N(), 0, 'N is always reset');
      assert.equal(cpu.H(), 0, 'H reset as no half carry');

    });

    it('should subtract n from register a', () =>{

      cpu.ld_hl_nn(0xc000);

      // Do SUB (hl) first, as h and l will be overridden later
      [ {ld: cpu.ld_0xhl_n, sub: cpu.sub_0xhl},
        {ld: cpu.ld_b_n, sub: cpu.sub_b},
        {ld: cpu.ld_c_n, sub: cpu.sub_c},
        {ld: cpu.ld_d_n, sub: cpu.sub_d},
        {ld: cpu.ld_e_n, sub: cpu.sub_e},
        {ld: cpu.ld_h_n, sub: cpu.sub_h},
        {ld: cpu.ld_l_n, sub: cpu.sub_l} ].map( ({ld, sub}) => {

        // Result positive
        cpu.ld_a_n(0x12);
        ld.call(cpu, 0x02);

        sub.call(cpu);

        assert.equal(cpu.a(), 0x10, `a subtracted two, ${sub.name}`);
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 1, 'N always set');
        assert.equal(cpu.H(), 0, 'No borrow from bit 4');
        assert.equal(cpu.C(), 0, 'No borrow from carry');

        // Borrow from bit 4
        cpu.ld_a_n(0x10);
        ld.call(cpu, 0x02);
        sub.call(cpu);

        assert.equal(cpu.a(), 0x0e, `a subtracted two with half carry, ${sub.name}`);
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 1, 'N always set');
        assert.equal(cpu.H(), 1, 'Borrow from bit 4');
        assert.equal(cpu.C(), 0, 'No borrow from carry');

        // Result zero
        cpu.ld_a_n(0x0e);
        ld.call(cpu, 0x0e);

        sub.call(cpu);

        assert.equal(cpu.a(), 0x00, `a subtracted 0x0e, ${sub.name}`);
        assert.equal(cpu.Z(), 1, 'Result is zero');
        assert.equal(cpu.N(), 1, 'N always set');
        assert.equal(cpu.H(), 0, 'No borrow from bit 4');
        assert.equal(cpu.C(), 0, 'No borrow from carry');

        // Result negative from positive number in a
        cpu.ld_a_n(0x05);
        ld.call(cpu, 0x08);

        sub.call(cpu);

        assert.equal(cpu.a(), 0xfd, `a loops back to 0xfd, ${sub.name}`);
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 1, 'N always set');
        assert.equal(cpu.H(), 0, 'No borrow from bit 4');
        assert.equal(cpu.C(), 1, 'Borrow from carry');

        // Max subtraction
        cpu.ld_a_n(0x01);
        ld.call(cpu, 0xff);

        sub.call(cpu);

        assert.equal(cpu.a(), 0x02, 'a loops back to 0x02');
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 1, 'N always set');
        assert.equal(cpu.H(), 0, 'No borrow from bit 4');
        assert.equal(cpu.C(), 1, 'Borrow from carry');

      });

      // Sub a is a special case
      cpu.ld_a_n(0x12);

      cpu.sub_a();

      assert.equal(cpu.a(), 0x00, 'a subtracted itself');
      assert.equal(cpu.Z(), 1, 'Result is zero');
      assert.equal(cpu.N(), 1, 'N always set');
      assert.equal(cpu.H(), 1, 'No borrow from bit 4');
      assert.equal(cpu.C(), 0, 'No borrow from carry');

      // Sub n, most common case
      cpu.ld_a_n(0x09);

      cpu.sub_n(0x04);

      assert.equal(cpu.a(), 0x05, 'a minus n');
      assert.equal(cpu.Z(), 0, 'Result not zero');
      assert.equal(cpu.N(), 1, 'N always set');
      assert.equal(cpu.H(), 0, 'No borrow from bit 4');
      assert.equal(cpu.C(), 0, 'No borrow from carry');

    });

    it('should add n to register a', () =>{

      cpu.ld_hl_nn(0xc000);

      // Do ADD (hl) first, as h and l will be overridden later
      [ {ld: cpu.ld_0xhl_n, add: cpu.add_0xhl},
        {ld: cpu.ld_b_n, add: cpu.add_b},
        {ld: cpu.ld_c_n, add: cpu.add_c},
        {ld: cpu.ld_d_n, add: cpu.add_d},
        {ld: cpu.ld_e_n, add: cpu.add_e},
        {ld: cpu.ld_h_n, add: cpu.add_h},
        {ld: cpu.ld_l_n, add: cpu.add_l} ].map( ({ld, add}) => {

        // Result is positive
        cpu.ld_a_n(0x12);
        ld.call(cpu, 0x02);

        add.call(cpu);

        assert.equal(cpu.a(), 0x14, `a 0x12 plus 0x02, ${add.name}`);
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 0, 'N always reset');
        assert.equal(cpu.H(), 0, 'No carry from bit 3');
        assert.equal(cpu.C(), 0, 'No carry');

        // Test carry from bit 3
        cpu.ld_a_n(0x0f);
        ld.call(cpu, 0x01);

        add.call(cpu);

        assert.equal(cpu.a(), 0x10, `a 0x0f plus two with half carry, ${add.name}`);
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 0, 'N always reset');
        assert.equal(cpu.H(), 1, 'Carry from bit 3');
        assert.equal(cpu.C(), 0, 'No carry');

        // Test a result zero
        cpu.ld_a_n(0xf0);
        ld.call(cpu, 0x10);

        add.call(cpu);

        assert.equal(cpu.a(), 0x00, `a 0xf0 plus 0x10 is zero, ${add.name}`);
        assert.equal(cpu.Z(), 1, 'Result is zero');
        assert.equal(cpu.N(), 0, 'N always reset');
        assert.equal(cpu.H(), 1, 'Carry from bit 3');
        assert.equal(cpu.C(), 1, 'Carry');

        // Result overflows from positive number in a
        cpu.ld_a_n(0xf0);
        ld.call(cpu, 0x12);

        add.call(cpu);

        assert.equal(cpu.a(), 0x02, `a 0xf0 overflows to 0x02, ${add.name}`);
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 0, 'N always reset');
        assert.equal(cpu.H(), 1, 'Carry from bit 3');
        assert.equal(cpu.C(), 1, 'Carry');

        // Test max addition
        cpu.ld_a_n(0x02);
        ld.call(cpu, 0xff);

        add.call(cpu);

        assert.equal(cpu.a(), 0x01, `a 0x02 plus 0xff overflows to 0x01, ${add.name}`);
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 0, 'N always reset');
        assert.equal(cpu.H(), 1, 'Carry from bit 3');
        assert.equal(cpu.C(), 1, 'Carry');

      });

      // Add a is a special case
      cpu.ld_a_n(0x12);

      cpu.add_a();

      assert.equal(cpu.a(), 0x24, 'a doubles itself');
      assert.equal(cpu.Z(), 0, 'Result not zero');
      assert.equal(cpu.N(), 0, 'N always reset');
      assert.equal(cpu.H(), 1, 'Carry from bit 3');
      assert.equal(cpu.C(), 0, 'No carry');

      // Add n, most common case
      cpu.ld_a_n(0x09);

      cpu.add_n(0x04);

      assert.equal(cpu.a(), 0x0d, 'a 0x09 plus n 0x04');
      assert.equal(cpu.Z(), 0, 'Result not zero');
      assert.equal(cpu.N(), 0, 'N always reset');
      assert.equal(cpu.H(), 0, 'No carry from bit 3');
      assert.equal(cpu.C(), 0, 'No carry');

    });

  });

  describe('16 bits arithmetic', () => {

    it('should decrement 16 bits registers', () => {
      assertDecrementRegister(cpu, cpu.bc, cpu.dec_bc);
      assertDecrementRegister(cpu, cpu.de, cpu.dec_de);
      assertDecrementRegister(cpu, cpu.hl, cpu.dec_hl);
      assertDecrementRegister(cpu, cpu.sp, cpu.dec_sp);
      // TODO check flags
    });

    it('should increment 16 bits registers', () => {

      [ {r: cpu.bc, ld: cpu.ld_bc_nn, inc: cpu.inc_bc},
        {r: cpu.de, ld: cpu.ld_de_nn, inc: cpu.inc_de},
        {r: cpu.hl, ld: cpu.ld_hl_nn, inc: cpu.inc_hl},
        {r: cpu.sp, ld: cpu.ld_sp_nn, inc: cpu.inc_sp} ].map( ({r, ld, inc}) => {

        const value = 0xc000;
        ld.call(cpu, value);
        inc.call(cpu);
        assert.equal(r.call(cpu), value + 1, `register ${r} incremented`);
        // No flags are affected
      });

    });

    it('should push registers into the stack', () => {

      cpu.push_af();
      assert.equal(cpu.mmu.readByteAt(cpu.sp() + 1), cpu.a(), 'store a into stack');
      assert.equal(cpu.mmu.readByteAt(cpu.sp()), cpu.f() << 4, 'store f into stack');

      cpu.push_bc();
      assert.equal(cpu.mmu.readByteAt(cpu.sp() + 1), cpu.b(), 'store b into stack');
      assert.equal(cpu.mmu.readByteAt(cpu.sp()), cpu.c(), 'store c into stack');

      cpu.push_de();
      assert.equal(cpu.mmu.readByteAt(cpu.sp() + 1), cpu.d(), 'store d into stack');
      assert.equal(cpu.mmu.readByteAt(cpu.sp()), cpu.e(), 'store e into stack');

      cpu.push_hl();
      assert.equal(cpu.mmu.readByteAt(cpu.sp() + 1), cpu.h(), 'store h into stack');
      assert.equal(cpu.mmu.readByteAt(cpu.sp()), cpu.l(), 'store l into stack');
    });

    it('should pop registers into the stack', () => {
      [ {r: cpu.af, pop: cpu.pop_af},
        {r: cpu.bc, pop: cpu.pop_bc},
        {r: cpu.de, pop: cpu.pop_de},
        {r: cpu.hl, pop: cpu.pop_hl} ].map( ({r, pop}) => {

        let sp = cpu.sp(); // sp: 0xfffe
        cpu.mmu.writeByteAt(--sp, 0xab); // sp: 0xfffd
        cpu.mmu.writeByteAt(--sp, 0xcd); // sp: 0xfffc
        cpu.ld_sp_nn(sp);

        pop.call(cpu);
        assert.equal(r.call(cpu), 0xabcd, `Pop into ${r.name}`);
        assert.equal(cpu.sp(), sp + 2, 'sp incremented twice');
      });
    });
  });

  describe('16 bits loads', () => {

    it('should load 16 bits into register', () => {

      cpu.ld_bc_nn(0xabcd);
      assert.equal(cpu.bc(), 0xabcd, 'load 0xabcd into bc');

      cpu.ld_de_nn(0xabcd);
      assert.equal(cpu.de(), 0xabcd, 'load 0xabcd into de');

      cpu.ld_hl_nn(0xabcd);
      assert.equal(cpu.hl(), 0xabcd, 'load 0xabcd into hl');

      cpu.ld_sp_nn(0xabcd);
      assert.equal(cpu.sp(), 0xabcd, 'load 0xabcd into sp');

    });

  });

  describe('8 bits loads', () => {
    it('should load 8 bits into registers', () => {
      cpu.ld_b_n(0xab);
      assert.equal(cpu.b(), 0xab, 'load 0xab into b');

      cpu.ld_c_n(0xab);
      assert.equal(cpu.c(), 0xab, 'load 0xab into c');

      cpu.ld_d_n(0xab);
      assert.equal(cpu.d(), 0xab, 'load 0xab into d');

      cpu.ld_e_n(0xab);
      assert.equal(cpu.e(), 0xab, 'load 0xab into e');

      cpu.ld_h_n(0xab);
      assert.equal(cpu.h(), 0xab, 'load 0xab into h');

      cpu.ld_l_n(0xab);
      assert.equal(cpu.l(), 0xab, 'load 0xab into l');
    });

    it('should copy registers into register a', () => {
      [ {r2: cpu.a, r1: cpu.a, ld: cpu.ld_a_a},
        {r2: cpu.b, r1: cpu.a, ld: cpu.ld_a_b},
        {r2: cpu.c, r1: cpu.a, ld: cpu.ld_a_c},
        {r2: cpu.d, r1: cpu.a, ld: cpu.ld_a_d},
        {r2: cpu.e, r1: cpu.a, ld: cpu.ld_a_e},
        {r2: cpu.h, r1: cpu.a, ld: cpu.ld_a_h},
        {r2: cpu.l, r1: cpu.a, ld: cpu.ld_a_l} ].map( ({r2, r1, ld}) => {
        const value = r2.call(cpu);
        ld.call(cpu);
        assert.equal(r1.call(cpu), value, `load ${r2.name} into ${r1.name}`);
      });
    });

    it('should copy memory locations into register a', () => {
      [ {r2: cpu.bc, r1: cpu.a, ld: cpu.ld_a_bc},
        {r2: cpu.de, r1: cpu.a, ld: cpu.ld_a_de},
        {r2: cpu.hl, r1: cpu.a, ld: cpu.ld_a_hl} ].map( ({r2, r1, ld}) => {

        const value = cpu.mmu.readByteAt(r2.call(cpu));
        ld.call(cpu);
        assert.equal(r1.call(cpu), value, `load ${r2.name} into ${r1.name}`);

      });

      const value = cpu.mmu.readByteAt(0xabcd);
      cpu.ld_a_nn(0xabcd);
      assert.equal(cpu.a(), value, 'load value at memory 0xabcd into a');
    });

    it('should load a byte into a', () => {
      cpu.ld_a_n(0xab);
      assert.equal(cpu.a(), 0xab, 'load value 0xab into a');
    });

    it('should put memory address hl into a and decrement hl', () => {
      const hl = cpu.hl();
      const value = cpu.mmu.readByteAt(hl);
      cpu.ldd_a_hl();
      assert.equal(cpu.a(), value, `register a has memory value ${value}`);
      assert.equal(cpu.hl(), hl - 1, 'hl is decremented 1');
    });

    it('should put a into memory address hl and decrement hl', () => {
      const a = cpu.a();
      const hl = 0xdfff;
      cpu.ld_hl_nn(hl);
      cpu.ldd_hl_a();
      assert.equal(cpu.mmu.readByteAt(hl), a, `memory ${Utils.hexStr(hl)} has value ${a}`);
      assert.equal(cpu.hl(), hl - 1, 'hl is decremented by 1');
    });

    it('should put a into memory address 0xff00 + 0', () => {
      const value = cpu.mmu.readByteAt(0xff00);
      cpu.ld_a_n(0xab);
      cpu.ldh_n_a(0);
      assert.equal(cpu.mmu.readByteAt(0xff00), 0xab, 'memory 0xff00 has value 0xab');
    });

    it('should put a into memory address 0xff00 + 0xfe', () => {
      const value = cpu.mmu.readByteAt(0xfffe);
      cpu.ld_a_n(0xab);
      cpu.ldh_n_a(0xfe);
      assert.equal(cpu.mmu.readByteAt(0xfffe), 0xab, 'memory 0xfffe has value 0xab');
    });

    it('should not write a into address 0xff00 + 0xff', () => {
      const value = cpu.mmu.readByteAt(0xfffe);
      cpu.ld_a_n(0xab);
      cpu.ldh_n_a(0xff);
      assert.equal(cpu.mmu.readByteAt(0xfffe), value, 'value at memory 0xffff does not change');
    });

    it('should put value at memory address 0xff00 + 0 into a', () => {
      const value = cpu.mmu.readByteAt(0xff00);
      cpu.ldh_a_n(0);
      assert.equal(cpu.a(), value, '(0xff00) into a');
    });

    it('should put value at memory address 0xff00 + 0xfe into a', () => {
      const value = cpu.mmu.readByteAt(0xff00 + 0xfe);
      cpu.ldh_a_n(0xfe);
      assert.equal(cpu.a(), value, '(0xfffe) into a');
    });

    it('should put value at memory address 0xff00 + 0xff into a', () => {
      const value = cpu.mmu.readByteAt(0xff00 + 0xff);
      cpu.ldh_a_n(0xff);
      assert.equal(cpu.a(), value, '(0xffff) into a');
    });

    it('should put a into memory address 0xff00 + c', () => {
      const value = 0xab;
      const offset = 0x01;
      cpu.ld_c_n(offset);
      cpu.ld_a_n(value);
      cpu.ld_0xc_a();
      assert.equal(cpu.mmu.readByteAt(0xff00 + offset), value, 'value at memory address 0xff00 + c');
    });

    it('should not write memory address 0xff00 + 0xff', () => {
      const offset = 0xff;
      const ie = cpu.ie();
      cpu.ld_c_n(offset);
      cpu.ld_a_n(0xab);

      assert.doesNotThrow( () => {
        cpu.ld_0xc_a();
      }, Error, 'should not write on 0xffff silently');

      assert.equal(cpu.mmu.readByteAt(0xff00 + offset), ie, 'ie is not overridden.');
    });

    it('should copy register a into other registers and memory locations', () => {
      cpu.ld_a_n(0xab);
      cpu.ld_bc_nn(0xc000);
      cpu.ld_de_nn(0xc001);
      cpu.ld_hl_nn(0xc002);
      const nn = 0xc003;

      cpu.ld_a_a();
      cpu.ld_b_a();
      cpu.ld_c_a();
      cpu.ld_d_a();
      cpu.ld_e_a();
      cpu.ld_h_a();
      cpu.ld_l_a();
      cpu.ld_0xbc_a();
      cpu.ld_0xde_a();
      cpu.ld_0xhl_a();
      cpu.ld_0xnn_a(nn);

      assert.equal(cpu.a(), cpu.a(), 'copy a to a');
      assert.equal(cpu.b(), cpu.a(), 'copy a to b');
      assert.equal(cpu.c(), cpu.a(), 'copy a to c');
      assert.equal(cpu.d(), cpu.a(), 'copy a to d');
      assert.equal(cpu.e(), cpu.a(), 'copy a to e');
      assert.equal(cpu.h(), cpu.a(), 'copy a to h');
      assert.equal(cpu.l(), cpu.a(), 'copy a to l');
      assert.equal(cpu.mmu.readByteAt(cpu.bc()), cpu.a(), 'copy a to memory location bc');
      assert.equal(cpu.mmu.readByteAt(cpu.de()), cpu.a(), 'copy a to memory location de');
      assert.equal(cpu.mmu.readByteAt(cpu.hl()), cpu.a(), 'copy a to memory location hl');
      assert.equal(cpu.mmu.readByteAt(nn), cpu.a(), 'copy a to memory location nn');
    });

    it('should load a into memory address hl and increment hl', () => {
      const value = 0xab;
      const addr = 0xc000;
      cpu.ld_a_n(value);
      cpu.ld_hl_nn(addr);
      
      cpu.ldi_0xhl_a();

      assert.equal(cpu.mmu.readByteAt(addr), value, 'Regiter a into (hl)');
      assert.equal(cpu.hl(), addr + 1, 'hl incremented');
    });

    it('should load registers into memory location hl', () => {
      [ {ld: cpu.ld_b_n, ld_0xhl: cpu.ld_0xhl_b},
        {ld: cpu.ld_c_n, ld_0xhl: cpu.ld_0xhl_c},
        {ld: cpu.ld_d_n, ld_0xhl: cpu.ld_0xhl_d},
        {ld: cpu.ld_e_n, ld_0xhl: cpu.ld_0xhl_e},
        {ld: cpu.ld_h_n, ld_0xhl: cpu.ld_0xhl_h},
        {ld: cpu.ld_l_n, ld_0xhl: cpu.ld_0xhl_l} ].map( ({ld, ld_0xhl}) => {

          cpu.ld_hl_nn(0xc000);
          ld.call(cpu, 0xc0);
          ld_0xhl.call(cpu);
          assert.equal(cpu.mmu.readByteAt(0xc000), 0xc0, `${ld_0xhl.name} applied.`);

      });

      // Special case, immediate byte
      cpu.ld_hl_nn(0xc000);
      cpu.ld_0xhl_n(0x01);
      assert.equal(cpu.mmu.readByteAt(0xc000), 0x01, 'loaded n into memory location hl');
    });

  });

  describe('Bit operations', () => {
    it('should test bits', () => {
      cpu.ld_h_n(0x00);
      cpu.bit_7_h();
      assert.equal(cpu.Z(), 1, 'bit 7 is zero');
      assert.equal(cpu.N(), 0, 'N always reset');
      assert.equal(cpu.H(), 1, 'H always set');

      cpu.ld_h_n(0b10000000);
      cpu.bit_7_h();
      assert.equal(cpu.Z(), 0, 'bit 7 is not zero');
      assert.equal(cpu.N(), 0, 'N always reset');
      assert.equal(cpu.H(), 1, 'H always set');
    });
  });

  describe('Calls', () => {
    it('should call a routine', () => {
      const pc = cpu.pc();
      const sp = cpu.sp();
      const addr = 0x1234;

      cpu.call(addr);
      assert.equal(cpu.mmu.readByteAt(sp - 1), Utils.msb(pc), 'store the lsb into stack');
      assert.equal(cpu.mmu.readByteAt(sp - 2), Utils.lsb(pc), 'store the msb into stack');
      assert.equal(cpu.sp(), sp - 2, 'sp moved down 2 bytes');
      assert.equal(cpu.pc(), addr, 'jump to address');
    });
  });

  describe('Rotates and Shifts', () => {
    it('should rotate registers left', () => {

      [ {r: cpu.a, ld: cpu.ld_a_n, rl: cpu.rl_a},
        {r: cpu.b, ld: cpu.ld_b_n, rl: cpu.rl_b},
        {r: cpu.c, ld: cpu.ld_c_n, rl: cpu.rl_c},
        {r: cpu.d, ld: cpu.ld_d_n, rl: cpu.rl_d},
        {r: cpu.e, ld: cpu.ld_e_n, rl: cpu.rl_e},
        {r: cpu.h, ld: cpu.ld_h_n, rl: cpu.rl_h},
        {r: cpu.l, ld: cpu.ld_l_n, rl: cpu.rl_l} ].map( ({r, ld, rl}) => {

        cpu.setC(0);
        ld.call(cpu, 0x80);
        rl.call(cpu);
        assert.equal(r.call(cpu), 0x00, `${r.name} rotated left`);
        assert.equal(cpu.Z(), 1, 'Result was zero');
        assert.equal(cpu.N(), 0, 'N reset');
        assert.equal(cpu.H(), 0, 'H reset');
        assert.equal(cpu.C(), 1, 'Carry set');
      });

      const addr = 0xc000;
      cpu.ld_hl_nn(addr);
      cpu.mmu.writeByteAt(addr, 0x11);
      cpu.setC(1);
      cpu.rl_0xhl();
      assert.equal(cpu.mmu.readByteAt(addr), 0x22, 'value at memory hl rotated left');
      assert.equal(cpu.Z(), 0, 'Result was positive');
      assert.equal(cpu.N(), 0, 'N reset');
      assert.equal(cpu.H(), 0, 'H reset');
      assert.equal(cpu.C(), 0, 'C reset');
    });

    it('should rotate a to the left', () => {
      cpu.setC(1);
      cpu.ld_a_n(           0b10010101);
      cpu.rla();
      assert.equal(cpu.a(), 0b00101011, 'Rotate a left');
      assert.equal(cpu.Z(), 0, 'Result was positive');
      assert.equal(cpu.N(), 0, 'N reset');
      assert.equal(cpu.H(), 0, 'H reset');
      assert.equal(cpu.C(), 1, 'Carry 1');
    });
  });

  describe('Returns', () => {
    it('should return from routine', () => {

      const addr = 0xabcd;
      const sp = cpu.sp();
      cpu.ld_hl_nn(addr);
      cpu.push_hl();
      
      cpu.ret();

      assert.equal(cpu.sp(), sp, 'sp to be original value');
      assert.equal(cpu.pc(), addr, `program to continue on ${addr}`)

    });

  });

});

/**
 * Asserts that a register is decremented.
 * @param scope
 * @param registerFn
 * @param decFn
 */
function assertDecrementRegister(scope, registerFn, decFn){
  const value = registerFn.call(scope);
  let expected = value - 1;
  if (value === 0) expected = 0xff;
  decFn.call(scope);
  assert.equal(registerFn.call(scope), expected, `decrement ${registerFn.name}`);
}

function testSetGetFlag(cpu, setFn, getFn){
  setFn.call(cpu, 1);
  assert.equal(getFn.call(cpu), 1, 'Flag=1');
  setFn.call(cpu, 0);
  assert.equal(getFn.call(cpu), 0, 'Flag=0');
}

function assertFlagsCompareGreaterValue(cpu){
  assert.equal(cpu.Z(), 0, 'Z reset as a < n');
  assert.equal(cpu.N(), 1, 'N is always set');
  assert.equal(cpu.C(), 1, 'a is greater than n');
}

function assertFlagsCompareEqualValue(cpu){
  assert.equal(cpu.Z(), 1, 'Z is set as a=n');
  assert.equal(cpu.N(), 1, 'N is set');
  assert.equal(cpu.C(), 0, 'a is not greater than n');
}

function assertFlagsCompareLowerValue(cpu){
  assert.equal(cpu.Z(), 0, 'Z not set as a > n');
  assert.equal(cpu.N(), 1, 'N is always set');
  assert.equal(cpu.C(), 0, 'a is greater than n');
}