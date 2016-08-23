import Utils from './utils';
import Logger from './logger';
import MMU from './mmu';

export default class CPU {

  /**
   * @param {string} filename
   */
  constructor(filename) {

    if (filename == null) {
      throw new Error('Missing ROM filename');
    }

    this.mmu = new MMU(filename);

    if (!this.mmu.rom) return;

    this.EXTENDED_PREFIX = 0xcb;

    this._r = {
      pc: this.mmu.ADDR_GAME_START,
      sp: this.mmu.ADDR_MAX - 1,
      a: 0x01,
      b: 0x00,
      c: 0x13,
      d: 0x00,
      e: 0xd8,
      _f: 0xb0,
      h: 0x01,
      l: 0x4d
    };

    if (filename.includes('bios')){
      this._r.pc = 0;
    }

    this.commands = {
      0x00: {fn: this.nop, paramBytes: 0},
      0x01: {fn: this.ld_bc_nn, paramBytes: 2},
      0x02: {fn: this.ld_0x_bc_a, paramBytes: 0},
      0x04: {fn: this.inc_c, paramBytes: 0},
      0x05: {fn: this.dec_b, paramBytes: 0},
      0x06: {fn: this.ld_b_n, paramBytes: 1},
      0x0a: {fn: this.ld_a_bc, paramBytes: 0},
      0x0b: {fn: this.dec_bc, paramBytes: 0},
      0x0c: {fn: this.inc_c, paramBytes: 0},
      0x0d: {fn: this.dec_c, paramBytes: 0},
      0x0e: {fn: this.ld_c_n, paramBytes: 1},
      0x11: {fn: this.ld_de_nn, paramBytes: 2},
      0x12: {fn: this.ld_0x_de_a, paramBytes: 0},
      0x14: {fn: this.inc_d, paramBytes: 0},
      0x15: {fn: this.dec_d, paramBytes: 0},
      0x16: {fn: this.ld_d_n, paramBytes: 1},
      0x17: {fn: this.rla, paramBytes: 0},
      0x1a: {fn: this.ld_a_de, paramBytes: 0},
      0x1b: {fn: this.dec_de, paramBytes: 0},
      0x1c: {fn: this.inc_e, paramBytes: 0},
      0x1d: {fn: this.dec_e, paramBytes: 0},
      0x1e: {fn: this.ld_e_n, paramBytes: 1},
      0x20: {fn: this.jr_nz_n, paramBytes: 1},
      0x21: {fn: this.ld_hl_nn, paramBytes: 2},
      0x24: {fn: this.inc_h, paramBytes: 0},
      0x25: {fn: this.dec_h, paramBytes: 0},
      0x2b: {fn: this.dec_hl, paramBytes: 0},
      0x2c: {fn: this.inc_l, paramBytes: 0},
      0x2d: {fn: this.dec_l, paramBytes: 0},
      0x2e: {fn: this.ld_l_n, paramBytes: 1},
      0x26: {fn: this.ld_h_n, paramBytes: 1},
      0x31: {fn: this.ld_sp_nn, paramBytes: 2},
      0x32: {fn: this.ldd_hl_a, paramBytes: 0},
      0x34: {fn: this.inc_0x_hl, paramBytes: 0},
      0x35: {fn: this.dec_0x_hl, paramBytes: 0},
      0x3a: {fn: this.ldd_a_hl, paramBytes: 0},
      0x3b: {fn: this.dec_sp, paramBytes: 0},
      0x3d: {fn: this.dec_a, paramBytes: 0},
      0x3c: {fn: this.inc_a, paramBytes: 0},
      0x3e: {fn: this.ld_a_n, paramBytes: 1},
      0x47: {fn: this.ld_b_a, paramBytes: 0},
      0x4f: {fn: this.ld_c_a, paramBytes: 0},
      0x57: {fn: this.ld_d_a, paramBytes: 0},
      0x5f: {fn: this.ld_e_a, paramBytes: 0},
      0x67: {fn: this.ld_h_a, paramBytes: 0},
      0x6f: {fn: this.ld_l_a, paramBytes: 0},
      0x77: {fn: this.ld_0x_hl_a, paramBytes: 0},
      0x78: {fn: this.ld_a_b, paramBytes: 0},
      0x79: {fn: this.ld_a_c, paramBytes: 0},
      0x7a: {fn: this.ld_a_d, paramBytes: 0},
      0x7b: {fn: this.ld_a_e, paramBytes: 0},
      0x7c: {fn: this.ld_a_h, paramBytes: 0},
      0x7d: {fn: this.ld_a_l, paramBytes: 0},
      0x7e: {fn: this.ld_a_hl, paramBytes: 0},
      0x7f: {fn: this.ld_a_a, paramBytes: 0},
      0xa8: {fn: this.xor_b, paramBytes: 0},
      0xa9: {fn: this.xor_c, paramBytes: 0},
      0xaa: {fn: this.xor_d, paramBytes: 0},
      0xab: {fn: this.xor_e, paramBytes: 0},
      0xac: {fn: this.xor_h, paramBytes: 0},
      0xad: {fn: this.xor_l, paramBytes: 0},
      0xae: {fn: this.xor_hl, paramBytes: 0},
      0xaf: {fn: this.xor_a, paramBytes: 0},
      0xb8: {fn: this.cp_b, paramBytes: 0},
      0xb9: {fn: this.cp_c, paramBytes: 0},
      0xba: {fn: this.cp_d, paramBytes: 0},
      0xbb: {fn: this.cp_e, paramBytes: 0},
      0xbc: {fn: this.cp_h, paramBytes: 0},
      0xbd: {fn: this.cp_l, paramBytes: 0},
      0xbe: {fn: this.cp_hl, paramBytes: 0},
      0xbf: {fn: this.cp_a, paramBytes: 0},
      0xc1: {fn: this.pop_bc, paramBytes: 0},
      0xc3: {fn: this.jp, paramBytes: 2},
      0xc5: {fn: this.push_bc, paramBytes: 0},
      0xcb10: {fn: this.rl_b, paramBytes: 0},
      0xcb11: {fn: this.rl_c, paramBytes: 0},
      0xcb12: {fn: this.rl_d, paramBytes: 0},
      0xcb13: {fn: this.rl_e, paramBytes: 0},
      0xcb14: {fn: this.rl_h, paramBytes: 0},
      0xcb15: {fn: this.rl_l, paramBytes: 0},
      0xcb16: {fn: this.rl_0x_hl, paramBytes: 0},
      0xcb17: {fn: this.rl_a, paramBytes: 0},
      0xcb7c: {fn: this.bit_7_h, paramBytes: 0},
      0xcd: {fn: this.call, paramBytes: 2},
      0xd1: {fn: this.pop_de, paramBytes: 0},
      0xd5: {fn: this.push_de, paramBytes: 0},
      0xe0: {fn: this.ldh_n_a, paramBytes: 1},
      0xe1: {fn: this.pop_hl, paramBytes: 0},
      0xe2: {fn: this.ld_0x_c_a, paramBytes: 0},
      0xe5: {fn: this.push_hl, paramBytes: 0},
      0xea: {fn: this.ld_0x_nn_a, paramBytes: 1},
      0xee: {fn: this.xor_n, paramBytes: 1},
      0xf0: {fn: this.ldh_a_n, paramBytes: 1},
      0xf1: {fn: this.pop_af, paramBytes: 0},
      0xf3: {fn: this.di, paramBytes: 0},
      0xf5: {fn: this.push_af, paramBytes: 0},
      0xfa: {fn: this.ld_a_nn, paramBytes: 2},
      0xfb: {fn: this.ei, paramBytes: 0},
      0xfe: {fn: this.cp_n, paramBytes: 1}
    };
  }

