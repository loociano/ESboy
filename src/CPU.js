import Utils from './Utils';
import Logger from './logger';
import MMU from './mmu';

export default class CPU {

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

    if (filename.indexOf('bios') != -1){
      this._r.pc = 0;
    }

    this.commands = {
      0x00: {fn: this.nop, paramBytes: 0},
      0x01: {fn: this.ld_bc_nn, paramBytes: 2},
      0x05: {fn: this.dec_b, paramBytes: 0},
      0x06: {fn: this.ld_b_n, paramBytes: 1},
      0x0a: {fn: this.ld_a_bc, paramBytes: 0},
      0x0b: {fn: this.dec_bc, paramBytes: 0},
      0x0d: {fn: this.dec_c, paramBytes: 0},
      0x0e: {fn: this.ld_c_n, paramBytes: 1},
      0x11: {fn: this.ld_de_nn, paramBytes: 2},
      0x15: {fn: this.dec_d, paramBytes: 0},
      0x16: {fn: this.ld_d_n, paramBytes: 1},
      0x1a: {fn: this.ld_a_de, paramBytes: 0},
      0x1b: {fn: this.dec_de, paramBytes: 0},
      0x1d: {fn: this.dec_e, paramBytes: 0},
      0x1e: {fn: this.ld_e_n, paramBytes: 1},
      0x20: {fn: this.jr_nz_n, paramBytes: 1},
      0x21: {fn: this.ld_hl_nn, paramBytes: 2},
      0x25: {fn: this.dec_h, paramBytes: 0},
      0x2b: {fn: this.dec_hl, paramBytes: 0},
      0x2d: {fn: this.dec_l, paramBytes: 0},
      0x2e: {fn: this.ld_l_n, paramBytes: 1},
      0x26: {fn: this.ld_h_n, paramBytes: 1},
      0x31: {fn: this.ld_sp_nn, paramBytes: 2},
      0x32: {fn: this.ldd_hl_a, paramBytes: 0},
      0x35: {fn: this.dec_0x_hl, paramBytes: 0},
      0x3a: {fn: this.ldd_a_hl, paramBytes: 0},
      0x3b: {fn: this.dec_sp, paramBytes: 0},
      0x3d: {fn: this.dec_a, paramBytes: 0},
      0x3e: {fn: this.ld_a_n, paramBytes: 1},
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
      0xc3: {fn: this.jp, paramBytes: 2},
      0xe0: {fn: this.ldh_n_a, paramBytes: 1},
      0xee: {fn: this.xor_n, paramBytes: 1},
      0xf0: {fn: this.ldh_a_n, paramBytes: 1},
      0xf3: {fn: this.di, paramBytes: 0},
      0xfa: {fn: this.ld_a_nn, paramBytes: 2},
      0xfb: {fn: this.ei, paramBytes: 0},
      0xfe: {fn: this.cp_n, paramBytes: 1}
    };

    this.extended = {
      0x7c: {fn: this.bit_7_h, paramBytes: 0}
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
    return this.mmu.byteAt(0xffff);
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

    const opcode = this._nextOpcode();
    let command;

    if (opcode === this.EXTENDED_PREFIX){
      command = this._getExtendedCommand(this._nextOpcode());
    } else {
      command = this._getCommand(opcode);
    }

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
      param = this.mmu.byteAt(this._r.pc++);
      if (numBytes > 1){
        param += this.mmu.byteAt(this._r.pc++) << 8;
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
      throw new Error(`[${Utils.hex4(this._r.pc - 1)}] ${Utils.hexStr(opcode)} opcode not implemented.`);
    }
  }

  _getExtendedCommand(opcode) {
    if (this.extended[opcode] != null) {
      return this.extended[opcode];
    } else {
      throw new Error(`[${Utils.hex4(this._r.pc - 1)}] ${Utils.hexStr(opcode)} extended opcode not implemented.`);
    }
  }

  /**
   * @return {number} next opcode
   * @private
   */
  _nextOpcode() {
    return this.mmu.byteAt(this._r.pc++);
  }

  /**
   * Peeks next command, without incrementing the pc.
   * (for testing)
   * @returns {number}
   */
  peekNextCommand(){
    return this.mmu.byteAt(this._r.pc);
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
    this._xor(this.mmu.byteAt(this.hl()));
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
   * @param {0|1} flag Z
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
   * @returns {0|1} flag H
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
   * @returns {0|1} flag C
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
    this.ld_a_n(this.mmu.byteAt(this.bc()));
  }

  /**
   * Loads address memory of de into a.
   */
  ld_a_de(){
    this.ld_a_n(this.mmu.byteAt(this.de()));
  }

  /**
   * Loads address memory of hl into a.
   */
  ld_a_hl(){
    this.ld_a_n(this.mmu.byteAt(this.hl()));
  }

  /**
   * Loads address memory of nn into a.
   */
  ld_a_nn(nn){
    this.ld_a_n(this.mmu.byteAt(nn));
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
    this._r.a = this.mmu.byteAt(this.hl());
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

    this.setN(1); // substracting

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
    let value = this.mmu.byteAt(this.hl());
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
    this._r.a = this.mmu.byteAt(0xff00 + n);
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
    this.cp_n(this.mmu.byteAt(this.hl()));
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
}