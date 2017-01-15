import CPU from '../src/cpu';
import assert from 'assert';
import config from '../src/config';
import {describe, beforeEach, it} from 'mocha';
import Utils from '../src/utils';
import LCDMock from './mock/lcdMock';
import MMUMock from './mock/mmuMock';

describe('CPU Instruction Set', function() {

  config.DEBUG = false;
  config.TEST = true;
  let cpu;

  beforeEach( () => {
    cpu = new CPU(new MMUMock(), new LCDMock());
    /**
     * @param {number} pc
     */
    cpu.setPC = function(pc){
      this._r.pc = pc;
    };
    cpu.testSetGetFlag = function(setFn, getFn){
      setFn.call(cpu, 1);
      assert.equal(getFn.call(cpu), 1, 'Flag=1');
      setFn.call(cpu, 0);
      assert.equal(getFn.call(cpu), 0, 'Flag=0');
    };
    cpu.resetFlags = function(){
      cpu._r._f &= 0x0f;
    };
    cpu.setFlags = function(){
      cpu._r._f |= 0xf0;
    };

    /**
     * @param {number} opcode
     * @param {number|undefined} param1 (optional)
     * @param {number|undefined} param2 (optional)
     */
    cpu.mockInstruction = function(opcode, param1, param2){
      if (opcode !== undefined) cpu.mmu.writeByteAt(cpu.pc(), opcode);
      if (param1 !== undefined) cpu.mmu.writeByteAt(cpu.pc()+1, param1);
      if (param2 !== undefined) cpu.mmu.writeByteAt(cpu.pc()+2, param2);
    };

    cpu.setPC(0x100);
  });

  describe('ROM file loading', () => {
    it('should handle missing MMU', () => {
      assert.throws(() => new CPU(), Error);
    });

    it('should handle missing lcd', () => {
      assert.throws( () => new CPU(new MMUMock(), null), Error, 'Missing lcd');
    });
  });

  it('should understand prefix 0xcb instructions', () => {
    const pc = cpu.pc();
    cpu.mockInstruction(0xcb, 0x7c);

    cpu.execute();

    assert.equal(cpu.pc() - pc, 2, 'advance pc accordingly');
  });

  describe('Flags', () => {

    it('should set carry flag', () => {
      cpu.resetFlags();
      const m = cpu.m();
      const pc = cpu.pc();
      cpu.mockInstruction(0x37/* sfc */);

      cpu.execute();

      assert.equal(cpu.f(), 0b0001, '...C');
      assert.equal(cpu.pc() - pc, 1, '1-byte instruction');
      assert.equal(cpu.m() - m, 1, 'Machine cycles');

      cpu.setFlags();

      cpu.setPC(pc);
      cpu.execute();

      assert.equal(cpu.f(), 0b1001, 'Z..C zero flag value is kept');
    });

    it('should complement carry flag', () => {
      cpu.resetFlags();
      const m = cpu.m();
      const pc = cpu.pc();
      cpu.mockInstruction(0x3f/* ccf */);

      cpu.execute();

      assert.equal(cpu.f(), 0b0001, '...C');
      assert.equal(cpu.pc() - pc, 1, '1-byte instruction');
      assert.equal(cpu.m() - m, 1, 'Machine cycles');

      cpu.setPC(pc);
      cpu.execute();

      assert.equal(cpu.f(), 0b0000, '....');

      cpu.setFlags();

      cpu.setPC(pc);
      cpu.execute();

      assert.equal(cpu.f(), 0b1000, 'Z... zero flag value is kept');
    });

  });

  describe('NOP', () => {
    it('should run NOP in 1 machine cycle', () => {
      const m = cpu.m();
      const pc = cpu.pc();
      cpu.mockInstruction(0x00/* nop */);

      cpu.execute();

      assert.equal(cpu.m() - m, 1, 'NOP runs in 1 machine cycle.');
      assert.equal(cpu.pc() - pc, 1, '1-byte instruction');
    });
  });

  describe('Jumps', () => {
    
    it('should jump JP to address', () => {
      const m = cpu.m();
      const pc = cpu.pc();
      cpu.mockInstruction(0xc3/* jp */, 0x23, 0x01);

      cpu.execute();

      assert.equal(cpu.pc(), 0x123);
      assert.equal(cpu.m() - m, 4, 'JP runs in 4 machine cycles');
    });

    it('should jump to the minimum possible address', () => {
      cpu.mockInstruction(0xc3/* jp */, 0x00, 0x00);

      cpu.execute();

      assert.equal(cpu.pc(), 0);
    });

    it('should jump to the maximum possible address', () => {
      cpu.mockInstruction(0xc3/* jp */, 0xff, 0xff);

      cpu.execute();

      assert.equal(cpu.pc(), 0xffff);
    });

    it('should jump to address contained in hl', () => {
      cpu.ld_hl_nn(0xc000);
      const m = cpu.m();

      cpu.jp_hl();

      assert.equal(cpu.pc(), 0xc000);
      assert.equal(cpu.m(), m+1, 'JP (HL) runs in 1 machine cycle');
    });

    describe('Jump with signed integer', () => {

      it('should jump around lowest address memory', () => {
        const maxJump = 0x7f;
        const minJump = 0x80;
        const instrLength = 2;
        const pc = cpu.pc();
        cpu.setPC(pc + instrLength);
      
        cpu.jr_e(maxJump);

        assert.equal(cpu.pc() - pc, maxJump + instrLength);

        cpu.setPC(0 + instrLength);

        cpu.jr_e(minJump);

        assert.equal(cpu.pc(), 0xff82);
      });

      it('should jump around highest address memory', () => {
        const max = 0x7f;
        cpu.setPC(0xffff); // 0xfffd + 2
      
        cpu.jr_e(max);

        assert.equal(cpu.pc(), 0x007e); // 0xfffd + 0x7f

        const min = 0x80;
        cpu.setPC(0xffff); // 0xfffd + 2

        cpu.jr_e(min);

        assert.equal(cpu.pc(), 0xff7f); // 0xfffd - 0x80
      });

      it('should jump to same address', () => {
        const addr = 0xc000;
        const s_int = 0xfe; // -2
        cpu.setPC(addr + 2);

        cpu.jr_e(s_int);

        assert.equal(cpu.pc(), addr);
      });
    });

    describe('Jump NZ with address', () => {
      it('should jump to address if Z is reset', () => {
        cpu._setZ(0);
        const m = cpu.m();

        cpu.jp_nz_nn(0xc000);

        assert.equal(cpu.pc(), 0xc000, 'jump to address');
        assert.equal(cpu.m(), m+4, 'JP NZ runs in 4 machine cycles if jumps');
      });

      it('should not jump to address if Z is set', () => {
        cpu._setZ(1);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jp_nz_nn(0xc000);

        assert.equal(cpu.pc(), pc, 'do not jump to address');
        assert.equal(cpu.m(), m+3, 'JP NZ runs in 3 machine cycles if does not jump');
      });
    });

    describe('JR', () => {
      it('should jump an offset', () => {
        cpu.setPC(0x100);
        const m = cpu.m();

        cpu.jr_e(0x01);

        assert.equal(cpu.pc(), 0x100 + 1, 'jump forward');
        assert.equal(cpu.m() - m, 3, 'JR machine cycles');

        cpu.jr_e(0xfc); // -4

        assert.equal(cpu.pc(), 0x101 - 4, 'jump backward');
      });

    });

    describe('Jump NZ with signed byte', () => {
      it('should jump forward if Z is reset', () => {
        cpu._setZ(0);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_nz_n(0x05);

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0x05), 'jump forward');
        assert.equal(cpu.m(), m+3, 'JR NZ runs in 3 machine cycles if jumps');
      });

      it('should jump backwards if Z is reset', () => {
        cpu.setPC(0x100);
        cpu._setZ(0);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_nz_n(0xfc); // -4

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0xfc), 'jump backward');
        assert.equal(cpu.m(), m+3, 'JR NZ runs in 3 machine cycles if jumps');
      });

      it('should not jump if Z is set', () => {
        cpu._setZ(1);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_nz_n(0xfc);

        assert.equal(cpu.pc(), pc, 'do not jump, move to the next instruction');
        assert.equal(cpu.m(), m+2, 'JR NZ runs in 2 machine cycles if does not jump');
      });
    });

    describe('Jump Z with address', () => {
      it('should jump to address if Z is set', () => {
        cpu._setZ(1);
        const m = cpu.m();

        cpu.jp_z_nn(0xc000);

        assert.equal(cpu.pc(), 0xc000, 'jump to address');
        assert.equal(cpu.m(), m+4, 'JP Z nn runs in 4 machine cycles if jumps');
      });

      it('should not jump to address if Z is reset', () => {
        cpu._setZ(0);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jp_z_nn(0xc000);

        assert.equal(cpu.pc(), pc, 'do not jump to address');
        assert.equal(cpu.m(), m+3, 'JP Z runs in 3 machine cycles if does not jump');
      });
    });

    describe('Jump Z with signed byte', () => {
      it('should jump forward if Z is set', () => {
        cpu._setZ(1);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_z_n(0x05);

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0x05), 'jump forward');
        assert.equal(cpu.m(), m+3, 'JR Z e runs in 3 machine cycles if jumps');
      });

      it('should jump backwards if Z is set', () => {
        cpu.setPC(0x100);
        cpu._setZ(1);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_z_n(0xfc); // -4

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0xfc), 'jump backward');
        assert.equal(cpu.m(), m+3, 'JR Z e runs in 3 machine cycles if jumps');
      });

      it('should not jump if Z is reset', () => {
        cpu._setZ(0);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_z_n(0xfc);

        assert.equal(cpu.pc(), pc, 'do not jump, move to the next instruction');
        assert.equal(cpu.m(), m+2, 'JR Z e runs in 2 machine cycles if jumps');
      });
    });

    describe('Jump NC with address', () => {
      it('should jump to address if Carry is reset', () => {
        cpu._setC(0);
        const m = cpu.m();

        cpu.jp_nc_nn(0xc000);

        assert.equal(cpu.pc(), 0xc000, 'jump to address');
        assert.equal(cpu.m(), m+4, 'Runs in 4 machine cycles if jumps');
      });

      it('should not jump to address if Carry is set', () => {
        cpu._setC(1);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jp_nc_nn(0xc000);

        assert.equal(cpu.pc(), pc, 'do not jump to address');
        assert.equal(cpu.m(), m+3, 'Runs in 3 machine cycles if does not jump');
      });
    });

    describe('Jump NC with signed byte', () => {
      it('should jump forward if C is reset', () => {
        cpu._setC(0);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_nc_n(0x05);

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0x05), 'jump forward');
        assert.equal(cpu.m(), m+3, 'Runs in 3 machine cycles if jumps');
      });

      it('should jump backwards if C is reset', () => {
        cpu.setPC(0x100);
        cpu._setC(0);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_nc_n(0xfc); // -4

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0xfc), 'jump backward');
        assert.equal(cpu.m(), m+3, 'Runs in 3 machine cycles if jumps');
      });

      it('should not jump if C is set', () => {
        cpu._setC(1);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_nc_n(0xfc);

        assert.equal(cpu.pc(), pc, 'do not jump, move to the next instruction');
        assert.equal(cpu.m(), m+2, 'Runs in 2 machine cycles if does not jump');
      });
    });

    describe('Jump C with address', () => {
      it('should jump to address if Carry is set', () => {
        cpu._setC(1);
        const m = cpu.m();

        cpu.jp_c_nn(0xc000);

        assert.equal(cpu.pc(), 0xc000, 'jump to address');
        assert.equal(cpu.m(), m+4, 'Runs in 4 machine cycles if jumps');
      });

      it('should not jump to address if Carry is reset', () => {
        cpu._setC(0);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jp_c_nn(0xc000);

        assert.equal(cpu.pc(), pc, 'do not jump to address');
        assert.equal(cpu.m(), m+3, 'Runs in 3 machine cycles if does not jump');
      });
    });

    describe('Jump C with signed byte', () => {
      it('should jump forward if C is set', () => {
        cpu._setC(1);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_c_n(0x05);

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0x05), 'jump forward');
        assert.equal(cpu.m(), m+3, 'Runs in 3 machine cycles if jumps');
      });

      it('should jump backwards if C is set', () => {
        cpu.setPC(0x100);
        cpu._setC(1);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_c_n(0xfc);

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0xfc), 'jump backward');
        assert.equal(cpu.m(), m+3, 'Runs in 3 machine cycles if jumps');
      });

      it('should not jump if C is reset', () => {
        cpu._setC(0);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_c_n(0xfc);

        assert.equal(cpu.pc(), pc, 'do not jump, move to the next instruction');
        assert.equal(cpu.m(), m+2, 'Runs in 2 machine cycles if does not jump');
      });
    });

  });

  describe('8 bit arithmetic', () => {

    describe('AND', () => {

      it('should AND register a with itself', () => {
        cpu.ld_a_n(0x11);

        const m = cpu.m();
        cpu.and_a();
        
        assert.equal(cpu.a(), cpu.a(), 'a AND a does not change a');
        assert.equal(cpu.f(), 0b0010, 'AND a with positive result sets only H');
        assert.equal(cpu.m(), m+1, 'ADD A,A runs in 1 machine cycle.');
      });

      it('should AND register a with register r', () => {

        [ {ld: cpu.ld_b_n, and: cpu.and_b},
          {ld: cpu.ld_c_n, and: cpu.and_c},
          {ld: cpu.ld_d_n, and: cpu.and_d},
          {ld: cpu.ld_e_n, and: cpu.and_e},
          {ld: cpu.ld_h_n, and: cpu.and_h},
          {ld: cpu.ld_l_n, and: cpu.and_l} ].map( ({ld, and}) => {
            cpu.ld_a_n(0x11);
            ld.call(cpu, 0x33);

            const m = cpu.m();
            and.call(cpu);

            assert.equal(cpu.a(), 0x11 & 0x33, `a ${and.name}`);
            assert.equal(cpu.f(), 0b0010, `${and.name} with positive result sets only H`);
            assert.equal(cpu.m(), m+1, 'AND A,r runs in 1 machine cycle.');
        });
      });

      it('should AND a with memory location hl', () => {
        cpu.ld_a_n(0x11);
        cpu.ld_hl_nn(0xc000);
        cpu.ld_0xhl_n(0x33);

        const m = cpu.m();
        cpu.and_0xhl();

        assert.equal(cpu.a(), 0x11 & 0x33, 'a AND (hl)');
        assert.equal(cpu.f(), 0b0010, 'OR (hl) with positive result sets only H');
        assert.equal(cpu.m(), m+2, 'AND A,(HL) runs in 2 machine cycle.');
      });

      it('should AND a with byte n', () => {
        cpu.ld_a_n(0x11);

        const m = cpu.m();
        cpu.and_n(0x33);

        assert.equal(cpu.a(), 0x11 & 0x33, 'a AND n');
        assert.equal(cpu.f(), 0b0010, 'AND n with positive result sets only H');
        assert.equal(cpu.m(), m+2, 'AND A,n runs in 2 machine cycle.');
      });

      it('should set flag Z if AND result is zero', () => {
        cpu.ld_a_n(0x0f);
        
        cpu.and_n(0xf0);

        assert.equal(cpu.a(), 0x00, 'a AND n');
        assert.equal(cpu.f(), 0b1010, 'AND n with zero result sets Z and H');
      });
    });

    describe('OR', () => {

      it('should OR register a with itself', () => {
        cpu.ld_a_n(0x11);

        const m = cpu.m();
        cpu.or_a();
        
        assert.equal(cpu.a(), cpu.a(), 'a OR a does not change a');
        assert.equal(cpu.f(), 0b0000, 'OR a with positive number resets all flags');
        assert.equal(cpu.m(), m+1, 'OR A,A runs in 1 machine cycle');
      });

      it('should OR register a with register r', () => {

        [ {ld: cpu.ld_b_n, or: cpu.or_b},
          {ld: cpu.ld_c_n, or: cpu.or_c},
          {ld: cpu.ld_d_n, or: cpu.or_d},
          {ld: cpu.ld_e_n, or: cpu.or_e},
          {ld: cpu.ld_h_n, or: cpu.or_h},
          {ld: cpu.ld_l_n, or: cpu.or_l} ].map( ({ld, or}) => {

            cpu.ld_a_n(0x11);
            ld.call(cpu, 0x22);

            const m = cpu.m();
            or.call(cpu);

            assert.equal(cpu.a(), 0x11 | 0x22, `a ${or.name}`);
            assert.equal(cpu.f(), 0b0000, `All flags zero with ${or.name}`);
            assert.equal(cpu.m(), m+1, 'OR A,r runs in 1 machine cycle');
        });
      });

      it('should OR a with memory location hl', () => {
        cpu.ld_a_n(0x11);
        cpu.ld_hl_nn(0xc000);
        cpu.mmu.writeByteAt(0xc000, 0x22);

        const m = cpu.m();
        cpu.or_0xhl();

        assert.equal(cpu.a(), 0x11 | 0x22, 'a OR (hl)');
        assert.equal(cpu.f(), 0b0000, 'All flags zero with OR (hl)');
        assert.equal(cpu.m(), m+2, 'OR A,(HL) runs in 2 machine cycle');
      });

      it('should OR a with byte n', () => {
        cpu.ld_a_n(0x11);

        const m = cpu.m();
        cpu.or_n(0x22);

        assert.equal(cpu.a(), 0x11 | 0x22, 'a OR n');
        assert.equal(cpu.f(), 0b0000, 'All flags zero with OR n');
        assert.equal(cpu.m(), m+2, 'OR A,n runs in 2 machine cycle');
      });

      it('should set flag Z if OR result is zero', () => {
        cpu.ld_a_n(0x00);
        
        cpu.or_n(0x00);

        assert.equal(cpu.a(), 0x00, 'a OR n');
        assert.equal(cpu.f(), 0b1000, 'Zero flag set');
      });
    });

    describe('XOR', () => {

      it('should XOR register a', () => {
        const m = cpu.m();

        cpu.xor_a();

        assert.equal(cpu.a(), 0x00);
        assert.equal(cpu.f(), 0b1000, 'Z=1, N=0, h=0, c=0');
        assert.equal(cpu.m(), m+1, 'XOR A,A runs in 1 machine cycle');
      });

      it('should XOR register a with register r', () => {

        [{ld: cpu.ld_b_n, xor: cpu.xor_b},
          {ld: cpu.ld_c_n, xor: cpu.xor_c},
          {ld: cpu.ld_d_n, xor: cpu.xor_d},
          {ld: cpu.ld_e_n, xor: cpu.xor_e},
          {ld: cpu.ld_h_n, xor: cpu.xor_h},
          {ld: cpu.ld_l_n, xor: cpu.xor_l}].map(({ld, xor}) => {

          cpu.ld_a_n(0x11);
          ld.call(cpu, 0x22);

          const m = cpu.m();
          xor.call(cpu);

          assert.equal(cpu.a(), 0x11 ^ 0x22, `a ${xor.name}`);
          assert.equal(cpu.f(), 0b0000, `All flags zero with ${xor.name}`);
          assert.equal(cpu.m(), m+1, 'XOR A,r runs in 1 machine cycle');
        });
      });

      it('should XOR register a with n', () => {
        cpu.ld_a_n(0x00);

        const m = cpu.m();
        cpu.xor_n(0x00);

        assert.equal(cpu.a(), 0x00, 'register a should be zero.');
        assert.equal(cpu.f(), 0b1000, 'Z=1, N=0, h=0, c=0');
        assert.equal(cpu.m(), m+2, 'XOR A,n runs in 2 machine cycle');
      });

      it('should xor register a with memory address hl', () => {
        const m = cpu.m();
        const a = cpu.a();
        const hl = cpu.hl();
        const value = cpu.mmu.readByteAt(hl);

        cpu.xor_0xhl();

        assert.equal(cpu.a(), a ^ value, `register a should be ${Utils.hexStr(a)} xor ${Utils.hexStr(value)}`);
        assert.equal(cpu.m(), m+2, 'XOR A,(HL) runs in 2 machine cycle');
      });
    });

    describe('DEC', () => {

      it('should decrement 8 bits register', () => {

        [ {r: cpu.a, dec: cpu.dec_a},
          {r: cpu.b, dec: cpu.dec_b},
          {r: cpu.c, dec: cpu.dec_c},
          {r: cpu.d, dec: cpu.dec_d},
          {r: cpu.e, dec: cpu.dec_e},
          {r: cpu.h, dec: cpu.dec_h},
          {r: cpu.l, dec: cpu.dec_l} ].map(({r, dec}) => {

            const value = r.call(cpu);
            const m = cpu.m();
            let expected = value - 1;
            if (value === 0) expected = 0xff;

            dec.call(cpu);

            assert.equal(r.call(cpu), expected, `decrement ${r.name}`);
            assert.equal(cpu.m(), m+1, `DEC ${r.name} runs in 1 machine cycle`);
        });
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
        cpu._setC(0);
        cpu.ld_hl_nn(0xc000);
        cpu.ld_0xhl_n(0xab);

        const m = cpu.m();
        cpu.dec_0xhl();

        assert.equal(cpu.$hl(), 0xaa, 'Value at memory 0xdfff is decremented');
        assert.equal(cpu.f(), 0b0100, 'Not zero without half carry');
        assert.equal(cpu.m() - m, 3, 'DEC (HL) runs in 3 machine cycle');

        cpu.ld_0xhl_n(0x01);

        cpu.dec_0xhl();

        assert.equal(cpu.$hl(), 0x00, 'Decrements to zero');
        assert.equal(cpu.f(), 0b1100, 'Zero without half carry');

        cpu.ld_0xhl_n(0x00);

        cpu.dec_0xhl();

        assert.equal(cpu.$hl(), 0xff, 'Value loops');
        assert.equal(cpu.f(), 0b0110, 'Not zero with half carry');
      });
    });

    describe('CP', () => {

      it('should compare register a with itself', () => {
        cpu.ld_a_n(0xab);

        const m = cpu.m();
        cpu.cp_a();

        assertFlagsCompareEqualValue(cpu);
        assert.equal(cpu.m(), m+1, 'Compare cycles');
      });

      it('it should compare registers with register a', () => {

        [{ld: cpu.ld_b_n, cp: cpu.cp_b},
          {ld: cpu.ld_c_n, cp: cpu.cp_c},
          {ld: cpu.ld_d_n, cp: cpu.cp_d},
          {ld: cpu.ld_e_n, cp: cpu.cp_e},
          {ld: cpu.ld_h_n, cp: cpu.cp_h},
          {ld: cpu.ld_l_n, cp: cpu.cp_l}].map(({ld, cp}) => {

          cpu.ld_a_n(0xab);

          ld.call(cpu, 0xab); // Same value

          let m = cpu.m();
          cp.call(cpu);

          assertFlagsCompareEqualValue(cpu);
          assert.equal(cpu.m(), m+1, 'Compare cycles');

          ld.call(cpu, 0x01); // Lower value

          m = cpu.m();
          cp.call(cpu);

          assertFlagsCompareLowerValue(cpu);
          assert.equal(cpu.m(), m+1, 'Compare cycles');

          ld.call(cpu, 0xff); // Greater value

          m = cpu.m();
          cp.call(cpu);

          assertFlagsCompareGreaterValue(cpu);
          assert.equal(cpu.m(), m+1, 'Compare cycles');
        });
      });

      it('should compare register a with value at memory address hl', () => {
        cpu.ld_a_n(0xab);
        cpu.ld_hl_nn(0xfffe);

        cpu.mmu.writeByteAt(cpu.hl(), 0x01); // Lower value

        const m = cpu.m();
        cpu.cp_0xhl();

        assertFlagsCompareLowerValue(cpu);
        assert.equal(cpu.m(), m+2, 'Compare cycles');

        cpu.mmu.writeByteAt(cpu.hl(), 0xab); // Equal value

        cpu.cp_0xhl();

        assertFlagsCompareEqualValue(cpu);
        assert.equal(cpu.m(), m+4, 'Compare cycles');


        cpu.mmu.writeByteAt(cpu.hl(), 0xff); // Greater value

        cpu.cp_0xhl();

        assertFlagsCompareGreaterValue(cpu);
        assert.equal(cpu.m(), m+6, 'Compare cycles');
      });

      it('should compare register a with lower value n', () => {
        const n = 0x01;
        cpu.ld_a_n(0xab);

        const m = cpu.m();
        cpu.cp_n(n);

        assertFlagsCompareLowerValue(cpu);
        assert.equal(cpu.m(), m+2, 'Compare cycles');
      });

      it('should compare register a with equal value n', () => {
        const n = 0xab;
        cpu.ld_a_n(0xab);

        const m = cpu.m();
        cpu.cp_n(n);

        assertFlagsCompareEqualValue(cpu);
        assert.equal(cpu.m(), m+2, 'Compare cycles');
      });

      it('should compare register a with greater value n', () => {
        const n = 0xff;
        cpu.ld_a_n(0xab);

        const m = cpu.m();
        cpu.cp_n(n);

        assertFlagsCompareGreaterValue(cpu);
        assert.equal(cpu.m(), m+2, 'Compare cycles');
      });
    });

    describe('INC', () => {

      it('should increment register by 1', () => {

        [{r: cpu.a, ld: cpu.ld_a_n, inc: cpu.inc_a},
          {r: cpu.b, ld: cpu.ld_b_n, inc: cpu.inc_b},
          {r: cpu.c, ld: cpu.ld_c_n, inc: cpu.inc_c},
          {r: cpu.d, ld: cpu.ld_d_n, inc: cpu.inc_d},
          {r: cpu.e, ld: cpu.ld_e_n, inc: cpu.inc_e},
          {r: cpu.h, ld: cpu.ld_h_n, inc: cpu.inc_h},
          {r: cpu.l, ld: cpu.ld_l_n, inc: cpu.inc_l}].map(({r, ld, inc}) => {

          ld.call(cpu, 0x00);
          let value = r.call(cpu);

          let m = cpu.m();
          inc.call(cpu);

          assert.equal(r.call(cpu), value + 1, 'a incremented.');
          assert.equal(cpu.Z(), 0, 'Z set if result is zero');
          assert.equal(cpu.N(), 0, 'N is always reset');
          assert.equal(cpu.H(), 0, 'H reset as no half carry');
          assert.equal(cpu.m(), m+1, 'INC r machine cycle');

          ld.call(cpu, 0x0f); // Test half carry
          value = r.call(cpu);

          m = cpu.m();
          inc.call(cpu);

          assert.equal(r.call(cpu), value + 1, 'a incremented.');
          assert.equal(cpu.Z(), 0, 'Z set if result is zero');
          assert.equal(cpu.N(), 0, 'N is always reset');
          assert.equal(cpu.H(), 1, 'H set as half carry');
          assert.equal(cpu.m(), m+1, 'INC r machine cycle');

          ld.call(cpu, 0xff); // Test value loop

          m = cpu.m();
          inc.call(cpu);

          assert.equal(r.call(cpu), 0x00, 'a resets to 0x00.');
          assert.equal(cpu.Z(), 1, 'Z set if result is zero');
          assert.equal(cpu.N(), 0, 'N is always reset');
          assert.equal(cpu.H(), 0, 'H reset as no half carry');
          assert.equal(cpu.m(), m+1, 'INC r machine cycle');
        });
      });

      it('should increment memory value at hl 0x00 by 1', () => {
        const addr = 0xc000;
        cpu.ld_hl_nn(addr);
        let value = 0x00;
        cpu.mmu.writeByteAt(addr, value);

        const m = cpu.m();
        cpu.inc_0xhl();

        assert.equal(cpu.mmu.readByteAt(cpu.hl()), value + 1, 'value at memory (hl) incremented.');
        assert.equal(cpu.Z(), 0, 'Z set if result is zero');
        assert.equal(cpu.N(), 0, 'N is always reset');
        assert.equal(cpu.H(), 0, 'H reset as no half carry');
        assert.equal(cpu.m(), m+3, 'INC (HL) machine cycle');

        value = 0x0f; // Test half carry
        cpu.mmu.writeByteAt(addr, value);

        cpu.inc_0xhl();

        assert.equal(cpu.mmu.readByteAt(cpu.hl()), value + 1, 'value at memory (hl) incremented.');
        assert.equal(cpu.Z(), 0, 'Z set if result is zero');
        assert.equal(cpu.N(), 0, 'N is always reset');
        assert.equal(cpu.H(), 1, 'H set as half carry');
        assert.equal(cpu.m(), m+6, 'INC (HL) machine cycle');

        value = 0xff; // Test value loop
        cpu.mmu.writeByteAt(addr, value);

        cpu.inc_0xhl();

        assert.equal(cpu.mmu.readByteAt(cpu.hl()), 0x00, 'value at memory (hl) resets to 0x00.');
        assert.equal(cpu.Z(), 1, 'Z set if result is zero');
        assert.equal(cpu.N(), 0, 'N is always reset');
        assert.equal(cpu.H(), 0, 'H reset as no half carry');
        assert.equal(cpu.m(), m+9, 'INC (HL) machine cycle');
      });
    });

    describe('SUB', () => {

      it('should subtract n from register a', () => {

        [ {ld: cpu.ld_b_n, sub: cpu.sub_b},
          {ld: cpu.ld_c_n, sub: cpu.sub_c},
          {ld: cpu.ld_d_n, sub: cpu.sub_d},
          {ld: cpu.ld_e_n, sub: cpu.sub_e},
          {ld: cpu.ld_h_n, sub: cpu.sub_h},
          {ld: cpu.ld_l_n, sub: cpu.sub_l}].map(({ld, sub}) => {

          cpu.ld_a_n(0x12);
          ld.call(cpu, 0x02);

          let m = cpu.m();
          sub.call(cpu); // Positive result

          assert.equal(cpu.a(), 0x10, `a subtracted two, ${sub.name}`);
          assert.equal(cpu.f(), 0b0100, 'Positive without carries');
          assert.equal(cpu.m() - m, 1, 'SUB r machine cycles');

          cpu.ld_a_n(0x10);
          ld.call(cpu, 0x02);

          sub.call(cpu); // Borrow from bit 4

          assert.equal(cpu.a(), 0x0e, `a subtracted two with half carry, ${sub.name}`);
          assert.equal(cpu.f(), 0b0110, 'Positive with half-carry');

          cpu.ld_a_n(0x0e);
          ld.call(cpu, 0x0e);

          sub.call(cpu);  // Result zero

          assert.equal(cpu.a(), 0x00, `a subtracted 0x0e, ${sub.name}`);
          assert.equal(cpu.f(), 0b1100, 'Zero without carries');

          cpu.ld_a_n(0x05);
          ld.call(cpu, 0x08);

          sub.call(cpu); // Result negative from positive number in a

          assert.equal(cpu.a(), 0xfd, `a loops back to 0xfd, ${sub.name}`);
          assert.equal(cpu.f(), 0b0101, 'Positive with carry');

          cpu.ld_a_n(0x01);
          ld.call(cpu, 0xff);

          sub.call(cpu); // Max subtraction

          assert.equal(cpu.a(), 0x02, 'a loops back to 0x02');
          assert.equal(cpu.f(), 0b0111, 'Positive with carries');
        });
      });

      it('should subtract value at memory location hl from register a', () =>{
        cpu.ld_hl_nn(0xc000);
        cpu.ld_a_n(0x12);
        cpu.ld_0xhl_n(0x02);

        let m = cpu.m();
        cpu.sub_0xhl(); // Positive result

        assert.equal(cpu.a(), 0x10, 'a subtracted two from (hl)');
        assert.equal(cpu.f(), 0b0100, 'Positive without carries');
        assert.equal(cpu.m() - m, 2, 'SUB r machine cycles');

        cpu.ld_a_n(0x10);
        cpu.ld_0xhl_n(0x02);

        cpu.sub_0xhl(); // Borrow from bit 4

        assert.equal(cpu.a(), 0x0e, 'a subtracted two with half carry from (hl)');
        assert.equal(cpu.f(), 0b0110, 'Positive with half-carry');

        cpu.ld_a_n(0x0e);
        cpu.ld_0xhl_n(0x0e);

        cpu.sub_0xhl();  // Result zero

        assert.equal(cpu.a(), 0x00, 'a subtracted 0x0e, from (hl)');
        assert.equal(cpu.f(), 0b1100, 'Zero');

        cpu.ld_a_n(0x05);
        cpu.ld_0xhl_n(0x08);

        cpu.sub_0xhl(); // Result negative from positive number in a

        assert.equal(cpu.a(), 0xfd, 'a loops back to 0xfd, from (hl)');
        assert.equal(cpu.f(), 0b0101, 'Loop therefore carry');

        cpu.ld_a_n(0x01);
        cpu.ld_0xhl_n(0xff);

        cpu.sub_0xhl(); // Max subtraction

        assert.equal(cpu.a(), 0x02, 'a loops back to 0x02 from (hl)');
        assert.equal(cpu.f(), 0b0111, 'Loop with both carries');
      });

      it('should subtract a from a', () => {
        cpu.ld_a_n(0x12);

        const m = cpu.m();
        cpu.sub_a();

        assert.equal(cpu.a(), 0x00, 'a subtracted itself');
        assert.equal(cpu.Z(), 1, 'Result is zero');
        assert.equal(cpu.N(), 1, 'N always set');
        assert.equal(cpu.H(), 1, 'No borrow from bit 4');
        assert.equal(cpu.C(), 0, 'No borrow from carry');
        assert.equal(cpu.m(), m+1, 'SUB r machine cycles');
      });

      it('should subtract n from a', () => {
        cpu.ld_a_n(0x09);

        const m = cpu.m();
        cpu.sub_n(0x04);

        assert.equal(cpu.a(), 0x05, 'a minus n');
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 1, 'N always set');
        assert.equal(cpu.H(), 0, 'No borrow from bit 4');
        assert.equal(cpu.C(), 0, 'No borrow from carry');
        assert.equal(cpu.m(), m+2, 'SUB n machine cycles');
      });
    });

    describe('SBC', () => {
      it('should subtract registers minus carry to register a', () => {

        [ {ld: cpu.ld_b_n, sbc: cpu.sbc_b},
          {ld: cpu.ld_c_n, sbc: cpu.sbc_c},
          {ld: cpu.ld_d_n, sbc: cpu.sbc_d},
          {ld: cpu.ld_e_n, sbc: cpu.sbc_e},
          {ld: cpu.ld_h_n, sbc: cpu.sbc_h},
          {ld: cpu.ld_l_n, sbc: cpu.sbc_l}].map(({ld, sbc}) => {

          cpu._setC(1);
          cpu.ld_a_n(0x10);
          ld.call(cpu, 0x01);
          const m = cpu.m();

          sbc.call(cpu);

          assert.equal(cpu.a(), 0x0e, 'a - b - carry');
          assert.equal(cpu.f(), 0b0110, 'Half carry');
          assert.equal(cpu.m() - m, 1, 'Machine cycles');

          ld.call(cpu, 0x0d);
          cpu._setC(1);

          sbc.call(cpu);

          assert.equal(cpu.a(), 0x00, 'a - b - carry');
          assert.equal(cpu.f(), 0b1100, 'Zero');

          cpu.ld_a_n(0x3b);
          ld.call(cpu, 0x4f);
          cpu._setC(1);

          sbc.call(cpu);

          assert.equal(cpu.a(), 0xeb, 'a - b - carry');
          assert.equal(cpu.f(), 0b0111, 'Zero with half- and carry');
        });
      });

      it('should subtract a to a minus carry', () => {
        cpu._setC(1);
        cpu.ld_a_n(0xaa);
        const m = cpu.m();

        cpu.sbc_a();

        assert.equal(cpu.a(), 0xff, 'a - a - carry');
        assert.equal(cpu.f(), 0b0101, 'Carry');
        assert.equal(cpu.m() - m, 1, 'Machine cycles');

        cpu.ld_a_n(0xaa);
        cpu._setC(0);

        cpu.sbc_a();

        assert.equal(cpu.a(), 0x00, 'a - a - carry');
        assert.equal(cpu.f(), 0b1110, 'Zero with half-carry');
      });

      it('should subtract n minus carry to a', () => {
        cpu._setC(1);
        cpu.ld_a_n(0x09);
        const m = cpu.m();

        cpu.sbc_n(0x04);

        assert.equal(cpu.a(), 0x04, 'a 0x09 minus n 0x04 minus C=1');
        assert.equal(cpu.f(), 0b0100, 'Positive result without carries');
        assert.equal(cpu.m() - m, 2, 'ADD n machine cycles');
      });

      it('should subtract value at memory location hl minus carry to a', () => {
        cpu.ld_hl_nn(0xc000);

        cpu.ld_a_n(0x12);
        cpu.ld_0xhl_n(0x01);
        cpu._setC(1);
        const m = cpu.m();

        cpu.sbc_0xhl(); // Result is positive

        assert.equal(cpu.a(), 0x10, '0x12 - 0x01 - 1');
        assert.equal(cpu.f(), 0b0100, 'Positive result with half-carry');
        assert.equal(cpu.m() - m, 2, 'ADD (HL) machine cycles');

        cpu.ld_a_n(0x11);
        cpu.ld_0xhl_n(0x01);
        cpu._setC(1);

        cpu.sbc_0xhl(); // Test carry from bit 3

        assert.equal(cpu.a(), 0x0f, 'a - (hl) - C');
        assert.equal(cpu.f(), 0b0110, 'Half carry');

        cpu.ld_a_n(0x10);
        cpu.ld_0xhl_n(0x0f);
        cpu._setC(1);

        cpu.sbc_0xhl(); // Test a result zero

        assert.equal(cpu.a(), 0x00, 'a - (hl) - C');
        assert.equal(cpu.f(), 0b1110, 'Zero with carries');

        cpu.ld_a_n(0x00);
        cpu.ld_0xhl_n(0x10);
        cpu._setC(1);

        cpu.sbc_0xhl(); // Result underflows from positive number in a

        assert.equal(cpu.a(), 0xef, 'a 0x00 - 0x10 - 1 underflows to 0xef');
        assert.equal(cpu.f(), 0b0111, 'Positive with both carries');

        cpu.ld_a_n(0x02);
        cpu.ld_0xhl_n(0xff);
        cpu._setC(1);

        cpu.sbc_0xhl(); // Test max addition

        assert.equal(cpu.a(), 0x02, 'a - (HL) - C overflows to 0x02');
        assert.equal(cpu.f(), 0b0111, 'Positive with both carries');
      });
    });

    describe('ADD', () => {

      it('should add registers to register a', () => {

        [ {ld: cpu.ld_b_n, add: cpu.add_b},
          {ld: cpu.ld_c_n, add: cpu.add_c},
          {ld: cpu.ld_d_n, add: cpu.add_d},
          {ld: cpu.ld_e_n, add: cpu.add_e},
          {ld: cpu.ld_h_n, add: cpu.add_h},
          {ld: cpu.ld_l_n, add: cpu.add_l}].map(({ld, add}) => {

          cpu.ld_a_n(0x12);
          ld.call(cpu, 0x02);

          let m = cpu.m();
          add.call(cpu); // Result is positive

          assert.equal(cpu.a(), 0x14, `a 0x12 plus 0x02, ${add.name}`);
          assert.equal(cpu.Z(), 0, 'Result not zero');
          assert.equal(cpu.N(), 0, 'N always reset');
          assert.equal(cpu.H(), 0, 'No carry from bit 3');
          assert.equal(cpu.C(), 0, 'No carry');
          assert.equal(cpu.m(), m + 1, 'ADD r machine cycles');

          cpu.ld_a_n(0x0f);
          ld.call(cpu, 0x01);

          m = cpu.m();
          add.call(cpu); // Test carry from bit 3

          assert.equal(cpu.a(), 0x10, `a 0x0f plus two with half carry, ${add.name}`);
          assert.equal(cpu.Z(), 0, 'Result not zero');
          assert.equal(cpu.N(), 0, 'N always reset');
          assert.equal(cpu.H(), 1, 'Carry from bit 3');
          assert.equal(cpu.C(), 0, 'No carry');
          assert.equal(cpu.m(), m + 1, 'ADD r machine cycles');

          cpu.ld_a_n(0xf0);
          ld.call(cpu, 0x10);

          m = cpu.m();
          add.call(cpu); // Test a result zero

          assert.equal(cpu.a(), 0x00, `a 0xf0 plus 0x10 is zero, ${add.name}`);
          assert.equal(cpu.Z(), 1, 'Result is zero');
          assert.equal(cpu.N(), 0, 'N always reset');
          assert.equal(cpu.H(), 1, 'Carry from bit 3');
          assert.equal(cpu.C(), 1, 'Carry');
          assert.equal(cpu.m(), m + 1, 'ADD r machine cycles');

          cpu.ld_a_n(0xf0);
          ld.call(cpu, 0x12);

          m = cpu.m();
          add.call(cpu); // Result overflows from positive number in a

          assert.equal(cpu.a(), 0x02, `a 0xf0 overflows to 0x02, ${add.name}`);
          assert.equal(cpu.Z(), 0, 'Result not zero');
          assert.equal(cpu.N(), 0, 'N always reset');
          assert.equal(cpu.H(), 1, 'Carry from bit 3');
          assert.equal(cpu.C(), 1, 'Carry');
          assert.equal(cpu.m(), m + 1, 'ADD r machine cycles');

          cpu.ld_a_n(0x02);
          ld.call(cpu, 0xff);

          m = cpu.m();
          add.call(cpu); // Test max addition

          assert.equal(cpu.a(), 0x01, `a 0x02 plus 0xff overflows to 0x01, ${add.name}`);
          assert.equal(cpu.Z(), 0, 'Result not zero');
          assert.equal(cpu.N(), 0, 'N always reset');
          assert.equal(cpu.H(), 1, 'Carry from bit 3');
          assert.equal(cpu.C(), 1, 'Carry');
          assert.equal(cpu.m(), m + 1, 'ADD r machine cycles');
        });
      });

      it('should add value at memory location hl to a', () => {
        cpu.ld_hl_nn(0xc000);
        cpu.ld_a_n(0x12);
        cpu.ld_0xhl_n(0x02);

        let m = cpu.m();
        cpu.add_0xhl(); // Result is positive

        assert.equal(cpu.a(), 0x14, 'a 0x12 plus 0x02');
        assert.equal(cpu.f(), 0b0000, 'Positive without carries');
        assert.equal(cpu.m() - m, 2, 'ADD (HL) machine cycles');

        cpu.ld_a_n(0x0f);
        cpu.ld_0xhl_n(0x01);

        cpu.add_0xhl(); // Test carry from bit 3

        assert.equal(cpu.a(), 0x10, 'a 0x0f plus two with half carry');
        assert.equal(cpu.f(), 0b0010, 'Half carry');

        cpu.ld_a_n(0xf0);
        cpu.ld_0xhl_n(0x10);

        cpu.add_0xhl(); // Test a result zero

        assert.equal(cpu.a(), 0x00, 'a 0xf0 plus 0x10 is zero');
        assert.equal(cpu.f(), 0b1011, 'Zero with carries');

        cpu.ld_a_n(0xf0);
        cpu.ld_0xhl_n(0x12);

        cpu.add_0xhl(); // Result overflows from positive number in a

        assert.equal(cpu.a(), 0x02, 'a 0xf0 overflows to 0x02');
        assert.equal(cpu.f(), 0b0011, 'Positive with carries');

        cpu.ld_a_n(0x02);
        cpu.ld_0xhl_n(0xff);

        cpu.add_0xhl(); // Test max addition

        assert.equal(cpu.a(), 0x01, 'a 0x02 plus 0xff overflows to 0x01');
        assert.equal(cpu.f(), 0b0011, 'Positive with carries');
      });

      it('should add a to a (double a)', () => {
        cpu.ld_a_n(0x12);

        const m = cpu.m();
        cpu.add_a();

        assert.equal(cpu.a(), 0x24, 'a doubles itself');
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 0, 'N always reset');
        assert.equal(cpu.H(), 1, 'Carry from bit 3');
        assert.equal(cpu.C(), 0, 'No carry');
        assert.equal(cpu.m(), m + 1, 'ADD a machine cycles');
      });

      it('should add n to a', () => {
        cpu.ld_a_n(0x09);

        const m = cpu.m();
        cpu.add_n(0x04);

        assert.equal(cpu.a(), 0x0d, 'a 0x09 plus n 0x04');
        assert.equal(cpu.f(), 0b0000, 'Positive without carries');
        assert.equal(cpu.m() - m, 2, 'ADD n machine cycles');
      });
    });

    describe('ADC', () => {
      it('should add registers plus carry to register a', () => {

        [ {ld: cpu.ld_b_n, adc: cpu.adc_b},
          {ld: cpu.ld_c_n, adc: cpu.adc_c},
          {ld: cpu.ld_d_n, adc: cpu.adc_d},
          {ld: cpu.ld_e_n, adc: cpu.adc_e},
          {ld: cpu.ld_h_n, adc: cpu.adc_h},
          {ld: cpu.ld_l_n, adc: cpu.adc_l}].map(({ld, adc}) => {

          cpu._setC(1);
          cpu.ld_a_n(0x00);
          ld.call(cpu, 0x0f);
          const m = cpu.m();

          adc.call(cpu);

          assert.equal(cpu.a(), 0x10, 'a + b + carry');
          assert.equal(cpu.f(), 0b0010, 'Half carry');
          assert.equal(cpu.m() - m, 1, 'Machine cycles');

          ld.call(cpu, 0xef);
          cpu._setC(1);

          adc.call(cpu);

          assert.equal(cpu.a(), 0x00, 'a + b + carry');
          assert.equal(cpu.f(), 0b1011, 'Zero with half- and carry');

          ld.call(cpu, 0x00);
          cpu._setC(1);

          adc.call(cpu);

          assert.equal(cpu.a(), 0x01, 'a + b + carry');
          assert.equal(cpu.f(), 0b0000, 'Positive');
        });
      });

      it('should add a to a (double a) plus carry', () => {
        cpu._setC(1);
        cpu.ld_a_n(0x00);
        const m = cpu.m();

        cpu.adc_a();

        assert.equal(cpu.a(), 0x01, 'a + b + carry');
        assert.equal(cpu.f(), 0b0000, 'No carry');
        assert.equal(cpu.m() - m, 1, 'Machine cycles');

        cpu.ld_a_n(0x0f);
        cpu._setC(1);

        cpu.adc_a();

        assert.equal(cpu.a(), 0x1f, 'a + b + carry');
        assert.equal(cpu.f(), 0b0010, 'Half carry');

        cpu.ld_a_n(0x00);
        cpu._setC(0);

        cpu.adc_a();

        assert.equal(cpu.a(), 0x00, 'a + b + carry');
        assert.equal(cpu.f(), 0b1000, 'Zero');
      });

      it('should add n plus carry to a', () => {
        cpu._setC(1);
        cpu.ld_a_n(0x09);
        const m = cpu.m();

        cpu.adc_n(0x04);

        assert.equal(cpu.a(), 0x0e, 'a 0x09 plus n 0x04 plus C=1');
        assert.equal(cpu.f(), 0b0000, 'Positive without carries');
        assert.equal(cpu.m() - m, 2, 'ADD n machine cycles');
      });

      it('should add value at memory location hl plus carry to a', () => {
        cpu._setC(1);
        cpu.ld_hl_nn(0xc000);
        cpu.ld_a_n(0x12);
        cpu.ld_0xhl_n(0x02);
        const m = cpu.m();

        cpu.adc_0xhl(); // Result is positive

        assert.equal(cpu.a(), 0x15, 'a 0x12 plus 0x02 plus C=1');
        assert.equal(cpu.f(), 0b0000, 'Positive without carries');
        assert.equal(cpu.m() - m, 2, 'ADD (HL) machine cycles');

        cpu._setC(1);
        cpu.ld_a_n(0x0e);
        cpu.ld_0xhl_n(0x01);

        cpu.adc_0xhl(); // Test carry from bit 3

        assert.equal(cpu.a(), 0x10, 'a + (hl) + C');
        assert.equal(cpu.f(), 0b0010, 'Half carry');

        cpu._setC(1);
        cpu.ld_a_n(0xf0);
        cpu.ld_0xhl_n(0x0f);

        cpu.adc_0xhl(); // Test a result zero

        assert.equal(cpu.a(), 0x00, 'a + (hl) + C');
        assert.equal(cpu.f(), 0b1011, 'Zero with carries');

        cpu._setC(1);
        cpu.ld_a_n(0xf0);
        cpu.ld_0xhl_n(0x11);

        cpu.adc_0xhl(); // Result overflows from positive number in a

        assert.equal(cpu.a(), 0x02, 'a 0xf0 + 0x11 + 1 overflows to 0x02');
        assert.equal(cpu.f(), 0b0011, 'Positive with carries');

        cpu._setC(1);
        cpu.ld_a_n(0x02);
        cpu.ld_0xhl_n(0xff);

        cpu.adc_0xhl(); // Test max addition

        assert.equal(cpu.a(), 0x02, 'a + (HL) + C overflows to 0x02');
        assert.equal(cpu.f(), 0b0011, 'Positive with carries');
      });
    });
  });

  describe('16 bits arithmetic', () => {

    describe('ADD', () => {

      it('should add 16 bit register to hl', () => {

        [{ld: cpu.ld_bc_nn, add: cpu.add_hl_bc},
          {ld: cpu.ld_de_nn, add: cpu.add_hl_de},
          {ld: cpu.ld_sp_nn, add: cpu.add_hl_sp}].map(({ld, add}) => {

          cpu.ld_hl_nn(0xc000);
          ld.call(cpu, 0x0001);

          let m = cpu.m();
          add.call(cpu);

          assert.equal(cpu.hl(), 0xc001, `${add.name} to HL results 0xc001`);
          assert.equal(cpu.N(), 0, 'N reset');
          assert.equal(cpu.H(), 0, 'No carry bit 11');
          assert.equal(cpu.C(), 0, 'No carry bit 15');
          assert.equal(cpu.m(), m + 2, `${add.name} machine cycles`);

          // Test half carry, bit 11
          ld.call(cpu, 0x0fff);

          m = cpu.m();
          add.call(cpu);

          assert.equal(cpu.hl(), 0xd000, `${add.name} to HL results 0xd000`);
          assert.equal(cpu.N(), 0, 'N reset');
          assert.equal(cpu.H(), 1, 'Carry from bit 11');
          assert.equal(cpu.C(), 0, 'No carry bit 15');
          assert.equal(cpu.m(), m + 2, `${add.name} machine cycles`);

          // Test carry, bit 15
          ld.call(cpu, 0x3001);

          m = cpu.m();
          add.call(cpu);

          assert.equal(cpu.hl(), 0x0001, `${add.name} to HL results 0x0001`);
          assert.equal(cpu.N(), 0, 'N reset');
          assert.equal(cpu.H(), 0, 'No carry from bit 11');
          assert.equal(cpu.C(), 1, 'Carry bit 15');
          assert.equal(cpu.m(), m + 2, `${add.name} machine cycles`);
        });
      });

      it('should add register hl to itself', () => {
        cpu.ld_hl_nn(0x0001);

        let m = cpu.m();
        cpu.add_hl_hl();

        assert.equal(cpu.hl(), 0x0002, 'ADD HL to itself');
        assert.equal(cpu.N(), 0, 'N reset');
        assert.equal(cpu.H(), 0, 'No carry bit 11');
        assert.equal(cpu.C(), 0, 'No carry bit 15');
        assert.equal(cpu.m(), m + 2, 'ADD hl, hl machine cycles');

        // Test half carry, bit 11
        cpu.ld_hl_nn(0x0fff);

        m = cpu.m();
        cpu.add_hl_hl();

        assert.equal(cpu.hl(), 0x1ffe, 'ADD HL to itself with half carry');
        assert.equal(cpu.N(), 0, 'N reset');
        assert.equal(cpu.H(), 1, 'Carry from bit 11');
        assert.equal(cpu.C(), 0, 'No carry bit 15');
        assert.equal(cpu.m(), m + 2, 'ADD hl, hl machine cycles');

        // Test carry, bit 15
        cpu.ld_hl_nn(0xf000);

        m = cpu.m();
        cpu.add_hl_hl();

        assert.equal(cpu.hl(), 0xe000, 'ADD HL to itself with carry');
        assert.equal(cpu.N(), 0, 'N reset');
        assert.equal(cpu.H(), 0, 'No carry from bit 11');
        assert.equal(cpu.C(), 1, 'Carry bit 15');
        assert.equal(cpu.m(), m + 2, 'ADD hl, hl machine cycles');
      });

      it('should add a signed byte to the Stack Pointer', () => {
        cpu.ld_sp_nn(0xff00);
        const m = cpu.m();

        cpu.add_sp_e(0x01);
        assert.equal(cpu.sp(), 0xff01, 'SP + 1');
        assert.equal(cpu.f(), 0b0000); // ZNHC
        assert.equal(cpu.m() - m, 4, 'Machine cycles');

        cpu.ld_sp_nn(0xff00);
        cpu.add_sp_e(0x7f); // maximum offset +127
        assert.equal(cpu.sp(), 0xff7f, 'SP + 127');
        assert.equal(cpu.f(), 0b0000); // ZNHC

        cpu.ld_sp_nn(0xff00);
        cpu.add_sp_e(0x80); // minimum offset -128
        assert.equal(cpu.sp(), 0xfe80, 'SP - 128');
        assert.equal(cpu.f(), 0b0000); // ZNHC

        cpu.ld_sp_nn(0xff00);
        cpu.add_sp_e(0xfe); // -2
        assert.equal(cpu.sp(), 0xfefe, 'SP - 2');
        assert.equal(cpu.f(), 0b0000); // ZNHC

        cpu.ld_sp_nn(0xffff);
        cpu.add_sp_e(0x01);
        assert.equal(cpu.sp(), 0x0000, 'loop forward');
        assert.equal(cpu.f(), 0b0011); // ZNHC

        cpu.ld_sp_nn(0x0000);
        cpu.add_sp_e(0xff); // -1
        assert.equal(cpu.sp(), 0xffff, 'loop backwards');
        assert.equal(cpu.f(), 0b0000); // ZNHC
      });
    });

    describe('DEC', () => {

      it('should decrement 16 bits registers', () => {

        [{r: cpu.bc, ld: cpu.ld_bc_nn, dec: cpu.dec_bc},
          {r: cpu.de, ld: cpu.ld_de_nn, dec: cpu.dec_de},
          {r: cpu.hl, ld: cpu.ld_hl_nn, dec: cpu.dec_hl},
          {r: cpu.sp, ld: cpu.ld_sp_nn, dec: cpu.dec_sp}].map(({r, ld, dec}) => {

          const value = 0xc000;
          ld.call(cpu, value);
          const m = cpu.m();
          const flags = cpu.f();

          dec.call(cpu);

          assert.equal(r.call(cpu), value - 1, `register ${r.name} decremented`);
          assert.equal(cpu.f(), flags, 'Flags are not affected');
          assert.equal(cpu.m() - m, 2, `DEC ${r.name} machine cycles`);

          ld.call(cpu, 0);

          dec.call(cpu);

          assert.equal(r.call(cpu), 0xffff, `register ${r.name} goes to max`);
          assert.equal(cpu.f(), flags, 'Flags are not affected');
        });

      });
    });

    describe('INC', () => {

      it('should increment 16 bits registers', () => {

        [{r: cpu.bc, ld: cpu.ld_bc_nn, inc: cpu.inc_bc},
          {r: cpu.de, ld: cpu.ld_de_nn, inc: cpu.inc_de},
          {r: cpu.hl, ld: cpu.ld_hl_nn, inc: cpu.inc_hl},
          {r: cpu.sp, ld: cpu.ld_sp_nn, inc: cpu.inc_sp}].map(({r, ld, inc}) => {

          const value = 0xc000;
          ld.call(cpu, value);
          const m = cpu.m();
          const flags = cpu.f();

          inc.call(cpu);

          assert.equal(r.call(cpu), value + 1, `register ${r.name} incremented`);
          assert.equal(cpu.f(), flags, 'Flags are not affected');
          assert.equal(cpu.m() - m, 2, 'Machine cycles');

          ld.call(cpu, 0xffff);

          inc.call(cpu);

          assert.equal(r.call(cpu), 0, `register ${r.name} goes to zero`);
          assert.equal(cpu.f(), flags, 'Flags are not affected');
        });
      });
    });
  });

  describe('General purpose arithmetic', () => {
    it('should adjust to BCD after addition', () => {
      cpu.ld_a_n(0x45);
      cpu.ld_b_n(0x38);
      cpu.add_b();
      const m = cpu.m();

      cpu.daa();

      assert.equal(cpu.a(), 0x83, 'BCD adjusted');
      assert.equal(cpu.f(), 0b0000, 'Flags');
      assert.equal(cpu.m() - m, 1, 'Machine cycles');

      cpu.ld_a_n(0x98);
      cpu._setC(1);

      cpu.daa();

      assert.equal(cpu.a(), 0xf8, 'BCD adjusted');
      assert.equal(cpu.f(), 0b0001, 'Flags');

      cpu.ld_a_n(0x9f);
      cpu._setC(1);

      cpu.daa();

      assert.equal(cpu.a(), 0x05, 'BCD adjusted');
      assert.equal(cpu.f(), 0b0001, 'Flags');

      cpu.ld_a_n(0x90);
      cpu.ld_b_n(0x0a);
      cpu.add_b();

      cpu.daa();

      assert.equal(cpu.a(), 0x00, 'BCD adjusted with zero');
      assert.equal(cpu.f(), 0b1001, 'Flags');
    });

    it('should adjust to BDC after subtraction', () => {
      cpu.ld_a_n(0x20);
      cpu.ld_b_n(0x01);
      cpu.sub_b();

      cpu.daa();

      assert.equal(cpu.a(), 0x19, 'BCD adjusted');
      assert.equal(cpu.f(), 0b0100, 'Flags');

      cpu.ld_a_n(0x83);
      cpu.ld_b_n(0x38);
      cpu.sub_b();

      cpu.daa();

      assert.equal(cpu.a(), 0x45, 'BCD adjusted');
      assert.equal(cpu.f(), 0b0100, 'Flags');
    });

    it('should adjust with half-carry', () => {
      cpu.ld_a_n(0x26);
      cpu._setH(1);
      cpu._setC(0);

      cpu.daa();

      assert.equal(cpu.a(), 0x2c, 'BCD adjusted');
      assert.equal(cpu.f(), 0b0000, 'Flags');
    });

    it('should do nothing on zero', () => {
      cpu.ld_a_n(0x00);
      cpu._setZ(1);
      cpu._setH(0);
      cpu._setC(0);

      cpu.daa();

      assert.equal(cpu.a(), 0x00);
      assert.equal(cpu.f(), 0b1000, 'Flags');
    });

  });

  describe('16 bits loads', () => {

    describe('LD rr,nn', () => {
      it('should load 16 bits into register bc', () => {
        const m = cpu.m();

        cpu.ld_bc_nn(0xabcd);

        assert.equal(cpu.bc(), 0xabcd, 'load 0xabcd into bc');
        assert.equal(cpu.m(), m + 3, 'Machine cycles');
      });

      it('should load 16  bits into register de', () => {
        const m = cpu.m();
        cpu.ld_de_nn(0xabcd);

        assert.equal(cpu.de(), 0xabcd, 'load 0xabcd into de');
        assert.equal(cpu.m(), m + 3, 'Machine cycles');
      });

      it('should load 16 bits into register hl', () => {
        const m = cpu.m();
        cpu.ld_hl_nn(0xabcd);

        assert.equal(cpu.hl(), 0xabcd, 'load 0xabcd into hl');
        assert.equal(cpu.m(), m + 3, 'Machine cycles');
      });

      it('should load 16 bits into stack pointer', () => {
        const m = cpu.m();
        cpu.ld_sp_nn(0xabcd);

        assert.equal(cpu.sp(), 0xabcd, 'load 0xabcd into sp');
        assert.equal(cpu.m(), m+3, 'Machine cycles');
      });
    });

    describe('LD nn, SP', () => {
      it('should load the stack pointer into a given address', () => {
        cpu.ld_sp_nn(0xfff8);
        const m = cpu.m();

        cpu.ld_nn_sp(0xc100);

        assert.equal(cpu.mmu.readByteAt(0xc100), 0xf8);
        assert.equal(cpu.mmu.readByteAt(0xc101), 0xff);
        assert.equal(cpu.m() - m, 5, 'Machine cycles');
      });
    });

    describe('LD SP,HL', () => {
      it('should load hl into the stack pointer', () => {
        cpu.ld_hl_nn(0xffee);
        const m = cpu.m();

        cpu.ld_sp_hl();

        assert.equal(cpu.sp(), 0xffee);
        assert.equal(cpu.m() - m, 2, 'Machine cycles');
      });
    });

    describe('LDHL SP,e', () => {

      it('should load SP + signed int into HL', () => {
        cpu.ld_sp_nn(0xfff8);
        const m = cpu.m();

        cpu.ldhl_sp_n(0x02);

        assert.equal(cpu.hl(), 0xfff8 + 2);
        assert.equal(cpu.f(), 0b0000);
        assert.equal(cpu.m() - m, 3, 'Machine cycles');

        cpu.ldhl_sp_n(0x80); // -128

        assert.equal(cpu.hl(), 0xfff8 - 128);
        assert.equal(cpu.f(), 0b0000);

        cpu.ldhl_sp_n(0x00);

        assert.equal(cpu.hl(), 0xfff8);
        assert.equal(cpu.f(), 0b0000);

        cpu.ldhl_sp_n(0x08);

        assert.equal(cpu.hl(), 0x0000);
        assert.equal(cpu.f(), 0b0011, 'Half- and carry'); // TODO: Z flag?

        cpu.ld_sp_nn(0xefff);
        cpu.ldhl_sp_n(0x01);

        assert.equal(cpu.hl(), 0xf000);
        assert.equal(cpu.f(), 0b0010, 'Half carry');
      });
    });

    describe('PUSH', () => {

      it('should push registers into the stack', () => {
        let m = cpu.m();

        cpu.push_af();

        assert.equal(cpu.mmu.readByteAt(cpu.sp() + 1), cpu.a(), 'store a into stack');
        assert.equal(cpu.mmu.readByteAt(cpu.sp()), cpu.f() << 4, 'store f into stack');
        assert.equal(cpu.m(), m+4, 'Machine cycles');

        m = cpu.m();
        cpu.push_bc();

        assert.equal(cpu.mmu.readByteAt(cpu.sp() + 1), cpu.b(), 'store b into stack');
        assert.equal(cpu.mmu.readByteAt(cpu.sp()), cpu.c(), 'store c into stack');
        assert.equal(cpu.m(), m+4, 'Machine cycles');

        m = cpu.m();
        cpu.push_de();

        assert.equal(cpu.mmu.readByteAt(cpu.sp() + 1), cpu.d(), 'store d into stack');
        assert.equal(cpu.mmu.readByteAt(cpu.sp()), cpu.e(), 'store e into stack');
        assert.equal(cpu.m(), m+4, 'Machine cycles');

        m = cpu.m();
        cpu.push_hl();

        assert.equal(cpu.mmu.readByteAt(cpu.sp() + 1), cpu.h(), 'store h into stack');
        assert.equal(cpu.mmu.readByteAt(cpu.sp()), cpu.l(), 'store l into stack');
        assert.equal(cpu.m(), m+4, 'Machine cycles');
      });
    });

    describe('POP', () => {

      it('should pop registers into the stack', () => {
        [ {r: cpu.af, pop: cpu.pop_af},
          {r: cpu.bc, pop: cpu.pop_bc},
          {r: cpu.de, pop: cpu.pop_de},
          {r: cpu.hl, pop: cpu.pop_hl}].map(({r, pop}) => {

          let sp = cpu.sp(); // sp: 0xfffe
          cpu.mmu.writeByteAt(--sp, 0xab); // sp: 0xfffd
          cpu.mmu.writeByteAt(--sp, 0xcd); // sp: 0xfffc
          cpu.ld_sp_nn(sp);

          const m = cpu.m();
          pop.call(cpu);

          if (r === cpu.af){
            // Special case. Hidden lower bits from f should be zero
            assert.equal(r.call(cpu), 0xabc0, `Pop into ${r.name}`);
          } else {
            assert.equal(r.call(cpu), 0xabcd, `Pop into ${r.name}`);
          }
          assert.equal(cpu.sp(), sp + 2, 'sp incremented twice');
          assert.equal(cpu.m(), m+3, 'Pop rr machine cycles');
        });
      });
    });

    describe('PUSH-POP with AF', () => {

      it('should pop and push flags accordingly', () => {
        cpu.ld_sp_nn(0xdffd);
        cpu.ld_bc_nn(0x1301);

        cpu.push_bc();

        assert.equal(cpu.mmu.readByteAt(cpu.sp() + 1), cpu.b(), 'store b into stack');
        assert.equal(cpu.mmu.readByteAt(cpu.sp()), cpu.c(), 'store c into stack');

        cpu.pop_af();

        assert.equal(cpu.a(), 0x13);
        assert.equal(cpu.f(), 0, 'should not load 0x01 in flags!!');

        cpu.push_af();
        cpu.pop_bc();

        assert.equal(cpu.b(), 0x13);
        assert.equal(cpu.c(), 0x00, 'not 0x01!');
      })

    });
  });

  describe('8 bits loads', () => {
    it('should load 8 bits into registers', () => {

      [ {r: cpu.a, ld: cpu.ld_a_n},
        {r: cpu.b, ld: cpu.ld_b_n},
        {r: cpu.c, ld: cpu.ld_c_n},
        {r: cpu.d, ld: cpu.ld_d_n},
        {r: cpu.e, ld: cpu.ld_e_n},
        {r: cpu.h, ld: cpu.ld_h_n},
        {r: cpu.l, ld: cpu.ld_l_n}].map( ({r, ld}) => {
          const m = cpu.m();

          ld.call(cpu, 0xab);

          assert.equal(r.call(cpu), 0xab, `load 0xab into ${r.name}`);
          assert.equal(cpu.m(), m + 2, `${ld.name} machine cycles`);
      });
    });

    it('should load registers into register other registers', () => {

      ['a', 'b', 'c', 'd', 'e', 'h', 'l'].map( (r1) => {
        ['a', 'b', 'c', 'd', 'e', 'h', 'l'].map( (r2) => {
          const value = cpu[r2].call(cpu);
          const func = `ld_${r1}_${r2}`;
          assert.ok(cpu[func], `${func} does not exist`);
          const m = cpu.m();

          cpu[func].call(cpu);

          assert.equal(cpu[r1].call(cpu), value, `load ${r2} into ${r1}`);
          assert.equal(cpu.m(), m + 1, `${func} machine cycles`);
        });
      });
    });

    it('should load value at memory hl into registers', () => {
      ['a', 'b', 'c', 'd', 'e', 'h', 'l'].map( (r) => {
        cpu.ld_hl_nn(0xc000);
        cpu.mmu.writeByteAt(cpu.hl(), 0xab);
        const func = `ld_${r}_0xhl`;
        assert.ok(cpu[func], `${func} does not exist`);
        const m = cpu.m();

        cpu[func].call(cpu);

        assert.equal(cpu[r].call(cpu), 0xab, `load (hl) into ${r}`);
        assert.equal(cpu.m(), m + 2, `${func} machine cycles`);
      });
    });

    it('should copy memory locations into register a', () => {
      [{r2: cpu.bc, r1: cpu.a, ld: cpu.ld_a_0xbc},
        {r2: cpu.de, r1: cpu.a, ld: cpu.ld_a_0xde},
        {r2: cpu.hl, r1: cpu.a, ld: cpu.ld_a_0xhl}].map(({r2, r1, ld}) => {

        const value = cpu.mmu.readByteAt(r2.call(cpu));
        const m = cpu.m();

        ld.call(cpu);

        assert.equal(r1.call(cpu), value, `load ${r2.name} into ${r1.name}`);
        assert.equal(cpu.m(), m + 2, `${ld.name} machine cycles`);
      });
    });

    it('should copy the value at memory location into a', () => {
      const value = cpu.mmu.readByteAt(0xabcd);
      const m = cpu.m();

      cpu.ld_a_nn(0xabcd);

      assert.equal(cpu.a(), value, 'load value at memory 0xabcd into a');
      assert.equal(cpu.m(), m + 4, 'LD a,(nn) machine cycles');
    });

    it('should put memory address hl into a and decrement hl', () => {
      const hl = cpu.hl();
      const value = cpu.mmu.readByteAt(hl);
      const m = cpu.m();

      cpu.ldd_a_0xhl();

      assert.equal(cpu.a(), value, `register a has memory value ${value}`);
      assert.equal(cpu.hl(), hl - 1, 'hl is decremented 1');
      assert.equal(cpu.m(), m + 2, 'LDD a,(hl) machine cycles');
    });

    it('should put a into memory address hl and decrement hl', () => {
      const a = cpu.a();
      const hl = 0xdfff;
      cpu.ld_hl_nn(hl);
      const m = cpu.m();

      cpu.ldd_0xhl_a();

      assert.equal(cpu.mmu.readByteAt(hl), a, `memory ${Utils.hexStr(hl)} has value ${a}`);
      assert.equal(cpu.hl(), hl - 1, 'hl is decremented by 1');
      assert.equal(cpu.m(), m + 2, 'LDD (HL),a machine cycles');
    });

    it('should load value at memory address hl into a and increment hl', () => {
      const hl = 0xc000;
      cpu.ld_hl_nn(hl);
      cpu.mmu.writeByteAt(hl, 0xf1);
      const m = cpu.m();

      cpu.ldi_a_0xhl();

      assert.equal(cpu.a(), 0xf1, `register a has value 0xf1`);
      assert.equal(cpu.hl(), hl + 1, 'hl is incremented by 1');
      assert.equal(cpu.m() - m, 2, 'LDI a,(hl) machine cycles');
    });

    it('should put a into memory address 0xff00 + 3', () => {
      cpu.ld_a_n(0xab);
      const m = cpu.m();

      cpu.ldh_n_a(3);

      assert.equal(cpu.mmu.readByteAt(0xff03), 0xab, 'memory 0xff00 has value 0xab');
      assert.equal(cpu.m() - m, 3, 'LD (ff00+n),a machine cycles');
    });

    it('should put a into memory address 0xff00 + 0xfe', () => {
      cpu.ld_a_n(0xab);
      const m = cpu.m();

      cpu.ldh_n_a(0xfe);

      assert.equal(cpu.mmu.readByteAt(0xfffe), 0xab, 'memory 0xfffe has value 0xab');
      assert.equal(cpu.m() - m, 3, 'LD (ff00+n),a machine cycles');
    });

    it('should write a into address 0xff00 + 0xff', () => {
      cpu.ld_a_n(0x01);
      const m = cpu.m();

      cpu.ldh_n_a(0xff);

      assert.equal(cpu.mmu.readByteAt(0xffff), 0x01, 'value at memory 0xffff has value 0xab');
      assert.equal(cpu.m() - m, 3, 'LD (ff00+n),a machine cycles');
      assert.equal(cpu.ie(), 0x01);
    });

    it('should put value at memory address 0xff00 + 0 into a', () => {
      const value = cpu.mmu.readByteAt(0xff00);
      const m = cpu.m();

      cpu.ldh_a_n(0);

      assert.equal(cpu.a(), value, '(0xff00) into a');
      assert.equal(cpu.m(), m + 3, 'LD a,(ff00+n) machine cycles');
    });

    it('should put value at memory address 0xff00 + 0xfe into a', () => {
      const value = cpu.mmu.readByteAt(0xff00 + 0xfe);
      const m = cpu.m();

      cpu.ldh_a_n(0xfe);

      assert.equal(cpu.a(), value, '(0xfffe) into a');
      assert.equal(cpu.m(), m + 3, 'LD a,(ff00+n) machine cycles');
    });

    it('should put value at memory address 0xff00 + 0xff into a', () => {
      const value = cpu.mmu.readByteAt(0xff00 + 0xff);
      const m = cpu.m();

      cpu.ldh_a_n(0xff);

      assert.equal(cpu.a(), value, '(0xffff) into a');
      assert.equal(cpu.m(), m + 3, 'LD a,(ff00+n) machine cycles');
    });

    it('should put a into memory address 0xff00 + c', () => {
      const value = 0xab;
      const offset = 0x44; // ly
      cpu.ld_c_n(offset);
      cpu.ld_a_n(value);
      const m = cpu.m();

      cpu.ld_0xc_a();

      assert.equal(cpu.mmu.readByteAt(0xff00 + offset), value, 'value at memory address 0xff00 + c');
      assert.equal(cpu.m(), m + 2, 'LD (ff00+c),a machine cycles');
    });

    it('should write in memory address 0xff00 + 0xff', () => {
      const offset = 0xff;
      const value = 0x0f;
      cpu.ld_c_n(offset);
      cpu.ld_a_n(value);
      const m = cpu.m();

      cpu.ld_0xc_a();
    
      assert.equal(cpu.mmu.readByteAt(0xff00 + offset), value, '0xffff is written');
      assert.equal(cpu.m(), m + 2, 'LD (ff00+c),a machine cycles');
      assert.equal(cpu.ie(), value, 'ie is written');
    });

    it('should write memory address 0xff00 + c into register a', () => {
      cpu.mmu.writeByteAt(0xff44, 0xab);
      cpu.ld_c_n(0x44); // ly
      const m = cpu.m();

      cpu.ld_a_0xc();

      assert.equal(cpu.a(), 0xab);
      assert.equal(cpu.m() - m, 2, 'Machine cycles');
    });

    it('should copy register a into memory locations', () => {
      cpu.ld_a_n(0xab);
      cpu.ld_bc_nn(0xc000);
      cpu.ld_de_nn(0xc001);
      cpu.ld_hl_nn(0xc002);
      const nn = 0xc003;

      let m = cpu.m();
      cpu.ld_0xbc_a();

      assert.equal(cpu.mmu.readByteAt(cpu.bc()), cpu.a(), 'copy a to memory location bc');
      assert.equal(cpu.m(), m+2, 'LD (bc),a machine cycles');

      m = cpu.m();
      cpu.ld_0xde_a();

      assert.equal(cpu.mmu.readByteAt(cpu.de()), cpu.a(), 'copy a to memory location de');
      assert.equal(cpu.m(), m+2, 'LD (de),a machine cycles');

      m = cpu.m();
      cpu.ld_0xhl_a();

      assert.equal(cpu.mmu.readByteAt(cpu.hl()), cpu.a(), 'copy a to memory location hl');
      assert.equal(cpu.m(), m+2, 'LD (hl),a machine cycles');

      m = cpu.m();
      cpu.ld_0xnn_a(nn);

      assert.equal(cpu.mmu.readByteAt(nn), cpu.a(), 'copy a to memory location nn');
      assert.equal(cpu.m(), m+4, 'LD (nn),a machine cycles');
    });

    it('should load a into memory address hl and increment hl', () => {
      const value = 0xab;
      const addr = 0xc000;
      cpu.ld_a_n(value);
      cpu.ld_hl_nn(addr);
      const m = cpu.m();

      cpu.ldi_0xhl_a();

      assert.equal(cpu.mmu.readByteAt(addr), value, 'Regiter a into (hl)');
      assert.equal(cpu.hl(), addr + 1, 'hl incremented');
      assert.equal(cpu.m(), m + 2, 'LDI (hl),a machine cycles');
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
          const m = cpu.m();

          ld_0xhl.call(cpu);

          assert.equal(cpu.mmu.readByteAt(0xc000), 0xc0, `${ld_0xhl.name} applied.`);
          assert.equal(cpu.m(), m + 2, `${ld_0xhl.name} machine cycles`);
      });
    });

    it('should load value nn into memory address hl', () => {
      cpu.ld_hl_nn(0xc000);
      const m = cpu.m();

      cpu.ld_0xhl_n(0x01);

      assert.equal(cpu.mmu.readByteAt(0xc000), 0x01, 'loaded n into memory location hl');
      assert.equal(cpu.m(), m + 3, 'LD (hl),n machine cycles');
    });

  });

  describe('Bit operations', () => {

    it('should test bits', () => {
      cpu._setC(0);
      ['a', 'b', 'c', 'd', 'e', 'h', 'l'].map( (r) => {

        cpu[`ld_${r}_n`].call(cpu, 0b01010101);

        for(let b = 0; b < 8; b++) {
          const func = `bit_${b}_${r}`;
          const m = cpu.m();

          cpu[func].call(cpu); // test bit b

          if (b % 2 === 0){
            assert.equal(cpu.f(), 0b0010, 'Even are ones');
          } else {
            assert.equal(cpu.f(), 0b1010, 'Non even are zeros');
          }
          assert.equal(cpu.m() - m, 2, `${func} machine cycles`);
        }
      });
    });

    it('should test bits at memory location hl', () => {
      cpu.ld_hl_nn(0xc000);
      cpu.ld_0xhl_n(0xff);
      cpu._setC(0);

      for(let b = 0; b < 8; b++){
        const m = cpu.m();

        cpu[`bit_${b}_0xhl`].call(cpu);
        
        assert.equal(cpu.f(), 0b0010, 'Not zero');
        assert.equal(cpu.m() - m, 3, 'Machine cycles');
      }
    });

    it('should reset bits', () => {
      ['a', 'b', 'c', 'd', 'e', 'h', 'l'].map( (r) => {

        cpu[`ld_${r}_n`].call(cpu, 0xff);

        for(let b = 0; b < 8; b++) {
          const m = cpu.m();

          cpu[`res_${b}_${r}`](); // reset bit b

          assert.equal(cpu.m() - m, 2, 'Machine cycles');
        }

        assert.equal(cpu[r].call(cpu), 0x00, `RES b,${r} 0..b..7 resets all bits`);
      });
    });

    it('should reset a single bit', () => {
      cpu.ld_a_n(0xff);
      const m = cpu.m();

      cpu.res_0_a();

      assert.equal(cpu.a(), 0xfe, 'Reset bit 0');
      assert.equal(cpu.m(), m + 2, 'RES 0,a machine cycles');
    });

    it('should reset bits at memory location hl', () => {

      cpu.ld_hl_nn(0xc000);
      cpu.mmu.writeByteAt(cpu.hl(), 0xff);

      cpu.res_0_0xhl();

      assert.equal(cpu._0xhl(), 0b11111110, 'Reset bit 0');

      cpu.res_4_0xhl();

      assert.equal(cpu._0xhl(), 0b11101110, 'Reset bit 4');

      cpu.res_7_0xhl();

      assert.equal(cpu._0xhl(), 0b01101110, 'Reset bit 7');
    });

    it('should set bits in registers', () => {
      ['a', 'b', 'c', 'd', 'e', 'h', 'l'].map( (r) => {

        cpu[`ld_${r}_n`].call(cpu, 0x00);

        cpu[`set_0_${r}`].call(cpu);
        assert.equal(cpu[r].call(cpu), 0b00000001);

        cpu[`set_1_${r}`].call(cpu);
        assert.equal(cpu[r].call(cpu), 0b00000011);

        cpu[`set_2_${r}`].call(cpu);
        assert.equal(cpu[r].call(cpu), 0b00000111);

        cpu[`set_3_${r}`].call(cpu);
        assert.equal(cpu[r].call(cpu), 0b00001111);

        cpu[`set_4_${r}`].call(cpu);
        assert.equal(cpu[r].call(cpu), 0b00011111);

        cpu[`set_5_${r}`].call(cpu);
        assert.equal(cpu[r].call(cpu), 0b00111111);

        cpu[`set_6_${r}`].call(cpu);
        assert.equal(cpu[r].call(cpu), 0b01111111);

        cpu[`set_7_${r}`].call(cpu);
        assert.equal(cpu[r].call(cpu), 0b11111111);

      });
    });

    it('should set bits at memory location hl', () => {
      cpu.ld_hl_nn(0xc000);
      cpu.mmu.writeByteAt(cpu.hl(), 0x00);

      cpu.set_0_0xhl();
      assert.equal(cpu._0xhl(), 0b00000001);

      cpu.set_1_0xhl();
      assert.equal(cpu._0xhl(), 0b00000011);

      cpu.set_2_0xhl();
      assert.equal(cpu._0xhl(), 0b00000111);

      cpu.set_3_0xhl();
      assert.equal(cpu._0xhl(), 0b00001111);

      cpu.set_4_0xhl();
      assert.equal(cpu._0xhl(), 0b00011111);

      cpu.set_5_0xhl();
      assert.equal(cpu._0xhl(), 0b00111111);

      cpu.set_6_0xhl();
      assert.equal(cpu._0xhl(), 0b01111111);

      cpu.set_7_0xhl();
      assert.equal(cpu._0xhl(), 0b11111111);

    });

  });

  describe('Calls', () => {

    describe('CALL', () => {
      it('should call a routine', () => {
        const pc = cpu.pc();
        const sp = cpu.sp();
        const addr = 0x1234;
        const m = cpu.m();

        cpu.call(addr);

        assert.equal(cpu.mmu.readByteAt(sp - 1), Utils.msb(pc), 'store the lsb into stack');
        assert.equal(cpu.mmu.readByteAt(sp - 2), Utils.lsb(pc), 'store the msb into stack');
        assert.equal(cpu.sp(), sp - 2, 'sp moved down 2 bytes');
        assert.equal(cpu.pc(), addr, 'jump to address');
        assert.equal(cpu.m(), m + 6, 'CALL machine cycles');
      });
    });

    describe('CALL NZ,Z,NC,C', () => {

      it('should call a routine if last result was not zero', () => {
        const pc = cpu.pc();
        const sp = cpu.sp();
        const addr = 0x1234;
        cpu._setZ(1);
        let m = cpu.m();

        cpu.call_nz(addr);

        assert.equal(cpu.m() - m, 3, 'Machine cycles when not calling');
        assert.equal(cpu.pc(), pc, 'Does not call');

        cpu._setZ(0);
        m = cpu.m();

        cpu.call_nz(addr);

        assert.equal(cpu.m() - m, 6, 'Machine cycles when calling');
        assert.equal(cpu.mmu.readByteAt(sp - 1), Utils.msb(pc), 'store the lsb into stack');
        assert.equal(cpu.mmu.readByteAt(sp - 2), Utils.lsb(pc), 'store the msb into stack');
        assert.equal(cpu.sp(), sp - 2, 'sp moved down 2 bytes');
        assert.equal(cpu.pc(), addr, 'jump to address');
      });

      it('should call a routine if last result was zero', () => {
        const pc = cpu.pc();
        const sp = cpu.sp();
        const addr = 0x1234;
        cpu._setZ(0);
        let m = cpu.m();

        cpu.call_z(addr);

        assert.equal(cpu.m() - m, 3, 'Machine cycles when not calling');
        assert.equal(cpu.pc(), pc, 'Does not call');

        cpu._setZ(1);
        m = cpu.m();

        cpu.call_z(addr);

        assert.equal(cpu.m() - m, 6, 'Machine cycles when calling');
        assert.equal(cpu.mmu.readByteAt(sp - 1), Utils.msb(pc), 'store the lsb into stack');
        assert.equal(cpu.mmu.readByteAt(sp - 2), Utils.lsb(pc), 'store the msb into stack');
        assert.equal(cpu.sp(), sp - 2, 'sp moved down 2 bytes');
        assert.equal(cpu.pc(), addr, 'jump to address');
      });

      it('should call a routine if last result did not carry', () => {
        const pc = cpu.pc();
        const sp = cpu.sp();
        const addr = 0x1234;
        cpu._setC(1);
        let m = cpu.m();

        cpu.call_nc(addr);

        assert.equal(cpu.m() - m, 3, 'Machine cycles when not calling');
        assert.equal(cpu.pc(), pc, 'Does not call');

        cpu._setC(0);
        m = cpu.m();

        cpu.call_nc(addr);

        assert.equal(cpu.m() - m, 6, 'Machine cycles when calling');
        assert.equal(cpu.mmu.readByteAt(sp - 1), Utils.msb(pc), 'store the lsb into stack');
        assert.equal(cpu.mmu.readByteAt(sp - 2), Utils.lsb(pc), 'store the msb into stack');
        assert.equal(cpu.sp(), sp - 2, 'sp moved down 2 bytes');
        assert.equal(cpu.pc(), addr, 'jump to address');
      });

      it('should call a routine if last result carried', () => {
        const pc = cpu.pc();
        const sp = cpu.sp();
        const addr = 0x1234;
        cpu._setC(0);
        let m = cpu.m();

        cpu.call_c(addr);

        assert.equal(cpu.m() - m, 3, 'Machine cycles when not calling');
        assert.equal(cpu.pc(), pc, 'Does not call');

        cpu._setC(1);
        m = cpu.m();

        cpu.call_c(addr);

        assert.equal(cpu.m() - m, 6, 'Machine cycles when calling');
        assert.equal(cpu.mmu.readByteAt(sp - 1), Utils.msb(pc), 'store the lsb into stack');
        assert.equal(cpu.mmu.readByteAt(sp - 2), Utils.lsb(pc), 'store the msb into stack');
        assert.equal(cpu.sp(), sp - 2, 'sp moved down 2 bytes');
        assert.equal(cpu.pc(), addr, 'jump to address');
      });

    });

  });

  describe('Rotates and Shifts', () => {

    describe('Rotates', () => {

      describe('RL', () => {
        it('should rotate registers left', () => {

          [ {r: cpu.a, ld: cpu.ld_a_n, rl: cpu.rla},
            {r: cpu.a, ld: cpu.ld_a_n, rl: cpu.rl_a},
            {r: cpu.b, ld: cpu.ld_b_n, rl: cpu.rl_b},
            {r: cpu.c, ld: cpu.ld_c_n, rl: cpu.rl_c},
            {r: cpu.d, ld: cpu.ld_d_n, rl: cpu.rl_d},
            {r: cpu.e, ld: cpu.ld_e_n, rl: cpu.rl_e},
            {r: cpu.h, ld: cpu.ld_h_n, rl: cpu.rl_h},
            {r: cpu.l, ld: cpu.ld_l_n, rl: cpu.rl_l},
            {r: cpu.$hl, ld: cpu.ld_0xhl_n, rl: cpu.rl_0xhl}].map(({r, ld, rl}) => {

              cpu.ld_hl_nn(cpu.mmu.ADDR_WRAM_START);
              let cycles = 2;
              if (rl === cpu.rla) cycles = 1;
              if (rl === cpu.rl_0xhl) cycles = 4;
              cpu._setC(0);
              ld.call(cpu, 0b10000000);
              const m = cpu.m();

              rl.call(cpu);

              assert.equal(r.call(cpu), 0x00, `${r.name} rotated left`);
              assert.equal(cpu.f(), 0b1001, 'Zero result with carry');
              assert.equal(cpu.m() - m, cycles, `RL ${r.name} machine cycles`);

              rl.call(cpu);

              assert.equal(r.call(cpu), 0b00000001, `${r.name} rotated left taking from carry`);
              assert.equal(cpu.f(), 0b0000, 'Positive result without carry');
          });
        });
      });

      describe('RLC', () => {
        it('should rotate register to the left and copy to carry', () => {

          [ {r: cpu.a, ld: cpu.ld_a_n, rlc: cpu.rlca},
            {r: cpu.a, ld: cpu.ld_a_n, rlc: cpu.rlc_a},
            {r: cpu.b, ld: cpu.ld_b_n, rlc: cpu.rlc_b},
            {r: cpu.c, ld: cpu.ld_c_n, rlc: cpu.rlc_c},
            {r: cpu.d, ld: cpu.ld_d_n, rlc: cpu.rlc_d},
            {r: cpu.e, ld: cpu.ld_e_n, rlc: cpu.rlc_e},
            {r: cpu.h, ld: cpu.ld_h_n, rlc: cpu.rlc_h},
            {r: cpu.l, ld: cpu.ld_l_n, rlc: cpu.rlc_l},
            {r: cpu.$hl, ld: cpu.ld_0xhl_n, rlc: cpu.rlc_0xhl}].map(({r, ld, rlc}) => {

            cpu.ld_hl_nn(cpu.mmu.ADDR_WRAM_START);
            let cycles = 2;
            if (rlc === cpu.rlca) cycles = 1;
            if (rlc === cpu.rlc_0xhl) cycles = 4;
            cpu._setC(0);
            ld.call(cpu, 0b10000101);
            const m = cpu.m();

            rlc.call(cpu);

            assert.equal(r.call(cpu), 0b00001011, `${rlc.name} rotates left`);
            assert.equal(cpu.f(), 0b0001, 'bit 7 copied to carry');
            assert.equal(cpu.m() - m, cycles, 'Machine cycles');

            rlc.call(cpu);

            assert.equal(r.call(cpu), 0b00010110, `${rlc.name} rotates left`);
            assert.equal(cpu.f(), 0b0000, 'bit 7 copied to carry');

            ld.call(cpu, 0x00);

            rlc.call(cpu);

            assert.equal(r.call(cpu), 0x00, 'Identical');
            assert.equal(cpu.f(), 0b1000, 'Zero result without carry');
          });
        });
      });

      describe('RR', () => {
        it('should rotate registers right', () => {

          [ {r: cpu.a, ld: cpu.ld_a_n, rr: cpu.rra},
            {r: cpu.a, ld: cpu.ld_a_n, rr: cpu.rr_a},
            {r: cpu.b, ld: cpu.ld_b_n, rr: cpu.rr_b},
            {r: cpu.c, ld: cpu.ld_c_n, rr: cpu.rr_c},
            {r: cpu.d, ld: cpu.ld_d_n, rr: cpu.rr_d},
            {r: cpu.e, ld: cpu.ld_e_n, rr: cpu.rr_e},
            {r: cpu.h, ld: cpu.ld_h_n, rr: cpu.rr_h},
            {r: cpu.l, ld: cpu.ld_l_n, rr: cpu.rr_l},
            {r: cpu.$hl, ld: cpu.ld_0xhl_n, rr: cpu.rr_0xhl}].map(({r, ld, rr}) => {

            cpu.ld_hl_nn(cpu.mmu.ADDR_WRAM_START);
            let cycles = 2;
            if (rr === cpu.rra) cycles = 1;
            if (rr === cpu.rr_0xhl) cycles = 4;
            cpu._setC(0);
            ld.call(cpu, 0x01);
            const m = cpu.m();

            rr.call(cpu);

            assert.equal(r.call(cpu), 0x00, `${r.name} rotated right`);
            assert.equal(cpu.f(), 0b1001, 'Zero result with carry');
            assert.equal(cpu.m() - m, cycles, `Machine cycles`);

            rr.call(cpu);

            assert.equal(r.call(cpu), 0x80, `${r.name} rotated right taking from carry`);
            assert.equal(cpu.f(), 0b0000, 'Positive result without carry');
          });
        });
      });

      describe('RRC, RRCA', () => {
        it('should rotate register right and copy to carry', () => {

          [ {r: cpu.a, ld: cpu.ld_a_n, rrc: cpu.rrca},
            {r: cpu.a, ld: cpu.ld_a_n, rrc: cpu.rrc_a},
            {r: cpu.b, ld: cpu.ld_b_n, rrc: cpu.rrc_b},
            {r: cpu.c, ld: cpu.ld_c_n, rrc: cpu.rrc_c},
            {r: cpu.d, ld: cpu.ld_d_n, rrc: cpu.rrc_d},
            {r: cpu.e, ld: cpu.ld_e_n, rrc: cpu.rrc_e},
            {r: cpu.h, ld: cpu.ld_h_n, rrc: cpu.rrc_h},
            {r: cpu.l, ld: cpu.ld_l_n, rrc: cpu.rrc_l},
            {r: cpu.$hl, ld: cpu.ld_0xhl_n, rrc: cpu.rrc_0xhl}].map(({r, ld, rrc}) => {

            cpu.ld_hl_nn(cpu.mmu.ADDR_WRAM_START);
            let cycles = 2;
            if (rrc === cpu.rrca) cycles = 1;
            if (rrc === cpu.rrc_0xhl) cycles = 4;
            cpu._setC(0);
            ld.call(cpu, 0b10000101);
            const m = cpu.m();

            rrc.call(cpu);

            assert.equal(r.call(cpu), 0b11000010, `${rrc.name} rotates right`);
            assert.equal(cpu.f(), 0b0001, 'bit 0 copied to carry');
            assert.equal(cpu.m() - m, cycles, `${rrc.name} Machine cycles`);

            rrc.call(cpu);

            assert.equal(r.call(cpu), 0b01100001, `${rrc.name} rotates right`);
            assert.equal(cpu.f(), 0b0000, 'bit 0 copied to carry');

            ld.call(cpu, 0x00);

            rrc.call(cpu);

            assert.equal(r.call(cpu), 0x00, 'Identical');
            assert.equal(cpu.f(), 0b1000, 'Zero result without carry');
          });
        });
      });
    });

    describe('Shifts', () => {

      describe('SLA', () => {
        it('should shift registers to the left', () => {

          [ {r: cpu.a, ld: cpu.ld_a_n, sla: cpu.sla_a},
            {r: cpu.b, ld: cpu.ld_b_n, sla: cpu.sla_b},
            {r: cpu.c, ld: cpu.ld_c_n, sla: cpu.sla_c},
            {r: cpu.d, ld: cpu.ld_d_n, sla: cpu.sla_d},
            {r: cpu.e, ld: cpu.ld_e_n, sla: cpu.sla_e},
            {r: cpu.h, ld: cpu.ld_h_n, sla: cpu.sla_h},
            {r: cpu.l, ld: cpu.ld_l_n, sla: cpu.sla_l},
            {r: cpu.$hl, ld: cpu.ld_0xhl_n, sla: cpu.sla_0xhl}].map(({r, ld, sla}) => {

            cpu.ld_hl_nn(cpu.mmu.ADDR_WRAM_START);
            let cycles = 2;
            if (sla === cpu.sla_0xhl) cycles = 4;
            ld.call(cpu, 0b01100000);
            const m = cpu.m();

            sla.call(cpu);

            assert.equal(r.call(cpu), 0b11000000, 'Shifted left');
            assert.equal(cpu.f(), 0b0000, 'No carry');
            assert.equal(cpu.m() - m, cycles, 'Machine cycles');

            sla.call(cpu);

            assert.equal(r.call(cpu), 0b10000000, 'Shifted left');
            assert.equal(cpu.f(), 0b0001, 'Carry');

            sla.call(cpu);

            assert.equal(r.call(cpu), 0b00000000, 'Shifted left');
            assert.equal(cpu.f(), 0b1001, 'Zero result with carry');

            sla.call(cpu);

            assert.equal(r.call(cpu), 0b00000000, 'Shifted left');
            assert.equal(cpu.f(), 0b1000, 'Zero result without carry');
          });
        });
      });

      describe('SRL', () => {
        it('should shift registers to the right', () => {

          [ {r: cpu.a, ld: cpu.ld_a_n, srl: cpu.srl_a},
            {r: cpu.b, ld: cpu.ld_b_n, srl: cpu.srl_b},
            {r: cpu.c, ld: cpu.ld_c_n, srl: cpu.srl_c},
            {r: cpu.d, ld: cpu.ld_d_n, srl: cpu.srl_d},
            {r: cpu.e, ld: cpu.ld_e_n, srl: cpu.srl_e},
            {r: cpu.h, ld: cpu.ld_h_n, srl: cpu.srl_h},
            {r: cpu.l, ld: cpu.ld_l_n, srl: cpu.srl_l},
            {r: cpu.$hl, ld: cpu.ld_0xhl_n, srl: cpu.srl_0xhl}].map(({r, ld, srl}) => {

            cpu.ld_hl_nn(cpu.mmu.ADDR_WRAM_START);
            let cycles = 2;
            if (srl === cpu.srl_0xhl) cycles = 4;
            cpu._setC(0);
            ld.call(cpu, 0b00000110);
            const m = cpu.m();

            srl.call(cpu);

            assert.equal(r.call(cpu), 0b00000011, `${srl.name} shifts right`);
            assert.equal(cpu.f(), 0b0000, 'No carry');
            assert.equal(cpu.m() - m, cycles, 'Machine cycles');

            srl.call(cpu);

            assert.equal(r.call(cpu), 0b00000001, `${srl.name} shifts right`);
            assert.equal(cpu.f(), 0b0001, 'Carry');

            srl.call(cpu);

            assert.equal(r.call(cpu), 0b00000000, `${srl.name} shifts right`);
            assert.equal(cpu.f(), 0b1001, 'Zero result with carry');

            srl.call(cpu);

            assert.equal(r.call(cpu), 0b00000000, `${srl.name} shifts right`);
            assert.equal(cpu.f(), 0b1000, 'Zero result without carry');
          });
        });
      });

      describe('SRA', () => {
        it('should shift registers to the right while keeping bit 7', () => {

          [ {r: cpu.a, ld: cpu.ld_a_n, sra: cpu.sra_a},
            {r: cpu.b, ld: cpu.ld_b_n, sra: cpu.sra_b},
            {r: cpu.c, ld: cpu.ld_c_n, sra: cpu.sra_c},
            {r: cpu.d, ld: cpu.ld_d_n, sra: cpu.sra_d},
            {r: cpu.e, ld: cpu.ld_e_n, sra: cpu.sra_e},
            {r: cpu.h, ld: cpu.ld_h_n, sra: cpu.sra_h},
            {r: cpu.l, ld: cpu.ld_l_n, sra: cpu.sra_l},
            {r: cpu.$hl, ld: cpu.ld_0xhl_n, sra: cpu.sra_0xhl}].map(({r, ld, sra}) => {

            cpu.ld_hl_nn(cpu.mmu.ADDR_WRAM_START);
            let cycles = 2;
            if (sra === cpu.sra_0xhl) cycles = 4;
            cpu._setC(0);
            ld.call(cpu, 0b00000110);
            const m = cpu.m();

            sra.call(cpu);

            assert.equal(r.call(cpu), 0b00000011, `${sra.name} shifts right`);
            assert.equal(cpu.f(), 0b0000, 'No carry');
            assert.equal(cpu.m() - m, cycles, 'Machine cycles');

            sra.call(cpu);

            assert.equal(r.call(cpu), 0b00000001, `${sra.name} shifts right`);
            assert.equal(cpu.f(), 0b0001, 'Carry');

            sra.call(cpu);

            assert.equal(r.call(cpu), 0b00000000, `${sra.name} shifts right`);
            assert.equal(cpu.f(), 0b1001, 'Zero result with carry');

            sra.call(cpu);

            assert.equal(r.call(cpu), 0b00000000, `${sra.name} shifts right`);
            assert.equal(cpu.f(), 0b1000, 'Zero result without carry');

            // Test when bit 7 is set
            ld.call(cpu, 0b10000110);
            cpu._setC(0);

            sra.call(cpu);

            assert.equal(r.call(cpu), 0b11000011, `${sra.name} shifts right`);
            assert.equal(cpu.f(), 0b0000, 'No carry');

            sra.call(cpu);

            assert.equal(r.call(cpu), 0b11100001, `${sra.name} shifts right`);
            assert.equal(cpu.f(), 0b0001, 'Carry');
          });
        });
      });

    });

    describe('Swaps', () => {
      it('should swap nybbles from registers', () => {

        [ {r: cpu.a, ld: cpu.ld_a_n, swap: cpu.swap_a},
          {r: cpu.b, ld: cpu.ld_b_n, swap: cpu.swap_b},
          {r: cpu.c, ld: cpu.ld_c_n, swap: cpu.swap_c},
          {r: cpu.d, ld: cpu.ld_d_n, swap: cpu.swap_d},
          {r: cpu.e, ld: cpu.ld_e_n, swap: cpu.swap_e},
          {r: cpu.h, ld: cpu.ld_h_n, swap: cpu.swap_h},
          {r: cpu.l, ld: cpu.ld_l_n, swap: cpu.swap_l} ].map( ({r, ld, swap}) => {

          ld.call(cpu, 0xab);
          let m = cpu.m();

          swap.call(cpu);

          assert.equal(r.call(cpu), 0xba, `${swap.name} swapped nybbles`);
          assert.equal(cpu.f(), 0b0000, `${swap.name} resets all flags for positive result`);
          assert.equal(cpu.m() - m, 2, 'Machine cycles');

          ld.call(cpu, 0x00);
          m = cpu.m();

          swap.call(cpu);

          assert.equal(r.call(cpu), 0x00, `${swap.name} does not modify zero`);
          assert.equal(cpu.f(), 0b1000, `${swap.name} sets Z with zero result`);
          assert.equal(cpu.m() - m, 2, 'Machine cycles');
        });
      });
      it('should swap nybbles from value at memory location hl', () => {
        cpu.ld_hl_nn(0xc000);
        cpu.ld_0xhl_n(0xab);
        let m = cpu.m();

        cpu.swap_0xhl();

        assert.equal(cpu.$hl(), 0xba, 'Swapped nybbles on (hl)');
        assert.equal(cpu.f(), 0b0000, 'resets all flags for positive result');
        assert.equal(cpu.m() - m, 4, 'Machine cycles');

        cpu.ld_0xhl_n(0x00);
        m = cpu.m();

        cpu.swap_0xhl();

        assert.equal(cpu.$hl(), 0x00, 'Identical');
        assert.equal(cpu.f(), 0b1000, 'Sets Z with zero result');
        assert.equal(cpu.m() - m, 4, 'Machine cycles');
      });
    });
  });

  describe('Returns', () => {
    it('should return from routine', () => {
      const addr = 0xabcd;
      const sp = cpu.sp();
      cpu.ld_hl_nn(addr);
      cpu.push_hl();
      const m = cpu.m();
      
      cpu.ret();

      assert.equal(cpu.sp(), sp, 'sp to be original value');
      assert.equal(cpu.pc(), addr, `program to continue on ${addr}`);
      assert.equal(cpu.m() - m, 4, 'RET machine cycles');
    });

    it('should return if last operation was not zero', () => {
      const addr = 0xabcd;
      const sp = cpu.sp();
      const pc = cpu.pc();
      cpu.ld_hl_nn(addr);
      cpu.push_hl();
      cpu._setZ(1);
      let m = cpu.m();

      cpu.ret_nz();

      assert.equal(cpu.pc(), pc, 'Does not jump');
      assert.equal(cpu.m() - m, 2, 'RET NZ without jump');

      cpu._setZ(0);
      m = cpu.m();

      cpu.ret_nz();

      assert.equal(cpu.pc(), addr, 'Jumps');
      assert.equal(cpu.sp(), sp, 'sp to original value');
      assert.equal(cpu.m() - m, 5, 'RET NZ without jump');
    });

    it('should return if last operation was zero', () => {
      const addr = 0xabcd;
      const sp = cpu.sp();
      const pc = cpu.pc();
      cpu.ld_hl_nn(addr);
      cpu.push_hl();
      cpu._setZ(0);
      let m = cpu.m();

      cpu.ret_z();

      assert.equal(cpu.pc(), pc, 'Does not jump');
      assert.equal(cpu.m() - m, 2, 'RET Z without jump');

      cpu._setZ(1);
      m = cpu.m();

      cpu.ret_z();

      assert.equal(cpu.pc(), addr, 'Jumps');
      assert.equal(cpu.sp(), sp, 'sp to original value');
      assert.equal(cpu.m() - m, 5, 'RET Z with jump');
    });

    it('should return if last operation did not carry', () => {
      const addr = 0xabcd;
      const sp = cpu.sp();
      const pc = cpu.pc();
      cpu.ld_hl_nn(addr);
      cpu.push_hl();
      cpu._setC(1);
      let m = cpu.m();

      cpu.ret_nc();

      assert.equal(cpu.pc(), pc, 'Does not jump');
      assert.equal(cpu.m() - m, 2, 'RET NC without jump');

      cpu._setC(0);
      m = cpu.m();

      cpu.ret_nc();

      assert.equal(cpu.pc(), addr, 'Jumps');
      assert.equal(cpu.sp(), sp, 'sp to original value');
      assert.equal(cpu.m() - m, 5, 'RET CZ with jump');
    });

    it('should return if last operation carried', () => {
      const addr = 0xabcd;
      const sp = cpu.sp();
      const pc = cpu.pc();
      cpu.ld_hl_nn(addr);
      cpu.push_hl();
      cpu._setC(0);
      let m = cpu.m();

      cpu.ret_c();

      assert.equal(cpu.pc(), pc, 'Does not jump');
      assert.equal(cpu.m() - m, 2, 'RET C without jump');

      cpu._setC(1);
      m = cpu.m();

      cpu.ret_c();

      assert.equal(cpu.pc(), addr, 'Jumps');
      assert.equal(cpu.sp(), sp, 'sp to original value');
      assert.equal(cpu.m() - m, 5, 'RET C without jump');
    });

    it('should return from interruption', () => {
      const addr = 0xabcd;
      const sp = cpu.sp();
      const pc = cpu.pc();
      cpu.ld_hl_nn(addr);
      cpu.push_hl();
      assert.equal(cpu.sp(), sp - 2, 'sp decreased');
      const m = cpu.m();

      cpu.reti();

      assert.equal(cpu.sp(), sp, 'sp to original value');
      assert.equal(cpu.pc(), addr, `program to continue on ${addr}`);
      assert.equal(cpu.ime(), 1, 'Master interruption enabled');
      assert.equal(cpu.m() - m, 4, 'RETI machine cycles');
    });

  });

  describe('Miscellaneous', () => {

    it('should complement register a', () => {
      cpu.ld_a_n(0b00110011);
      let m = cpu.m();
      
      cpu.cpl();

      assert.equal(cpu.a(), 0b11001100, 'Complement a');
      assert.equal(cpu.N(), 1, 'N always set');
      assert.equal(cpu.H(), 1, 'H always set');
      assert.equal(cpu.m() - m, 1, 'Machine cycles');

      cpu.ld_a_n(0b00010000);
      m = cpu.m();

      cpu.cpl();

      assert.equal(cpu.a(), 0b11101111, 'Complement a');
      assert.equal(cpu.m() - m, 1, 'Machine cycles');
    });
  });

  describe('Restarts', () => {

    it('should restart to address', () => {

      [ {rst: cpu.rst_00, addr: 0x00},
        {rst: cpu.rst_08, addr: 0x08},
        {rst: cpu.rst_10, addr: 0x10},
        {rst: cpu.rst_18, addr: 0x18},
        {rst: cpu.rst_20, addr: 0x20},
        {rst: cpu.rst_28, addr: 0x28},
        {rst: cpu.rst_30, addr: 0x30},
        {rst: cpu.rst_38, addr: 0x38} ].map( ({rst, addr}) => {

          cpu.setPC(0x0150);
          const m = cpu.m();

          rst.call(cpu);

          assert.equal(cpu.peek_stack(+1), 0x01, 'top nybble');
          assert.equal(cpu.peek_stack(), 0x50, 'bottom nybble');
          assert.equal(cpu.pc(), addr);
          assert.equal(cpu.m() - m, 4, 'Machine cycles');
      });
    });
  });

  describe('Interruptions', () => {

    it('should disable interruptions', () => {
      const m = cpu.m();

      cpu.di();

      assert.equal(cpu.ime(), 0, 'Interrupt Master Enable Flag disabled, all interruptions are prohibited.');
      assert.equal(cpu.m() - m, 1, 'Machine cycles');
    });

    it('should enable interruptions', () => {
      const m = cpu.m();

      cpu.ei();

      assert.equal(cpu.ime(), 1, 'Interrupt Master Enable Flag enabled.');
      assert.equal(cpu.m() - m, 1, 'Machine cycles');
    });

  });

  describe('CPU Control instructions', () => {
    it('should HALT', () => {
      const m = cpu.m();

      cpu.halt();

      assert.equal(cpu.m() - m, 1, 'Machine cycles');
      assert(cpu.isHalted());
    });

    it('should STOP', () => {
      const m = cpu.m();

      cpu.stop();

      assert.equal(cpu.m() - m, 1, 'Machine cycles');
      assert(cpu.isStopped());

      [ cpu.pressA, cpu.pressB, cpu.pressSTART, cpu.pressSTART,
        cpu.pressLeft, cpu.pressRight, cpu.pressUp, cpu.pressDown].map( (fn) => {

          cpu.stop();
          assert(cpu.isStopped());
          fn.call(cpu);
          assert(!cpu.isStopped());
      });
    });
  });
});

/**
 * Asserts that a register is decremented.
 * @param cpu
 * @param registerFn
 * @param decFn
 */
function assertDecrementRegister(cpu, registerFn, decFn){
  const value = registerFn.call(cpu);
  const m = cpu.m();
  let expected = value - 1;
  if (value === 0) expected = 0xff;

  decFn.call(cpu);

  assert.equal(registerFn.call(cpu), expected, `decrement ${registerFn.name}`);
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