  a(){
    return this._r.a;
  }

  b(){
    return this._r.b;
  }

  c(){
    return this._r.c;
  }

  d(){
    return this._r.d;
  }

  e(){
    return this._r.e;
  }

  h(){
    return this._r.h;
  }

  l(){
    return this._r.l;
  }

  pc(){
    return this._r.pc;
  }

  sp(){
    return this._r.sp;
  }

  ie(){
    return this.mmu.readByteAt(0xffff);
  }

  /**
   * @returns {number} Register af
   */
  af(){
    return (this._r.a << 8) + this._r._f;
  }

  /**
   * @returns {number} Register bc
   */
  bc(){
    return (this._r.b << 8) + this._r.c;
  }

  /**
   * @returns {number} Register de
   */
  de(){
    return (this._r.d << 8) + this._r.e;
  }

  /**
   * @returns {number} Register hl
   */
  hl(){
    return (this._r.h << 8) + this._r.l;
  }

  /**
   * @returns {number} flags (4 bits)
   */
  f(){
    return (this._r._f & 0xF0) >> 4;
  }

  /**
   * Main loop method.
   */
  start(){
    try {
      while(true){
        this.execute();
      }
    } catch(e){
      Logger.error(e);
    }
    process.exit(0);
  }

  /**
   * Executes the next command and increases the pc.
   */
  execute() {

    let opcode = this._nextOpcode();

    if (opcode === this.EXTENDED_PREFIX){
      opcode = (opcode << 8) + this._nextOpcode();
    }

    const command = this._getCommand(opcode);
    const param = this._getInstrParams(command.paramBytes);

    Logger.state(this, command.fn, command.paramBytes, param);

    command.fn.call(this, param);
  }

