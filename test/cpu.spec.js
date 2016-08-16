import CPU from '../src/CPU';
import assert from 'assert';
import config from '../src/config';
import {describe, beforeEach, it} from 'mocha';
import Utils from '../src/Utils';

describe('CPU', function() {

  config.TEST = true;
  let cpu;

  beforeEach(function() {
    cpu = new CPU('./roms/tetris.gb');
  });

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

  it('should start with pc, sp and registers at right values', () => {

    assert.equal(cpu.pc(), 0x100, 'Program Counter should start at 0x100');
    assert.equal(cpu.a(), 0x01, 'Accumulator must start as 0x01 for GB');
    assert.equal(cpu.af(), 0x01b0, 'Register af must start as 0x01bc');
    assert.equal(cpu.f(), 0b1011, 'Flag register must start as 0b1011');
    assert.equal(cpu.bc(), 0x0013, 'Register bc must start as 0x0013');
    assert.equal(cpu.de(), 0x00d8, 'Register de must start as 0x00d8');
    assert.equal(cpu.hl(), 0x014d, 'Register hl must start as 0x014d');
    assert.equal(cpu.sp(), 0xfffe, 'Stack Pointer must start as 0xfffe');
  });

  it('should execute instructions', () => {

    assert.equal(cpu.peekNextCommand(), 0x00, 'Tetris starts with NOP (0x00)');
    cpu.execute();
    assert.equal(cpu.peekNextCommand(), 0xc3, 'c3 5001; JP 0x0150');
    cpu.execute();
    assert.equal(cpu.pc(), 0x0150);
    assert.equal(cpu.peekNextCommand(), 0xc3, 'c3 8b02; JP 0x028b');
    cpu.execute();
    assert.equal(cpu.pc(), 0x028b);
    assert.equal(cpu.peekNextCommand(), 0xaf, 'af; XOR a');

  });

  it('should jump to address', () => {
    cpu.jp(0x123);
    assert.equal(cpu.pc(), 0x123);
  });

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
    const value = cpu.mmu.byteAt(hl);
    cpu.xor_hl();
    assert.equal(cpu.a(), a ^ value, `register a should be ${Utils.hexStr(a)} xor ${Utils.hexStr(value)}`);
  });

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

  it('should load values into register a', () => {

    assertLoadA(cpu, cpu.a, cpu.ld_a_a);
    assertLoadA(cpu, cpu.b, cpu.ld_a_b);
    assertLoadA(cpu, cpu.c, cpu.ld_a_c);
    assertLoadA(cpu, cpu.d, cpu.ld_a_d);
    assertLoadA(cpu, cpu.e, cpu.ld_a_e);
    assertLoadA(cpu, cpu.h, cpu.ld_a_h);
    assertLoadA(cpu, cpu.l, cpu.ld_a_l);
    assertLoadA(cpu, cpu.bc, cpu.ld_a_bc);
    assertLoadA(cpu, cpu.de, cpu.ld_a_de);
    assertLoadA(cpu, cpu.hl, cpu.ld_a_hl);

    const value = cpu.mmu.byteAt(0xabcd);
    cpu.ld_a_nn(0xabcd);
    assert.equal(cpu.a(), value, 'load value at memory 0xabcd into a');

    cpu.ld_a_n(0xab);
    assert.equal(cpu.a(), 0xab, 'load value 0xab into a');
  });

  it('should put memory address hl into a and decrement hl', () => {
    const hl = cpu.hl();
    const value = cpu.mmu.byteAt(hl);
    cpu.ldd_a_hl();
    assert.equal(cpu.a(), value, `register a has memory value ${value}`);
    assert.equal(cpu.hl(), hl - 1, 'hl is decremented 1');
  });

  it('should put a into memory address hl and decrement hl', () => {
    const a = cpu.a();
    const hl = 0xdfff;
    cpu.ld_hl_nn(hl);
    cpu.ldd_hl_a();
    assert.equal(cpu.mmu.byteAt(hl), a, `memory ${Utils.hexStr(hl)} has value ${a}`);
    assert.equal(cpu.hl(), hl - 1, 'hl is decremented by 1');
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

  it('should decrement a value at a memory location', () => {
    const value = 0xab;
    cpu.mmu.writeByteAt(0xdfff, value);
    cpu.ld_hl_nn(0xdfff);
    cpu.dec_0x_hl();
    assert.equal(cpu.mmu.byteAt(0xdfff), value - 1, 'Value at memory 0xdfff is decremented');
  });

  it('should decrement 16 bits registers', () => {
    assertDecrementRegister(cpu, cpu.bc, cpu.dec_bc);
    assertDecrementRegister(cpu, cpu.de, cpu.dec_de);
    assertDecrementRegister(cpu, cpu.hl, cpu.dec_hl);
    assertDecrementRegister(cpu, cpu.sp, cpu.dec_sp);
  });

  it('should jump conditionally forward', () => {
    cpu.ld_a_n(0x02);
    cpu.dec_a();
    assert.equal(cpu.Z(), 0, 'Z is reset');
    const pc = cpu.pc();
    cpu.jr_nz_n(0x05);
    assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0x05), 'jump forward');
  });

  it('shold jump conditionally backwards', () => {
    cpu.ld_a_n(0x02);
    cpu.dec_a();
    assert.equal(cpu.Z(), 0, 'Z is reset');
    const pc = cpu.pc();
    cpu.jr_nz_n(0xfc);
    assert.equal(cpu.pc(), pc + Utils.uint8ToInt8(0xfc), 'jump backward');
  });

  it('shold jump not jump is last operation was zero', () => {
    cpu.ld_a_n(0x01);
    cpu.dec_a();
    assert.equal(cpu.Z(), 1, 'Z is set');
    const pc = cpu.pc();
    cpu.jr_nz_n(0xfc);
    assert.equal(cpu.pc(), pc, 'do not jump, move to the next instruction');
  });

  it('should put a into memory address 0xff00 + 0', () => {

    const value = cpu.mmu.byteAt(0xff00);
    cpu.ld_a_n(0xab);
    cpu.ldh_n_a(0);
    assert.equal(cpu.mmu.byteAt(0xff00), 0xab, 'memory 0xff00 has value 0xab');

  });

  it('should put a into memory address 0xff00 + 0xfe', () => {

    const value = cpu.mmu.byteAt(0xfffe);
    cpu.ld_a_n(0xab);
    cpu.ldh_n_a(0xfe);
    assert.equal(cpu.mmu.byteAt(0xfffe), 0xab, 'memory 0xfffe has value 0xab');

  });

  it('should not write a into address 0xff00 + 0xff', () => {

    const value = cpu.mmu.byteAt(0xfffe);
    cpu.ld_a_n(0xab);
    cpu.ldh_n_a(0xff);
    assert.equal(cpu.mmu.byteAt(0xfffe), value, 'value at memory 0xffff does not change');

  });

  it('should put value at memory address 0xff00 + 0 into a', () => {
    const value = cpu.mmu.byteAt(0xff00);
    cpu.ldh_a_n(0);
    assert.equal(cpu.a(), value, '(0xff00) into a');
  });

  it('should put value at memory address 0xff00 + 0xfe into a', () => {
    const value = cpu.mmu.byteAt(0xff00 + 0xfe);
    cpu.ldh_a_n(0xfe);
    assert.equal(cpu.a(), value, '(0xfffe) into a');
  });

  it('should put value at memory address 0xff00 + 0xff into a', () => {
    const value = cpu.mmu.byteAt(0xff00 + 0xff);
    cpu.ldh_a_n(0xff);
    assert.equal(cpu.a(), value, '(0xffff) into a');
  });

  it('should compare with register a with value', () => {
    const n = 0xab;
    cpu.ld_a_n(0xab);
    cpu.cp_n(n);
    assert.equal(cpu.Z(), 0, 'Z=0 as a=n');
    assert.equal(cpu.N(), 1, 'N is set');
    assert.equal(cpu.H(), 0, 'Half carry happened');
    assert.equal(cpu.C(), 0, 'A is not greater than n');
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

/**
 * Asserts that value is loaded in a.
 * @param scope
 * @param registerFn
 * @param loadFn
 */
function assertLoadA(scope, registerFn, loadFn){
  const value = registerFn.call(scope);
  loadFn.call(scope);
  assert.equal(registerFn.call(scope), value, `load ${registerFn} into a`);
}

function testSetGetFlag(cpu, setFn, getFn){
  setFn.call(cpu, 1);
  assert.equal(getFn.call(cpu), 1, 'Flag=1');
  setFn.call(cpu, 0);
  assert.equal(getFn.call(cpu), 0, 'Flag=0');
}