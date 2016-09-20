import CPU from '../src/cpu';
import MMU from '../src/mmu';
import assert from 'assert';
import config from '../src/config';
import {describe, beforeEach, it} from 'mocha';
import Utils from '../src/utils';
import ipcMock from './mock/ipcMock';

describe('CPU Unit tests', function() {

  config.DEBUG = false;
  config.TEST = true;
  let cpu;

  beforeEach(function() {
    cpu = new CPU(new MMU('./roms/blargg_cpu_instrs.gb'), new ipcMock());

    cpu.setPC = function(pc){
      this.mmu.inBIOS = false;
      this._r.pc = pc;
    };
  });

  describe('ROM file loading', () => {
    it('should handle missing ROM filename', () => {
      assert.throws(() => new CPU(), Error);
    });

    it('should handle missing ROM file', () => {
      assert.throws(() => new CPU(new MMU('./roms/nope.gb')), Error);
    });

    it('should handle missing ipc', () => {
      assert.throws( () => new CPU(new MMU(), null), Error, 'Missing ipc');
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

  describe('NOP', () => {
    it('should run NOP in 1 machine cycle', () => {
      const m = cpu.m();
      cpu.nop();
      assert.equal(cpu.m(), m+1, 'NOP runs in 1 machine cycle.');
    });
  });

  describe('Jumps', () => {
    it('should jump to address', () => {
      const m = cpu.m();

      cpu.jp(0x123);

      assert.equal(cpu.pc(), 0x123);
      assert.equal(cpu.m(), m+4, 'JP runs in 4 machine cycles');
    });

    it('should jump to address contained in hl', () => {
      cpu.ld_hl_nn(0xc000);
      const m = cpu.m();

      cpu.jp_hl();

      assert.equal(cpu.pc(), 0xc000);
      assert.equal(cpu.m(), m+1, 'JP (HL) runs in 1 machine cycle');
    });

    it('should jump to signed offset', () => {
      let pc = cpu.pc(); // 0
      let offset = Utils.uint8ToInt8(0x05);

      assert.throws( () => {
        cpu.jp_n(0xff); // -1
      }, Error, 'cannot jump outside memory space');

      const m = cpu.m();
      cpu.jp_n(0x05);

      assert.equal(cpu.pc(), pc + offset, `jump forward ${offset}`);
      assert.equal(cpu.m(), m+3, 'JP e runs in 3 machine cycles');

      pc = cpu.pc();
      offset = Utils.uint8ToInt8(0xff);

      cpu.jp_n(0xff);

      assert.equal(cpu.pc(), pc + offset, `jump backward ${offset}`);
    });

    describe('Jump NZ with address', () => {
      it('should jump to address if Z is reset', () => {
        cpu.setZ(0);
        const m = cpu.m();

        cpu.jp_nz_nn(0xc000);

        assert.equal(cpu.pc(), 0xc000, 'jump to address');
        assert.equal(cpu.m(), m+4, 'JP NZ runs in 4 machine cycles if jumps');
      });

      it('should not jump to address if Z is set', () => {
        cpu.setZ(1);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jp_nz_nn(0xc000);

        assert.equal(cpu.pc(), pc, 'do not jump to address');
        assert.equal(cpu.m(), m+3, 'JP NZ runs in 3 machine cycles if does not jump');
      });
    });

    describe('Jump NZ with signed byte', () => {
      it('should jump forward if Z is reset', () => {
        cpu.setZ(0);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_nz_n(0x05);

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0x05), 'jump forward');
        assert.equal(cpu.m(), m+3, 'JR NZ runs in 3 machine cycles if jumps');
      });

      it('should jump backwards if Z is reset', () => {
        cpu.setPC(0x100);
        cpu.setZ(0);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_nz_n(0xfc); // -4

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0xfc), 'jump backward');
        assert.equal(cpu.m(), m+3, 'JR NZ runs in 3 machine cycles if jumps');
      });

      it('should not jump if Z is set', () => {
        cpu.setZ(1);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_nz_n(0xfc);

        assert.equal(cpu.pc(), pc, 'do not jump, move to the next instruction');
        assert.equal(cpu.m(), m+2, 'JR NZ runs in 2 machine cycles if does not jump');
      });
    });

    describe('Jump Z with address', () => {
      it('should jump to address if Z is set', () => {
        cpu.setZ(1);
        const m = cpu.m();

        cpu.jp_z_nn(0xc000);

        assert.equal(cpu.pc(), 0xc000, 'jump to address');
        assert.equal(cpu.m(), m+4, 'JP Z nn runs in 4 machine cycles if jumps');
      });

      it('should not jump to address if Z is reset', () => {
        cpu.setZ(0);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jp_z_nn(0xc000);

        assert.equal(cpu.pc(), pc, 'do not jump to address');
        assert.equal(cpu.m(), m+3, 'JP Z runs in 3 machine cycles if does not jump');
      });
    });

    describe('Jump Z with signed byte', () => {
      it('should jump forward if Z is set', () => {
        cpu.setZ(1);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_z_n(0x05);

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0x05), 'jump forward');
        assert.equal(cpu.m(), m+3, 'JR Z e runs in 3 machine cycles if jumps');
      });

      it('should jump backwards if Z is set', () => {
        cpu.setPC(0x100);
        cpu.setZ(1);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_z_n(0xfc); // -4

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0xfc), 'jump backward');
        assert.equal(cpu.m(), m+3, 'JR Z e runs in 3 machine cycles if jumps');
      });

      it('should not jump if Z is reset', () => {
        cpu.setZ(0);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_z_n(0xfc);

        assert.equal(cpu.pc(), pc, 'do not jump, move to the next instruction');
        assert.equal(cpu.m(), m+2, 'JR Z e runs in 2 machine cycles if jumps');
      });
    });

    describe('Jump NC with address', () => {
      it('should jump to address if Carry is reset', () => {
        cpu.setC(0);
        const m = cpu.m();

        cpu.jp_nc_nn(0xc000);

        assert.equal(cpu.pc(), 0xc000, 'jump to address');
        assert.equal(cpu.m(), m+4, 'Runs in 4 machine cycles if jumps');
      });

      it('should not jump to address if Carry is set', () => {
        cpu.setC(1);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jp_nc_nn(0xc000);

        assert.equal(cpu.pc(), pc, 'do not jump to address');
        assert.equal(cpu.m(), m+3, 'Runs in 3 machine cycles if does not jump');
      });
    });

    describe('Jump NC with signed byte', () => {
      it('should jump forward if C is reset', () => {
        cpu.setC(0);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_nc_n(0x05);

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0x05), 'jump forward');
        assert.equal(cpu.m(), m+3, 'Runs in 3 machine cycles if jumps');
      });

      it('should jump backwards if C is reset', () => {
        cpu.setPC(0x100);
        cpu.setC(0);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_nc_n(0xfc); // -4

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0xfc), 'jump backward');
        assert.equal(cpu.m(), m+3, 'Runs in 3 machine cycles if jumps');
      });

      it('should not jump if C is set', () => {
        cpu.setC(1);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_nc_n(0xfc);

        assert.equal(cpu.pc(), pc, 'do not jump, move to the next instruction');
        assert.equal(cpu.m(), m+2, 'Runs in 2 machine cycles if does not jump');
      });
    });

    describe('Jump C with address', () => {
      it('should jump to address if Carry is set', () => {
        cpu.setC(1);
        const m = cpu.m();

        cpu.jp_c_nn(0xc000);

        assert.equal(cpu.pc(), 0xc000, 'jump to address');
        assert.equal(cpu.m(), m+4, 'Runs in 4 machine cycles if jumps');
      });

      it('should not jump to address if Carry is reset', () => {
        cpu.setC(0);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jp_c_nn(0xc000);

        assert.equal(cpu.pc(), pc, 'do not jump to address');
        assert.equal(cpu.m(), m+3, 'Runs in 3 machine cycles if does not jump');
      });
    });

    describe('Jump C with signed byte', () => {
      it('should jump forward if C is set', () => {
        cpu.setC(1);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_c_n(0x05);

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0x05), 'jump forward');
        assert.equal(cpu.m(), m+3, 'Runs in 3 machine cycles if jumps');
      });

      it('should jump backwards if C is set', () => {
        cpu.setPC(0x100);
        cpu.setC(1);
        const pc = cpu.pc();
        const m = cpu.m();

        cpu.jr_c_n(0xfc);

        assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0xfc), 'jump backward');
        assert.equal(cpu.m(), m+3, 'Runs in 3 machine cycles if jumps');
      });

      it('should not jump if C is reset', () => {
        cpu.setC(0);
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
        cpu.mmu.writeByteAt(0xc000, 0x33);

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
        const value = 0xab;
        cpu.mmu.writeByteAt(0xdfff, value);
        cpu.ld_hl_nn(0xdfff);

        const m = cpu.m();
        cpu.dec_0xhl();

        assert.equal(cpu.mmu.readByteAt(0xdfff), value - 1, 'Value at memory 0xdfff is decremented');
        // TODO check flags
        assert.equal(cpu.m(), m+3, 'DEC (HL) runs in 3 machine cycle');
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
          assert.equal(cpu.Z(), 0, 'Result not zero');
          assert.equal(cpu.N(), 1, 'N always set');
          assert.equal(cpu.H(), 0, 'No borrow from bit 4');
          assert.equal(cpu.C(), 0, 'No borrow from carry');
          assert.equal(cpu.m(), m+1, 'SUB r machine cycles');

          cpu.ld_a_n(0x10);
          ld.call(cpu, 0x02);

          m = cpu.m();
          sub.call(cpu); // Borrow from bit 4

          assert.equal(cpu.a(), 0x0e, `a subtracted two with half carry, ${sub.name}`);
          assert.equal(cpu.Z(), 0, 'Result not zero');
          assert.equal(cpu.N(), 1, 'N always set');
          assert.equal(cpu.H(), 1, 'Borrow from bit 4');
          assert.equal(cpu.C(), 0, 'No borrow from carry');
          assert.equal(cpu.m(), m+1, 'SUB r machine cycles');

          cpu.ld_a_n(0x0e);
          ld.call(cpu, 0x0e);

          m = cpu.m();
          sub.call(cpu);  // Result zero

          assert.equal(cpu.a(), 0x00, `a subtracted 0x0e, ${sub.name}`);
          assert.equal(cpu.Z(), 1, 'Result is zero');
          assert.equal(cpu.N(), 1, 'N always set');
          assert.equal(cpu.H(), 0, 'No borrow from bit 4');
          assert.equal(cpu.C(), 0, 'No borrow from carry');
          assert.equal(cpu.m(), m+1, 'SUB r machine cycles');

          cpu.ld_a_n(0x05);
          ld.call(cpu, 0x08);

          m = cpu.m();
          sub.call(cpu); // Result negative from positive number in a

          assert.equal(cpu.a(), 0xfd, `a loops back to 0xfd, ${sub.name}`);
          assert.equal(cpu.Z(), 0, 'Result not zero');
          assert.equal(cpu.N(), 1, 'N always set');
          assert.equal(cpu.H(), 0, 'No borrow from bit 4');
          assert.equal(cpu.C(), 1, 'Borrow from carry');
          assert.equal(cpu.m(), m+1, 'SUB r machine cycles');

          cpu.ld_a_n(0x01);
          ld.call(cpu, 0xff);

          m = cpu.m();
          sub.call(cpu); // Max subtraction

          assert.equal(cpu.a(), 0x02, 'a loops back to 0x02');
          assert.equal(cpu.Z(), 0, 'Result not zero');
          assert.equal(cpu.N(), 1, 'N always set');
          assert.equal(cpu.H(), 0, 'No borrow from bit 4');
          assert.equal(cpu.C(), 1, 'Borrow from carry');
          assert.equal(cpu.m(), m+1, 'SUB r machine cycles');
        });
      });

      it('should subtract value at memory location hl from register a', () =>{
        cpu.ld_hl_nn(0xc000);
        cpu.ld_a_n(0x12);
        cpu.ld_0xhl_n(0x02);

        let m = cpu.m();
        cpu.sub_0xhl(); // Positive result

        assert.equal(cpu.a(), 0x10, 'a subtracted two from (hl)');
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 1, 'N always set');
        assert.equal(cpu.H(), 0, 'No borrow from bit 4');
        assert.equal(cpu.C(), 0, 'No borrow from carry');
        assert.equal(cpu.m(), m+2, 'SUB r machine cycles');

        cpu.ld_a_n(0x10);
        cpu.ld_0xhl_n(0x02);

        m = cpu.m();
        cpu.sub_0xhl(); // Borrow from bit 4

        assert.equal(cpu.a(), 0x0e, 'a subtracted two with half carry from (hl)');
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 1, 'N always set');
        assert.equal(cpu.H(), 1, 'Borrow from bit 4');
        assert.equal(cpu.C(), 0, 'No borrow from carry');
        assert.equal(cpu.m(), m+2, 'SUB r machine cycles');

        cpu.ld_a_n(0x0e);
        cpu.ld_0xhl_n(0x0e);

        m = cpu.m();
        cpu.sub_0xhl();  // Result zero

        assert.equal(cpu.a(), 0x00, 'a subtracted 0x0e, from (hl)');
        assert.equal(cpu.Z(), 1, 'Result is zero');
        assert.equal(cpu.N(), 1, 'N always set');
        assert.equal(cpu.H(), 0, 'No borrow from bit 4');
        assert.equal(cpu.C(), 0, 'No borrow from carry');
        assert.equal(cpu.m(), m+2, 'SUB r machine cycles');

        cpu.ld_a_n(0x05);
        cpu.ld_0xhl_n(0x08);

        m = cpu.m();
        cpu.sub_0xhl(); // Result negative from positive number in a

        assert.equal(cpu.a(), 0xfd, 'a loops back to 0xfd, from (hl)');
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 1, 'N always set');
        assert.equal(cpu.H(), 0, 'No borrow from bit 4');
        assert.equal(cpu.C(), 1, 'Borrow from carry');
        assert.equal(cpu.m(), m+2, 'SUB r machine cycles');

        cpu.ld_a_n(0x01);
        cpu.ld_0xhl_n(0xff);

        m = cpu.m();
        cpu.sub_0xhl(); // Max subtraction

        assert.equal(cpu.a(), 0x02, 'a loops back to 0x02 from (hl)');
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 1, 'N always set');
        assert.equal(cpu.H(), 0, 'No borrow from bit 4');
        assert.equal(cpu.C(), 1, 'Borrow from carry');
        assert.equal(cpu.m(), m+2, 'SUB r machine cycles');
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

    describe('ADD', () => {

      it('should add n to register a', () => {

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
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 0, 'N always reset');
        assert.equal(cpu.H(), 0, 'No carry from bit 3');
        assert.equal(cpu.C(), 0, 'No carry');
        assert.equal(cpu.m(), m + 2, 'ADD (HL) machine cycles');

        cpu.ld_a_n(0x0f);
        cpu.ld_0xhl_n(0x01);

        m = cpu.m();
        cpu.add_0xhl(); // Test carry from bit 3

        assert.equal(cpu.a(), 0x10, 'a 0x0f plus two with half carry');
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 0, 'N always reset');
        assert.equal(cpu.H(), 1, 'Carry from bit 3');
        assert.equal(cpu.C(), 0, 'No carry');
        assert.equal(cpu.m(), m + 2, 'ADD (HL) machine cycles');

        cpu.ld_a_n(0xf0);
        cpu.ld_0xhl_n(0x10);

        m = cpu.m();
        cpu.add_0xhl(); // Test a result zero

        assert.equal(cpu.a(), 0x00, 'a 0xf0 plus 0x10 is zero');
        assert.equal(cpu.Z(), 1, 'Result is zero');
        assert.equal(cpu.N(), 0, 'N always reset');
        assert.equal(cpu.H(), 1, 'Carry from bit 3');
        assert.equal(cpu.C(), 1, 'Carry');
        assert.equal(cpu.m(), m + 2, 'ADD (HL) machine cycles');

        cpu.ld_a_n(0xf0);
        cpu.ld_0xhl_n(0x12);

        m = cpu.m();
        cpu.add_0xhl(); // Result overflows from positive number in a

        assert.equal(cpu.a(), 0x02, 'a 0xf0 overflows to 0x02');
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 0, 'N always reset');
        assert.equal(cpu.H(), 1, 'Carry from bit 3');
        assert.equal(cpu.C(), 1, 'Carry');
        assert.equal(cpu.m(), m + 2, 'ADD (HL) machine cycles');

        cpu.ld_a_n(0x02);
        cpu.ld_0xhl_n(0xff);

        m = cpu.m();
        cpu.add_0xhl(); // Test max addition

        assert.equal(cpu.a(), 0x01, 'a 0x02 plus 0xff overflows to 0x01');
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 0, 'N always reset');
        assert.equal(cpu.H(), 1, 'Carry from bit 3');
        assert.equal(cpu.C(), 1, 'Carry');
        assert.equal(cpu.m(), m + 2, 'ADD (HL) machine cycles');
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
        assert.equal(cpu.Z(), 0, 'Result not zero');
        assert.equal(cpu.N(), 0, 'N always reset');
        assert.equal(cpu.H(), 0, 'No carry from bit 3');
        assert.equal(cpu.C(), 0, 'No carry');
        assert.equal(cpu.m(), m + 2, 'ADD n machine cycles');
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
    });

    describe('DEC', () => {

      it('should decrement 16 bits registers', () => {
        assertDecrementRegister(cpu, cpu.bc, cpu.dec_bc);
        assertDecrementRegister(cpu, cpu.de, cpu.dec_de);
        assertDecrementRegister(cpu, cpu.hl, cpu.dec_hl);
        assertDecrementRegister(cpu, cpu.sp, cpu.dec_sp);
        // TODO check flags
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
          inc.call(cpu);
          assert.equal(r.call(cpu), value + 1, `register ${r} incremented`);
          // No flags are affected
        });
      });
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

          assert.equal(r.call(cpu), 0xabcd, `Pop into ${r.name}`);
          assert.equal(cpu.sp(), sp + 2, 'sp incremented twice');
          assert.equal(cpu.m(), m+3, 'Pop rr machine cycles');
        });
      });
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
      assert.equal(cpu.m(), m + 2, 'LDI a,(hl) machine cycles');
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
      // TODO: test any bit, not only bit 7

      cpu.ld_h_n(0x00);
      let m = cpu.m();

      cpu.bit_7_h();

      assert.equal(cpu.Z(), 1, 'bit 7 is zero');
      assert.equal(cpu.N(), 0, 'N always reset');
      assert.equal(cpu.H(), 1, 'H always set');
      assert.equal(cpu.m(), m+2, 'BIT 7,h machine cycles');

      cpu.ld_h_n(0b10000000);
      m = cpu.m();

      cpu.bit_7_h();

      assert.equal(cpu.Z(), 0, 'bit 7 is not zero');
      assert.equal(cpu.N(), 0, 'N always reset');
      assert.equal(cpu.H(), 1, 'H always set');
      assert.equal(cpu.m(), m+2, 'BIT 7,h machine cycles');
    });

    it('should reset bits', () => {
      ['a', 'b', 'c', 'd', 'e', 'h', 'l'].map( (r) => {

        cpu[`ld_${r}_n`].call(cpu, 0xff);

        for(let b = 0; b < 8; b++) {
          const func = `res_${b}_${r}`;
          assert.ok(cpu[func], `${func} exists`);
          const m = cpu.m();

          cpu[func].call(cpu); // reset bit b

          assert.equal(cpu.m(), m + 2, `${func} machine cycles`);
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

      for(let b = 0; b < 8; b++) {
        const m = cpu.m();

        cpu.res_b_0xhl(b);

        assert.equal(cpu.m(), m + 4, `RES ${b},(hl) machine cycles`);
      }

      assert.equal(cpu._0xhl(), 0x00, 'RES b,(hl) with 0..b..7 resets all bits');
    });

  });

  describe('Calls', () => {
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

  describe('Rotates and Shifts', () => {
    it('should rotate registers left', () => {

      [{r: cpu.a, ld: cpu.ld_a_n, rl: cpu.rl_a},
        {r: cpu.b, ld: cpu.ld_b_n, rl: cpu.rl_b},
        {r: cpu.c, ld: cpu.ld_c_n, rl: cpu.rl_c},
        {r: cpu.d, ld: cpu.ld_d_n, rl: cpu.rl_d},
        {r: cpu.e, ld: cpu.ld_e_n, rl: cpu.rl_e},
        {r: cpu.h, ld: cpu.ld_h_n, rl: cpu.rl_h},
        {r: cpu.l, ld: cpu.ld_l_n, rl: cpu.rl_l}].map(({r, ld, rl}) => {

        cpu.setC(0);
        ld.call(cpu, 0x80);
        const m = cpu.m();

        rl.call(cpu);

        assert.equal(r.call(cpu), 0x00, `${r.name} rotated left`);
        assert.equal(cpu.Z(), 1, 'Result was zero');
        assert.equal(cpu.N(), 0, 'N reset');
        assert.equal(cpu.H(), 0, 'H reset');
        assert.equal(cpu.C(), 1, 'Carry set');
        assert.equal(cpu.m(), m + 2, `RL ${r.name} machine cycles`);
      });
    });

    it('should rotate value at memory location hl left', () => {
      cpu.ld_hl_nn(0xc000);
      cpu.ld_0xhl_n(0b01010001);
      cpu.setC(0);
      const m = cpu.m();

      cpu.rl_0xhl();

      assert.equal(cpu.$hl(), 0b10100010, 'value at memory hl rotated left');
      assert.equal(cpu.f(), 0b0000, 'No carry');
      assert.equal(cpu.m() - m, 4, 'RL (hl) machine cycles');

      cpu.rl_0xhl();

      assert.equal(cpu.$hl(), 0b01000100, 'value at memory hl rotated left');
      assert.equal(cpu.f(), 0b0001, 'Carry');

      cpu.rl_0xhl();

      assert.equal(cpu.$hl(), 0b10001001, 'value at memory hl rotated left');
      assert.equal(cpu.f(), 0b0000, 'No carry');

      cpu.ld_0xhl_n(0x00);

      cpu.rl_0xhl();

      assert.equal(cpu.$hl(), 0x00, 'Identical');
      assert.equal(cpu.f(), 0b1000, 'Zero result without carry');
    });

    it('should rotate a to the left', () => {
      cpu.setC(1);
      cpu.ld_a_n(           0b10010101);
      const m = cpu.m();

      cpu.rla();

      assert.equal(cpu.a(), 0b00101011, 'Rotate a left');
      assert.equal(cpu.Z(), 0, 'Result was positive');
      assert.equal(cpu.N(), 0, 'N reset');
      assert.equal(cpu.H(), 0, 'H reset');
      assert.equal(cpu.C(), 1, 'Carry 1');
      assert.equal(cpu.m(), m + 1, 'RLA machine cycles');
    });

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

    describe('Rotates', () => {
      it('should rotate registers to the left', () => {

        [ {r: cpu.a, ld: cpu.ld_a_n, sla: cpu.sla_a},
          {r: cpu.b, ld: cpu.ld_b_n, sla: cpu.sla_b},
          {r: cpu.c, ld: cpu.ld_c_n, sla: cpu.sla_c},
          {r: cpu.d, ld: cpu.ld_d_n, sla: cpu.sla_d},
          {r: cpu.e, ld: cpu.ld_e_n, sla: cpu.sla_e},
          {r: cpu.h, ld: cpu.ld_h_n, sla: cpu.sla_h},
          {r: cpu.l, ld: cpu.ld_l_n, sla: cpu.sla_l} ].map(({r, ld, sla}) => {

          ld.call(cpu, 0b01100000);
          const m = cpu.m();

          sla.call(cpu);

          assert.equal(r.call(cpu), 0b11000000, 'Shifted left');
          assert.equal(cpu.f(), 0b0000, 'No carry');
          assert.equal(cpu.m() - m, 2, 'Machine cycles');

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
      cpu.setZ(1);
      let m = cpu.m();

      cpu.ret_nz();

      assert.equal(cpu.pc(), pc, 'Does not jump');
      assert.equal(cpu.m() - m, 2, 'RET NZ without jump');

      cpu.setZ(0);
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
      cpu.setZ(0);
      let m = cpu.m();

      cpu.ret_z();

      assert.equal(cpu.pc(), pc, 'Does not jump');
      assert.equal(cpu.m() - m, 2, 'RET Z without jump');

      cpu.setZ(1);
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
      cpu.setC(1);
      let m = cpu.m();

      cpu.ret_nc();

      assert.equal(cpu.pc(), pc, 'Does not jump');
      assert.equal(cpu.m() - m, 2, 'RET NC without jump');

      cpu.setC(0);
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
      cpu.setC(0);
      let m = cpu.m();

      cpu.ret_c();

      assert.equal(cpu.pc(), pc, 'Does not jump');
      assert.equal(cpu.m() - m, 2, 'RET C without jump');

      cpu.setC(1);
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