  /**
   * @param numBytes
   * @returns {*}
   * @private
   */
  _getInstrParams(numBytes){
    let param;
    if(numBytes > 0){
      param = this.mmu.readByteAt(this._r.pc++);
      if (numBytes > 1){
        param += this.mmu.readByteAt(this._r.pc++) << 8;
      }
    }
    return param;
  }

  /**
   * @param opcode
   * @returns {string} command given the opcode
   * @private
   */
  _getCommand(opcode) {
    if (this.commands[opcode] != null) {
      return this.commands[opcode];
    } else {
      throw new Error(`[${Utils.hex4(this._r.pc - 1)}] ${Utils.hex2(opcode)} opcode not implemented.`);
    }
  }

  /**
   * @return {number} next opcode
   * @private
   */
  _nextOpcode() {
    return this.mmu.readByteAt(this._r.pc++);
  }

  /**
   * Jumps to address
   * @param {number} 16 bits
   */
  jp(nn){
    this._r.pc = nn;
  }

  /**
   * Does nothing
   */
  nop(){}

  /**
   * XOR register a, result in a.
   */
  xor_a(){
    this._xor(this._r.a);
  }

  /**
   * XOR register b, result in a.
   */
  xor_b(){
    this._xor(this._r.b);
  }

  xor_c(){
    this._xor(this._r.c);
  }

  xor_d(){
    this._xor(this._r.d);
  }

  xor_e(){
    this._xor(this._r.e);
  }

  xor_h(){
    this._xor(this._r.h);
  }

  xor_l(){
    this._xor(this._r.l);
  }

  xor_hl(){
    this._xor(this.mmu.readByteAt(this.hl()));
  }

  xor_n(n){
    this._xor(n);
  }

  /**
   * XOR byte n with register a.
   * @param {number} byte
   * @private
   */
  _xor(n){
    this._r.a ^= n;
    this.resetFlags();
    if (this._r.a === 0){
      this.setZ(1);
    }
  }

  /**
   * Resets all flags.
   */
  resetFlags(){
    this.setZ(0); this.setN(0); this.setH(0); this.setC(0);
  }

  /**
   * @returns {number} flag Z
   */
  Z(){
    return this._r._f >> 7;
  }

  /**
   * @param {number} value Z
   */
  setZ(value){
    if (value === 1){
      this._r._f |= 0x80;
    } else if (value === 0) {
      this._r._f &= 0x7f;
    } else {
      Logger.error(`Cannot set flag Z with ${value}`);
    }
  }

