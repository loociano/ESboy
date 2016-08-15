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

    this.commands = {
      0x00: {fn: this.nop, param: 0},
      0x01: {fn: this.ld_bc_nn, param: 2},
      0x05: {fn: this.dec_b, param: 0},
      0x06: {fn: this.ld_b_n, param: 1},
      0x0a: {fn: this.ld_a_bc, param: 0},
      0x0b: {fn: this.dec_bc, param: 0},
      0x0d: {fn: this.dec_c, param: 0},
      0x0e: {fn: this.ld_c_n, param: 1},
      0x11: {fn: this.ld_de_nn, param: 2},
      0x15: {fn: this.dec_d, param: 0},
      0x16: {fn: this.ld_d_n, param: 1},
      0x1a: {fn: this.ld_a_de, param: 0},
      0x1b: {fn: this.dec_de, param: 0},
      0x1d: {fn: this.dec_e, param: 0},
      0x1e: {fn: this.ld_e_n, param: 1},
      0x20: {fn: this.jr_nz_n, param: 1},
      0x21: {fn: this.ld_hl_nn, param: 2},
      0x25: {fn: this.dec_h, param: 0},
      0x2b: {fn: this.dec_hl, param: 0},
      0x2d: {fn: this.dec_l, param: 0},
      0x2e: {fn: this.ld_l_n, param: 1},
      0x26: {fn: this.ld_h_n, param: 1},
      0x31: {fn: this.ld_sp_nn, param: 2},
      0x32: {fn: this.ldd_hl_a, param: 0},
      0x35: {fn: this.dec_0x_hl, param: 0},
      0x3a: {fn: this.ldd_a_hl, param: 0},
      0x3b: {fn: this.dec_sp, param: 0},
      0x3d: {fn: this.dec_a, param: 0},
      0x3e: {fn: this.ld_a_n, param: 1},
      0x78: {fn: this.ld_a_b, param: 0},
      0x79: {fn: this.ld_a_c, param: 0},
      0x7a: {fn: this.ld_a_d, param: 0},
      0x7b: {fn: this.ld_a_e, param: 0},
      0x7c: {fn: this.ld_a_h, param: 0},
      0x7d: {fn: this.ld_a_l, param: 0},
      0x7e: {fn: this.ld_a_hl, param: 0},
      0x7f: {fn: this.ld_a_a, param: 0},
      0xa8: {fn: this.xor_b, param: 0},
      0xa9: {fn: this.xor_c, param: 0},
      0xaa: {fn: this.xor_d, param: 0},
      0xab: {fn: this.xor_e, param: 0},
      0xac: {fn: this.xor_h, param: 0},
      0xad: {fn: this.xor_l, param: 0},
      0xae: {fn: this.xor_hl, param: 0},
      0xaf: {fn: this.xor_a, param: 0},
      0xc3: {fn: this.jp, param: 2},
      0xee: {fn: this.xor_n, param: 1},
      0xfa: {fn: this.ld_a_nn, param: 2}
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
  }

  /**
   * Executes the next command and increases the pc.
   */
  execute() {

    const command = this.getCommand(this.nextCommand());
    const param = this._getInstrParams(command.param);

    Logger.state(this, command.fn, command.param, param);

    if(command.fn === this.jp || command.fn === this.jr_nz_n){
      command.fn.call(this, param);
      return;
    }

    command.fn.call(this, param);
    this._r.pc++;
  }

  /**
   * @param numBytes
   * @returns {*}
   * @private
   */
  _getInstrParams(numBytes){
    let param;
    if(numBytes > 0){
      param = this.mmu.byteAt(++this._r.pc);
      if (numBytes > 1){
        param += this.mmu.byteAt(++this._r.pc) << 8;
      }
    }
    return param;
  }

  /**
   * @param opcode
   * @returns {string} command given the opcode
   */
  getCommand(opcode){
    if (this.commands[opcode] != null){
      return this.commands[opcode];
    } else {
      throw new Error(`[${Utils.hexStr(this._r.pc)}] ${Utils.hexStr(opcode)} opcode not implemented.`);
    }
  }

  /**
   * @return {number} next opcode
   */
  nextCommand() {
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
  nop(){
  }

  xor_a(){
    this._xor(this._r.a);
  }

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
   * @param n
   * @private
   */
  _xor(n){
    this._r.a ^= n;
    this.resetFlags();
    if (this._r.a === 0){
      this.setZ(1);
    }
  }

  resetFlags(){
    this.setZ(0); this.setN(0); this.setH(0); this.setC(0);
  }

  getZ(){
    return this._r._f >> 7;
  }

  setZ(value){
    if (value === 1){
      this._r._f |= 0x80;
    } else if (value === 0) {
      this._r._f &= 0x7f;
    } else {
      Logger.error(`Cannot set flag Z with ${value}`);
    }
  }

  getN(){
    return (this._r._f & 0x40) >> 6;
  }

  setN(value){
    if (value === 1){
      this._r._f |= 0x40;
    } else if (value === 0) {
      this._r._f &= 0xbf;
    } else {
      Logger.error(`Cannot set flag N with ${value}`);
    }
  }

  getH() {
    return (this._r._f & 0x20) >> 5;
  }

  setH(value) {
    if (value === 1){
      this._r._f |= 0x20;
    } else if (value === 0) {
      this._r._f &= 0xdf;
    } else {
      Logger.error(`Cannot set flag H with ${value}`);
    }
  }

  getC() {
    return (this._r._f & 0x10) >> 4;
  }

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
    this._r.pc++;

    if (this.getZ() === 0){
      this._r.pc += Utils.uint8ToInt8(n);
    }
  }
}