  /**
   * @returns {number} flag N
   */
  N(){
    return (this._r._f & 0x40) >> 6;
  }

  /**
   * @param {0|1} flag N
   */
  setN(value){
    if (value === 1){
      this._r._f |= 0x40;
    } else if (value === 0) {
      this._r._f &= 0xbf;
    } else {
      Logger.error(`Cannot set flag N with ${value}`);
    }
  }

  /**
   * @returns {number} flag H
   */
  H() {
    return (this._r._f & 0x20) >> 5;
  }

  /**
   * @param {0|1} flag H
   */
  setH(value) {
    if (value === 1){
      this._r._f |= 0x20;
    } else if (value === 0) {
      this._r._f &= 0xdf;
    } else {
      Logger.error(`Cannot set flag H with ${value}`);
    }
  }

  /**
   * @returns {number} flag C
   */
  C() {
    return (this._r._f & 0x10) >> 4;
  }

  /**
   * @param {0|1} flag C
   */
  setC(value) {
    if (value === 1){
      this._r._f |= 0x10;
    } else if (value === 0){
      this._r._f &= 0xef;
    } else {
      Logger.error(`Cannot set flag C with ${value}`);
    }
  }

  /**
   * Loads 16 bits nn into bc.
   * @param {number} 16 bits
   */
  ld_bc_nn(nn) {
    this._ld_rr_nn('b', 'c', nn);
  }

  /**
   * Loads 16 bits nn into de.
   * @param {number} 16 bits
   */
  ld_de_nn(nn) {
    this._ld_rr_nn('d', 'e', nn);
  }

  /**
   * Loads 16 bits nn into hl.
   * @param {number} 16 bits
   */
  ld_hl_nn(nn) {
    this._ld_rr_nn('h', 'l', nn);
  }

  /**
   * Loads 16 bits nn into sp.
   * @param {number} 16 bits
   */
  ld_sp_nn(nn) {
    this._r.sp = nn;
  }

  /**
   * Loads MSB in r1, LSB in r2
   * @param {string} r1
   * @param {string} r2
   * @param {number} 16 bits
   * @private
   */
  _ld_rr_nn(r1, r2, nn){
    this._r[r1] = ((nn & 0xff00) >> 8);
    this._r[r2] = nn & 0x00ff;
  }

  /**
   * Loads 8 bits into b
   * @param n
   */
  ld_b_n(n){
    this._ld_r_n('b', n);
  }

  /**
   * Loads 8 bits into c
   * @param n
   */
  ld_c_n(n){
    this._ld_r_n('c', n);
  }

  /**
   * Loads 8 bits into d
   * @param n
   */
  ld_d_n(n){
    this._ld_r_n('d', n);
  }

  /**
   * Loads 8 bits into e
   * @param n
   */
  ld_e_n(n){
    this._ld_r_n('e', n);
  }

  /**
   * Loads 8 bits into h
   * @param n
   */
  ld_h_n(n){
    this._ld_r_n('h', n);
  }

  /**
   * Loads 8 bits into l
   * @param n
   */
  ld_l_n(n){
    this._ld_r_n('l', n);
  }

  /**
   * Loads 8 bits into register r
   * @param r
   * @param n
   * @private
   */
  _ld_r_n(r, n){
    this._r[r] = n;
  }

  /**
   * Loads register a into a.
   */
  ld_a_a(){
    this.ld_a_n(this._r.a);
  }

  /**
   * Loads register b into a.
   */
  ld_a_b(){
    this.ld_a_n(this._r.b);
  }

  /**
   * Loads register c into a.
   */
  ld_a_c(){
    this.ld_a_n(this._r.c);
  }

  /**
   * Loads register a into d.
   */
  ld_a_d(){
    this.ld_a_n(this._r.d);
  }

  /**
   * Loads register e into a.
   */
  ld_a_e(){
    this.ld_a_n(this._r.e);
  }

  /**
   * Loads register h into a.
   */
  ld_a_h(){
    this.ld_a_n(this._r.h);
  }

  /**
   * Loads register l into a.
   */
  ld_a_l(){
    this.ld_a_n(this._r.l);
  }

  /**
   * Loads address memory of bc into a.
   */
  ld_a_bc(){
    this.ld_a_n(this.mmu.readByteAt(this.bc()));
  }

  /**
   * Loads address memory of de into a.
   */
  ld_a_de(){
    this.ld_a_n(this.mmu.readByteAt(this.de()));
  }

  /**
   * Loads address memory of hl into a.
   */
  ld_a_hl(){
    this.ld_a_n(this.mmu.readByteAt(this.hl()));
  }

  /**
   * Loads address memory of nn into a.
   */
  ld_a_nn(nn){
    this.ld_a_n(this.mmu.readByteAt(nn));
  }

  /**
   * Loads 8 bits into register a.
   * @param n
   */
  ld_a_n(n){
    this._r.a = n;
  }

  /**
   * Loads a with value at address hl. Decrements hl.
   */
  ldd_a_hl(){
    this._r.a = this.mmu.readByteAt(this.hl());
    this.dec_hl();
  }

  /**
   * Puts a into memory address hl. Decrements hl.
   */
  ldd_hl_a(){
    this.mmu.writeByteAt(this.hl(), this._r.a);
    this.dec_hl();
  }

  /**
   * Decrements a by 1.
   */
  dec_a(){
    this._dec_r('a');
  }

  dec_b(){
    this._dec_r('b');
  }

  dec_c(){
    this._dec_r('c');
  }

  dec_d(){
    this._dec_r('d');
  }

  dec_e(){
    this._dec_r('e');
  }

  dec_h(){
    this._dec_r('h');
  }

  dec_l(){
    this._dec_r('l');
  }

  /**
   * Decrements register r by 1.
   * @param {string} register
   * @private
   */
  _dec_r(r){

    this.setN(1); // subtracting

    if ((this._r[r] & 0x0f) === 0){
      this.setH(1); // half carry
    } else {
      this.setH(0);
    }

    if (this._r[r] === 0){
      this._r[r] = 0xff; // loop value
    } else {
      this._r[r]--;
    }

    if (this._r[r] === 0){
      this.setZ(1); // result is zero
    } else {
      this.setZ(0);
    }
  }

  dec_0x_hl(){
    let value = this.mmu.readByteAt(this.hl());
    this.mmu.writeByteAt(this.hl(), --value);
  }

  /**
   * Decrements bc by 1.
   */
  dec_bc(){
    this._dec_rr('b', 'c');
  }

  /**
   * Decrements de by 1.
   */
  dec_de(){
    this._dec_rr('d', 'e');
  }

  /**
   * Decrements hl by 1.
   */
  dec_hl(){
    this._dec_rr('h', 'l');
  }

  /**
   * Decrements sp by 1.
   */
  dec_sp(){
    this._r.sp--;
  }

  /**
   * Decrements the 16bits register r1r2 by 1.
   * @param r1
   * @param r2
   * @private
   */
  _dec_rr(r1, r2){
    const value = this[r1+r2]() - 1;
    this._r[r1] = (value & 0xff00) >> 8;
    this._r[r2] = value & 0x00ff;
  }

  /**
   * Jumps to current address + n if last operation was not zero.
   * @param {signed int} n
   */
  jr_nz_n(n){
    if (this.Z() === 0){
      this._r.pc += Utils.uint8ToInt8(n);
    }
  }

  /** 
   * Disables interruptions after executing the next instruction.
   */
  di(){
    // TODO implement interrupts
  }

  /** 
   * Enables interruptions after executing the next instruction.
   */
  ei(){
    // TODO implement interrupts
  }

  ldh_n_a(n){
    if (n < 0xff){
      this.mmu.writeByteAt(0xff00 + n, this._r.a);
    }
  }

  ldh_a_n(n){
    this._r.a = this.mmu.readByteAt(0xff00 + n);
  }

  cp_a(){
    this.cp_n(this._r.a);
  }

  cp_b(){
    this.cp_n(this._r.b);
  }

  cp_c(){
    this.cp_n(this._r.c);
  }

  cp_d(){
    this.cp_n(this._r.d);
  }

  cp_e(){
    this.cp_n(this._r.e);
  }

  cp_h(){
    this.cp_n(this._r.h);
  }

  cp_l(){
    this.cp_n(this._r.l);
  }

  cp_hl(){
    this.cp_n(this.mmu.readByteAt(this.hl()));
  }

  cp_n(n){
    
    this.setN(1); this.setZ(0); this.setC(0);
    var diff = this._r.a - n;
    
    if (diff == 0){
      this.setZ(1);
    } else if (diff < 0){
       this.setC(1);
    }
  }

  /**
   * Tests bit 7 in h
   */
  bit_7_h() {
    this._bit_b_r(7, this._r.h);
  }

  /**
   * Tests bit b in register r
   * @param b
   * @param r
   * @private
   */
  _bit_b_r(b, r) {
    if ((r & (1 << b)) >> b) {
      this.setZ(0);
    } else {
      this.setZ(1);
    }
    this.setN(0); this.setH(1);
  }

  /**
   * Loads register a into memory address 0xff00 + c
   */
  ld_0x_c_a(){
    this.mmu.writeByteAt(0xff00 + this._r.c, this._r.a);
  }

  inc_a(){
    this._inc_r('a');
  }

  inc_b(){
    this._inc_r('b');
  }

  inc_c(){
    this._inc_r('c');
  }

  inc_d(){
    this._inc_r('d');
  }

  inc_e(){
    this._inc_r('e');
  }

  inc_h(){
    this._inc_r('h');
  }

  inc_l(){
    this._inc_r('l');
  }

  inc_bc(){
    this._inc_rr('b', 'c');
  }

  inc_de(){
    this._inc_rr('d', 'e');
  }

  inc_hl(){
    this._inc_rr('h', 'l');
  }

  inc_sp(){
    if (this._r.sp >= this.mmu.ADDR_MAX - 1){
      throw new Error(`Cannot increase stack pointer more than ${this._r.sp}`);
    }
    this._r.sp++;
  }

  _inc_rr(r1, r2){
    const value = (this._r[r1] << 8) + this._r[r2] + 1;
    if ((value & 0x10000) > 0){
      // TODO verify if INC 16 bits loops to 0
      this._r[r1] = 0;
      this._r[r2] = 0;
    } else {
      this._r[r1] = (value & 0xff00) >> 8;
      this._r[r2] = value & 0x00ff;
    }
  }

  /**
   * Increments the value at memory location hl by 1.
   */
  inc_0x_hl(){
    let value = this.mmu.readByteAt(this.hl());

    if (value === 0xff){
      this.mmu.writeByteAt(this.hl(), 0x00);
      this.setZ(1);
    } else {
      this.mmu.writeByteAt(this.hl(), ++value);
      this.setZ(0);
    }
    if (value === 0x10){
      this.setH(1);
    } else {
      this.setH(0);
    }
    this.setN(0);
  }

  /**
   * Increases register r by 1.
   * @param r
   * @private
   */
  _inc_r(r){
    if (this._r[r] === 0xff){
      this._r[r] = 0x00;
      this.setZ(1);
    } else {
      this._r[r]++;
      this.setZ(0);
    }
    if (this._r[r] === 0x10){
      this.setH(1);
    } else {
      this.setH(0);
    }
    this.setN(0);
  }

  ld_b_a(){
    this._ld_r_a('b');
  }

  ld_c_a(){
    this._ld_r_a('c');
  }

  ld_d_a(){
    this._ld_r_a('d');
  }

  ld_e_a(){
    this._ld_r_a('e');
  }

  ld_h_a(){
    this._ld_r_a('h');
  }

  ld_l_a(){
    this._ld_r_a('l');
  }

  _ld_r_a(r){
    this._r[r] = this._r.a;
  }

  ld_0x_bc_a(){
    this._ld_0x_nn_a(this.bc());
  }

  ld_0x_de_a(){
    this._ld_0x_nn_a(this.de());
  }

  ld_0x_hl_a(){
    this._ld_0x_nn_a(this.hl());
  }

  ld_0x_nn_a(addr){
    this._ld_0x_nn_a(addr);
  }

  _ld_0x_nn_a(addr){
    this.mmu.writeByteAt(addr, this._r.a);
  }

  /**
   * Calls a routine at a given address, saving the pc in the
   * stack.
   * @param addr
   */
  call(addr){
    this.mmu.writeByteAt(--this._r.sp, Utils.msb(this._r.pc));
    this.mmu.writeByteAt(--this._r.sp, Utils.lsb(this._r.pc));
    this._r.pc = addr;
  }

  /**
   * Pushes register af into stack.
   */
  push_af(){
    this._push('a', '_f');
  }

  /**
   * Pushes register bc into stack.
   */
  push_bc(){
    this._push('b', 'c');
  }

  /**
   * Pushes register de into stack.
   */
  push_de(){
    this._push('d', 'e');
  }

  /**
   * Pushes register hl into stack.
   */
  push_hl(){
    this._push('h', 'l');
  }

  /**
   * Pushes register r1 and r2 into the stack. Decrements sp twice.
   * @param r1
   * @param r2
   * @private
   */
  _push(r1, r2){
    this.mmu.writeByteAt(--this._r.sp, this._r[r1]);
    this.mmu.writeByteAt(--this._r.sp, this._r[r2]);
  }

  /**
   * Pops two bytes off the stack into af
   */
  pop_af(){
    this._pop('a', '_f');
  }

  /**
   * Pops two bytes off the stack into bc
   */
  pop_bc(){
    this._pop('b', 'c');
  }

  /**
   * Pops two bytes off the stack into de
   */
  pop_de(){
    this._pop('d', 'e');
  }

  /**
   * Pops two bytes off the stack into hl
   */
  pop_hl(){
    this._pop('h', 'l');
  }

  /**
   * Pops two bytes off the stack into register r1,r2
   * @param r1
   * @param r2
   * @private
   */
  _pop(r1, r2){
    this._r[r2] = this.mmu.readByteAt(this._r.sp++);
    this._r[r1] = this.mmu.readByteAt(this._r.sp++);
  }

  rl_a(){
    this._rl_r('a');
  }

  rla(){
    this.rl_a();
  }

  rl_b(){
    this._rl_r('b');
  }

  rl_c(){
    this._rl_r('c');
  }

  rl_d(){
    this._rl_r('d');
  }

  rl_e(){
    this._rl_r('e');
  }

  rl_h(){
    this._rl_r('h');
  }

  rl_l(){
    this._rl_r('l');
  }

  /**
   * Rotates left register r with carry flag.
   * @param r
   * @private
   */
  _rl_r(r){

    const rotated = (this._r[r] << 1) + this.C();
    this._r[r] = rotated & 0xff;
    this.setC((rotated & 0x100) >> 8);

    if (this._r[r] === 0){
      this.setZ(1);
    } else {
      this.setZ(0);
    }

    this.setN(0);
    this.setH(0);
  }

  /**
   * Rotates left the value at memory hl. Sets carry flag.
   */
  rl_0x_hl(){

    const value = this.mmu.readByteAt(this.hl());

    if ((value & 0x80) > 0){
      this.setC(1);
    } else {
      this.setC(0);
    }

    const rotated = (value << 1) & 0xff;
    this.mmu.writeByteAt(this.hl(), rotated);

    if (rotated === 0){
      this.setZ(1);
    } else {
      this.setZ(0);
    }

    this.setN(0);
    this.setH(0);
  }
}