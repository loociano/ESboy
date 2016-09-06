import Utils from './utils';
import Logger from './logger';
import config from './config';

export default class CPU {

  /**
   * @param {string} filename
   * @param {Object} ctx
   */
  constructor(mmu, ipc) {

    if (mmu == null) {
      throw new Error('Missing mmu');
    }

    if (ipc == null){
      throw new Error('Missing ipc');
    }

    this.mmu = mmu;
    this.ipc = ipc;

    this._t = 0; // measure CPU cycles
    this.isPainting = false;

    // Constants
    this.EXTENDED_PREFIX = 0xcb;
    this.ADDR_VBLANK_INTERRUPT = 0x0040;

    // Masks
    this.IF_VBLANK_ON = 0b00001;
    this.IF_VBLANK_OFF = 0b11110;

    this._r = {
      pc: 0,
      sp: this.mmu.ADDR_MAX - 1,
      a: 0x01,
      b: 0x00,
      c: 0x13,
      d: 0x00,
      e: 0xd8,
      _f: 0xb0,
      h: 0x01,
      l: 0x4d,
      ime: 1
    };

    this._attach_reset_bit_functions();

    this.commands = {
      0x00: {fn: this.nop, paramBytes: 0},
      0x01: {fn: this.ld_bc_nn, paramBytes: 2},
      0x02: {fn: this.ld_0xbc_a, paramBytes: 0},
      0x03: {fn: this.inc_bc, paramBytes: 0},
      0x04: {fn: this.inc_c, paramBytes: 0},
      0x05: {fn: this.dec_b, paramBytes: 0},
      0x06: {fn: this.ld_b_n, paramBytes: 1},
      0x09: {fn: this.add_hl_bc, paramBytes: 0},
      0x0a: {fn: this.ld_a_0xbc, paramBytes: 0},
      0x0b: {fn: this.dec_bc, paramBytes: 0},
      0x0c: {fn: this.inc_c, paramBytes: 0},
      0x0d: {fn: this.dec_c, paramBytes: 0},
      0x0e: {fn: this.ld_c_n, paramBytes: 1},
      0x11: {fn: this.ld_de_nn, paramBytes: 2},
      0x12: {fn: this.ld_0xde_a, paramBytes: 0},
      0x13: {fn: this.inc_de, paramBytes: 0},
      0x14: {fn: this.inc_d, paramBytes: 0},
      0x15: {fn: this.dec_d, paramBytes: 0},
      0x16: {fn: this.ld_d_n, paramBytes: 1},
      0x17: {fn: this.rla, paramBytes: 0},
      0x18: {fn: this.jp_n, paramBytes: 1},
      0x19: {fn: this.add_hl_de, paramBytes: 0},
      0x1a: {fn: this.ld_a_0xde, paramBytes: 0},
      0x1b: {fn: this.dec_de, paramBytes: 0},
      0x1c: {fn: this.inc_e, paramBytes: 0},
      0x1d: {fn: this.dec_e, paramBytes: 0},
      0x1e: {fn: this.ld_e_n, paramBytes: 1},
      0x20: {fn: this.jr_nz_n, paramBytes: 1},
      0x21: {fn: this.ld_hl_nn, paramBytes: 2},
      0x22: {fn: this.ldi_0xhl_a, paramBytes: 0},
      0x23: {fn: this.inc_hl, paramBytes: 0},
      0x24: {fn: this.inc_h, paramBytes: 0},
      0x25: {fn: this.dec_h, paramBytes: 0},
      0x28: {fn: this.jr_z_n, paramBytes: 1},
      0x29: {fn: this.add_hl_hl, paramBytes: 0},
      0x2a: {fn: this.ldi_a_0xhl, paramBytes: 0},
      0x2b: {fn: this.dec_hl, paramBytes: 0},
      0x2c: {fn: this.inc_l, paramBytes: 0},
      0x2d: {fn: this.dec_l, paramBytes: 0},
      0x2e: {fn: this.ld_l_n, paramBytes: 1},
      0x2f: {fn: this.cpl, paramBytes: 0},
      0x26: {fn: this.ld_h_n, paramBytes: 1},
      0x30: {fn: this.jr_nc_n, paramBytes: 1},
      0x31: {fn: this.ld_sp_nn, paramBytes: 2},
      0x32: {fn: this.ldd_hl_a, paramBytes: 0},
      0x33: {fn: this.inc_sp, paramBytes: 0},
      0x34: {fn: this.inc_0xhl, paramBytes: 0},
      0x35: {fn: this.dec_0xhl, paramBytes: 0},
      0x36: {fn: this.ld_0xhl_n, paramBytes: 1},
      0x38: {fn: this.jr_c_n, paramBytes: 0},
      0x39: {fn: this.add_hl_sp, paramBytes: 0},
      0x3a: {fn: this.ldd_a_hl, paramBytes: 0},
      0x3b: {fn: this.dec_sp, paramBytes: 0},
      0x3d: {fn: this.dec_a, paramBytes: 0},
      0x3c: {fn: this.inc_a, paramBytes: 0},
      0x3e: {fn: this.ld_a_n, paramBytes: 1},
      0x40: {fn: this.ld_b_b, paramBytes: 0},
      0x41: {fn: this.ld_b_c, paramBytes: 0},
      0x42: {fn: this.ld_b_d, paramBytes: 0},
      0x43: {fn: this.ld_b_e, paramBytes: 0},
      0x44: {fn: this.ld_b_h, paramBytes: 0},
      0x45: {fn: this.ld_b_l, paramBytes: 0},
      0x46: {fn: this.ld_b_0xhl, paramBytes: 0},
      0x47: {fn: this.ld_b_a, paramBytes: 0},
      0x48: {fn: this.ld_c_b, paramBytes: 0},
      0x49: {fn: this.ld_c_c, paramBytes: 0},
      0x4a: {fn: this.ld_c_d, paramBytes: 0},
      0x4b: {fn: this.ld_c_e, paramBytes: 0},
      0x4c: {fn: this.ld_c_h, paramBytes: 0},
      0x4d: {fn: this.ld_c_l, paramBytes: 0},
      0x4e: {fn: this.ld_c_0xhl, paramBytes: 0},
      0x4f: {fn: this.ld_c_a, paramBytes: 0},
      0x50: {fn: this.ld_d_b, paramBytes: 0},
      0x51: {fn: this.ld_d_c, paramBytes: 0},
      0x52: {fn: this.ld_d_d, paramBytes: 0},
      0x53: {fn: this.ld_d_e, paramBytes: 0},
      0x54: {fn: this.ld_d_h, paramBytes: 0},
      0x55: {fn: this.ld_d_l, paramBytes: 0},
      0x56: {fn: this.ld_d_0xhl, paramBytes: 0},
      0x57: {fn: this.ld_d_a, paramBytes: 0},
      0x58: {fn: this.ld_e_b, paramBytes: 0},
      0x59: {fn: this.ld_e_c, paramBytes: 0},
      0x5a: {fn: this.ld_e_d, paramBytes: 0},
      0x5b: {fn: this.ld_e_e, paramBytes: 0},
      0x5c: {fn: this.ld_e_h, paramBytes: 0},
      0x5d: {fn: this.ld_e_l, paramBytes: 0},
      0x5e: {fn: this.ld_e_0xhl, paramBytes: 0},
      0x5f: {fn: this.ld_e_a, paramBytes: 0},
      0x60: {fn: this.ld_h_b, paramBytes: 0},
      0x61: {fn: this.ld_h_c, paramBytes: 0},
      0x62: {fn: this.ld_h_d, paramBytes: 0},
      0x63: {fn: this.ld_h_e, paramBytes: 0},
      0x64: {fn: this.ld_h_h, paramBytes: 0},
      0x65: {fn: this.ld_h_l, paramBytes: 0},
      0x66: {fn: this.ld_h_0xhl, paramBytes: 0},
      0x67: {fn: this.ld_h_a, paramBytes: 0},
      0x68: {fn: this.ld_l_b, paramBytes: 0},
      0x69: {fn: this.ld_l_c, paramBytes: 0},
      0x6a: {fn: this.ld_l_d, paramBytes: 0},
      0x6b: {fn: this.ld_l_e, paramBytes: 0},
      0x6c: {fn: this.ld_l_h, paramBytes: 0},
      0x6d: {fn: this.ld_l_l, paramBytes: 0},
      0x6e: {fn: this.ld_l_0xhl, paramBytes: 0},
      0x6f: {fn: this.ld_l_a, paramBytes: 0},
      0x70: {fn: this.ld_0xhl_b, paramBytes: 0},
      0x71: {fn: this.ld_0xhl_c, paramBytes: 0},
      0x72: {fn: this.ld_0xhl_d, paramBytes: 0},
      0x73: {fn: this.ld_0xhl_e, paramBytes: 0},
      0x74: {fn: this.ld_0xhl_h, paramBytes: 0},
      0x75: {fn: this.ld_0xhl_l, paramBytes: 0},
      0x77: {fn: this.ld_0xhl_a, paramBytes: 0},
      0x78: {fn: this.ld_a_b, paramBytes: 0},
      0x79: {fn: this.ld_a_c, paramBytes: 0},
      0x7a: {fn: this.ld_a_d, paramBytes: 0},
      0x7b: {fn: this.ld_a_e, paramBytes: 0},
      0x7c: {fn: this.ld_a_h, paramBytes: 0},
      0x7d: {fn: this.ld_a_l, paramBytes: 0},
      0x7e: {fn: this.ld_a_0xhl, paramBytes: 0},
      0x7f: {fn: this.ld_a_a, paramBytes: 0},
      0x80: {fn: this.add_b, paramBytes: 0},
      0x81: {fn: this.add_c, paramBytes: 0},
      0x82: {fn: this.add_d, paramBytes: 0},
      0x83: {fn: this.add_e, paramBytes: 0},
      0x84: {fn: this.add_h, paramBytes: 0},
      0x85: {fn: this.add_l, paramBytes: 0},
      0x86: {fn: this.add_0xhl, paramBytes: 0},
      0x87: {fn: this.add_a, paramBytes: 0},
      0x90: {fn: this.sub_b, paramBytes: 0},
      0x91: {fn: this.sub_c, paramBytes: 0},
      0x92: {fn: this.sub_d, paramBytes: 0},
      0x93: {fn: this.sub_e, paramBytes: 0},
      0x94: {fn: this.sub_h, paramBytes: 0},
      0x95: {fn: this.sub_l, paramBytes: 0},
      0x96: {fn: this.sub_0xhl, paramBytes: 0},
      0x97: {fn: this.sub_a, paramBytes: 0},
      0xa0: {fn: this.and_b, paramBytes: 0},
      0xa1: {fn: this.and_c, paramBytes: 0},
      0xa2: {fn: this.and_d, paramBytes: 0},
      0xa3: {fn: this.and_e, paramBytes: 0},
      0xa4: {fn: this.and_h, paramBytes: 0},
      0xa5: {fn: this.and_l, paramBytes: 0},
      0xa6: {fn: this.and_0xhl, paramBytes: 0},
      0xa7: {fn: this.and_a, paramBytes: 0},
      0xa8: {fn: this.xor_b, paramBytes: 0},
      0xa9: {fn: this.xor_c, paramBytes: 0},
      0xaa: {fn: this.xor_d, paramBytes: 0},
      0xab: {fn: this.xor_e, paramBytes: 0},
      0xac: {fn: this.xor_h, paramBytes: 0},
      0xad: {fn: this.xor_l, paramBytes: 0},
      0xae: {fn: this.xor_0xhl, paramBytes: 0},
      0xaf: {fn: this.xor_a, paramBytes: 0},
      0xb0: {fn: this.or_b, paramBytes: 0},
      0xb1: {fn: this.or_c, paramBytes: 0},
      0xb2: {fn: this.or_d, paramBytes: 0},
      0xb3: {fn: this.or_e, paramBytes: 0},
      0xb4: {fn: this.or_h, paramBytes: 0},
      0xb5: {fn: this.or_l, paramBytes: 0},
      0xb6: {fn: this.or_0xhl, paramBytes: 0},
      0xb7: {fn: this.or_a, paramBytes: 0},
      0xb8: {fn: this.cp_b, paramBytes: 0},
      0xb9: {fn: this.cp_c, paramBytes: 0},
      0xba: {fn: this.cp_d, paramBytes: 0},
      0xbb: {fn: this.cp_e, paramBytes: 0},
      0xbc: {fn: this.cp_h, paramBytes: 0},
      0xbd: {fn: this.cp_l, paramBytes: 0},
      0xbe: {fn: this.cp_0xhl, paramBytes: 0},
      0xbf: {fn: this.cp_a, paramBytes: 0},
      0xc0: {fn: this.ret_nz, paramBytes: 0},
      0xc1: {fn: this.pop_bc, paramBytes: 0},
      0xc2: {fn: this.jp_nz_nn, paramBytes: 2},
      0xc3: {fn: this.jp, paramBytes: 2},
      0xc5: {fn: this.push_bc, paramBytes: 0},
      0xc6: {fn: this.add_n, paramBytes: 1},
      0xc7: {fn: this.rst_00, paramBytes: 0},
      0xc8: {fn: this.ret_z, paramBytes: 0},
      0xc9: {fn: this.ret, paramBytes: 0},
      0xca: {fn: this.jp_z_nn, paramBytes: 2},
      0xcb10: {fn: this.rl_b, paramBytes: 0},
      0xcb11: {fn: this.rl_c, paramBytes: 0},
      0xcb12: {fn: this.rl_d, paramBytes: 0},
      0xcb13: {fn: this.rl_e, paramBytes: 0},
      0xcb14: {fn: this.rl_h, paramBytes: 0},
      0xcb15: {fn: this.rl_l, paramBytes: 0},
      0xcb16: {fn: this.rl_0xhl, paramBytes: 0},
      0xcb17: {fn: this.rl_a, paramBytes: 0},
      0xcb30: {fn: this.swap_b, paramBytes: 0},
      0xcb31: {fn: this.swap_c, paramBytes: 0},
      0xcb32: {fn: this.swap_d, paramBytes: 0},
      0xcb33: {fn: this.swap_e, paramBytes: 0},
      0xcb34: {fn: this.swap_h, paramBytes: 0},
      0xcb35: {fn: this.swap_l, paramBytes: 0},
      0xcb36: {fn: this.swap_0xhl, paramBytes: 0},
      0xcb37: {fn: this.swap_a, paramBytes: 0},
      0xcb7c: {fn: this.bit_7_h, paramBytes: 0},
      0xcb80: {fn: this.res_0_b, paramBytes: 0},
      0xcb81: {fn: this.res_0_c, paramBytes: 0},
      0xcb82: {fn: this.res_0_d, paramBytes: 0},
      0xcb83: {fn: this.res_0_e, paramBytes: 0},
      0xcb84: {fn: this.res_0_h, paramBytes: 0},
      0xcb85: {fn: this.res_0_l, paramBytes: 0},
      0xcb86: {fn: this.res_0_0xhl, paramBytes: 0},
      0xcb87: {fn: this.res_0_a, paramBytes: 0},
      0xcb88: {fn: this.res_1_b, paramBytes: 0},
      0xcb89: {fn: this.res_1_c, paramBytes: 0},
      0xcb8a: {fn: this.res_1_d, paramBytes: 0},
      0xcb8b: {fn: this.res_1_e, paramBytes: 0},
      0xcb8c: {fn: this.res_1_h, paramBytes: 0},
      0xcb8d: {fn: this.res_1_l, paramBytes: 0},
      0xcb8e: {fn: this.res_1_0xhl, paramBytes: 0},
      0xcb8f: {fn: this.res_1_a, paramBytes: 0},
      0xcb90: {fn: this.res_2_b, paramBytes: 0},
      0xcb91: {fn: this.res_2_c, paramBytes: 0},
      0xcb92: {fn: this.res_2_d, paramBytes: 0},
      0xcb93: {fn: this.res_2_e, paramBytes: 0},
      0xcb94: {fn: this.res_2_h, paramBytes: 0},
      0xcb95: {fn: this.res_2_l, paramBytes: 0},
      0xcb96: {fn: this.res_2_0xhl, paramBytes: 0},
      0xcb97: {fn: this.res_2_a, paramBytes: 0},
      0xcb98: {fn: this.res_3_b, paramBytes: 0},
      0xcb99: {fn: this.res_3_c, paramBytes: 0},
      0xcb9a: {fn: this.res_3_d, paramBytes: 0},
      0xcb9b: {fn: this.res_3_e, paramBytes: 0},
      0xcb9c: {fn: this.res_3_h, paramBytes: 0},
      0xcb9d: {fn: this.res_3_l, paramBytes: 0},
      0xcb9e: {fn: this.res_3_0xhl, paramBytes: 0},
      0xcb9f: {fn: this.res_3_a, paramBytes: 0},
      0xcba0: {fn: this.res_4_b, paramBytes: 0},
      0xcba1: {fn: this.res_4_c, paramBytes: 0},
      0xcba2: {fn: this.res_4_d, paramBytes: 0},
      0xcba3: {fn: this.res_4_e, paramBytes: 0},
      0xcba4: {fn: this.res_4_h, paramBytes: 0},
      0xcba5: {fn: this.res_4_l, paramBytes: 0},
      0xcba6: {fn: this.res_4_0xhl, paramBytes: 0},
      0xcba7: {fn: this.res_4_a, paramBytes: 0},
      0xcba8: {fn: this.res_5_b, paramBytes: 0},
      0xcba9: {fn: this.res_5_c, paramBytes: 0},
      0xcbaa: {fn: this.res_5_d, paramBytes: 0},
      0xcbab: {fn: this.res_5_e, paramBytes: 0},
      0xcbac: {fn: this.res_5_h, paramBytes: 0},
      0xcbad: {fn: this.res_5_l, paramBytes: 0},
      0xcbae: {fn: this.res_5_0xhl, paramBytes: 0},
      0xcbaf: {fn: this.res_5_a, paramBytes: 0},
      0xcbb0: {fn: this.res_6_b, paramBytes: 0},
      0xcbb1: {fn: this.res_6_c, paramBytes: 0},
      0xcbb2: {fn: this.res_6_d, paramBytes: 0},
      0xcbb3: {fn: this.res_6_e, paramBytes: 0},
      0xcbb4: {fn: this.res_6_h, paramBytes: 0},
      0xcbb5: {fn: this.res_6_l, paramBytes: 0},
      0xcbb6: {fn: this.res_6_0xhl, paramBytes: 0},
      0xcbb7: {fn: this.res_6_a, paramBytes: 0},
      0xcbb8: {fn: this.res_7_b, paramBytes: 0},
      0xcbb9: {fn: this.res_7_c, paramBytes: 0},
      0xcbba: {fn: this.res_7_d, paramBytes: 0},
      0xcbbb: {fn: this.res_7_e, paramBytes: 0},
      0xcbbc: {fn: this.res_7_h, paramBytes: 0},
      0xcbbd: {fn: this.res_7_l, paramBytes: 0},
      0xcbbe: {fn: this.res_7_0xhl, paramBytes: 0},
      0xcbbf: {fn: this.res_7_a, paramBytes: 0},
      0xcd: {fn: this.call, paramBytes: 2},
      0xcf: {fn: this.rst_08, paramBytes: 0},
      0xd0: {fn: this.ret_nc, paramBytes: 0},
      0xd1: {fn: this.pop_de, paramBytes: 0},
      0xd2: {fn: this.jp_nc_nn, paramBytes: 2},
      0xd5: {fn: this.push_de, paramBytes: 0},
      0xd6: {fn: this.sub_n, paramBytes: 1},
      0xd7: {fn: this.rst_10, paramBytes: 0},
      0xd8: {fn: this.ret_c, paramBytes: 0},
      0xd9: {fn: this.reti, paramBytes: 0},
      0xda: {fn: this.jp_c_nn, paramBytes: 2},
      0xdf: {fn: this.rst_18, paramBytes: 0},
      0xe0: {fn: this.ldh_n_a, paramBytes: 1},
      0xe1: {fn: this.pop_hl, paramBytes: 0},
      0xe2: {fn: this.ld_0xc_a, paramBytes: 0},
      0xe5: {fn: this.push_hl, paramBytes: 0},
      0xe6: {fn: this.and_n, paramBytes: 1},
      0xe7: {fn: this.rst_20, paramBytes: 0},
      0xe9: {fn: this.jp_hl, paramBytes: 0},
      0xea: {fn: this.ld_0xnn_a, paramBytes: 2},
      0xee: {fn: this.xor_n, paramBytes: 1},
      0xef: {fn: this.rst_28, paramBytes: 0},
      0xf0: {fn: this.ldh_a_n, paramBytes: 1},
      0xf1: {fn: this.pop_af, paramBytes: 0},
      0xf3: {fn: this.di, paramBytes: 0},
      0xf5: {fn: this.push_af, paramBytes: 0},
      0xf6: {fn: this.or_n, paramBytes: 1},
      0xf7: {fn: this.rst_30, paramBytes: 0},
      0xfa: {fn: this.ld_a_nn, paramBytes: 2},
      0xfb: {fn: this.ei, paramBytes: 0},
      0xfe: {fn: this.cp_n, paramBytes: 1},
      0xff: {fn: this.rst_38, paramBytes: 0},
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
   * @param offset
   * @returns {number} byte at memory location sp + offset
   * @private
   */
  peek_stack(offset = 0){
    return this.mmu.readByteAt(this.sp() + offset);
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

  _set_hl(nn){
    this._r.h = nn >> 8 & 0x00ff;
    this._r.l = nn & 0x00ff;
  }

  /**
   * @returns {number} byte at memory location hl
   * @private
   */
  _0xhl(){
    return this.mmu.readByteAt(this.hl());
  }

  /**
   * @returns {number} flags (4 bits)
   */
  f(){
    return (this._r._f & 0xf0) >> 4;
  }

  ime(){
    return this._r.ime;
  }

  ie(){
    return this.mmu.ie();
  }

  If(){
    return this.mmu.If();
  }

  setIf(value){
    return this.mmu.setIf(value);
  }

  lcdc(){
    return this.mmu.lcdc();
  }

  /**
   * LCD Status Flag
   * @returns {number}
   */
  stat(){
    return this.mmu.stat();
  }

  scy(){
    return this.mmu.readByteAt(0xff42);
  }

  scx(){
    return this.mmu.readByteAt(0xff43);
  }

  /**
   * LCDC Y Coordinate (read-only)
   * @returns {*}
   */
  ly(){
    return this.mmu.ly();
  }

  lyc(){
    return this.mmu.readByteAt(0xff45);
  }

  bgp(){
    return this.mmu.readByteAt(0xff47);
  }

  obp0(){
    return this.mmu.readByteAt(0xff48);
  }

  obp1(){
    return this.mmu.readByteAt(0xff49);
  }

  wy(){
    return this.mmu.readByteAt(0xff4a);
  }

  wx(){
    return this.mmu.readByteAt(0xff4b);
  }

  nr11(){
    return this.mmu.readByteAt(0xff11);
  }

  nr12(){
    return this.mmu.readByteAt(0xff12);
  }

  nr50(){
    return this.mmu.readByteAt(0xff24);
  }

  nr51(){
    return this.mmu.readByteAt(0xff25);
  }

  nr52(){
    return this.mmu.readByteAt(0xff26);
  }

  /**
   * Main loop
   * @param {number} pc_stop
   */
  start(pc_stop = -1){
    try {
      this.frame(pc_stop);
    } catch(e){
      if (!config.TEST) {
        this.mmu.dumpMemoryToFile();
      }
      Logger.error(e.stack);
      throw e;
    }
  }

  /**
   * Runs cpu during a frame
   */
  frame(pc_stop){

    do {
      if (pc_stop !== -1 && this._r.pc >= pc_stop){
        this.end();
        return;
      }

      this.execute();
      this._t++;

      if (this._t > 0x80){
        this.incrementLy();
        this._t = 0;
      }

      if (this._r.pc === this.mmu.ADDR_GAME_START){
        this._afterBIOS();
      }

    } while (!this._isVBlankTriggered());

    this._handleVBlankInterrupt();
  }

  /**
   * Sets adjustments before game starts.
   * @private
   */
  _afterBIOS(){
    this.mmu.inBIOS = false;
    this.mmu.setIe(0x00);
    this.mmu.setLy(0x00);
    this._r.c = 0x13; // there's a bug somewhere that leaves c=0x14
  }

  /**
   * @returns {boolean}
   * @private
   */
  _isVBlankTriggered(){
    if (this._r.ime === 0){
      return false;
    }
    return this.isVBlank();
  }

  /**
   * Handles vertical blank interruption
   * @private
   */
  _handleVBlankInterrupt(){
    // BIOS does not have an vblank routine to execute
    if (!this.mmu.inBIOS) {
      this.di();
      this._rst_40();
    }
    this.paintFrame();
  }



  /**
   * Request a frame paint
   */
  paintFrame(){
    if (!this.isPainting) {
      this.isPainting = true;
      this.ipc.send('paint-frame');
    }
  }

  /**
   * @returns {boolean} true if vblank
   */
  isVBlank(){
    return this._r.ime === 1 && (this.mmu.ie() & this.mmu.If() & this.IF_VBLANK_ON) === 1;
  }

  /**
   * Increments LY by 1.
   */
  incrementLy(){
    let ly = this.mmu.ly();
    if (ly >= 153){
      ly = 0;
    } else {
      ly++;
    }
    this.mmu.setLy(ly);

    if (ly === 144){
      this._triggerVBlank();
    }
  }

  /**
   * Sets IF to trigger a vblank interruption
   * @private
   */
  _triggerVBlank(){
    this.mmu.setIf(this.If() | this.IF_VBLANK_ON);
  }

  _haltVBlank(){
    this.mmu.setIf(this.If() & this.IF_VBLANK_OFF);
  }

  /**
   * Start emulation until a given program counter. For tests.
   * @param {number} pc_stop
   */
  runUntil(pc_stop){
    this.start(pc_stop);
  }

  /**
   * Sends a end message to LCD
   */
  end(){
    this.ipc.send('end');
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

    try {
      command.fn.call(this, param);
    } catch (e){
      Logger.beforeCrash(this, command.fn, command.paramBytes, param);
      throw e;
    }
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
   * @param {number} nn 16 bits
   */
  jp(nn){
    this._r.pc = nn;
  }

  /**
   * Adds signed byte to current address and jumps to it.
   * @param {number} n, signed integer
   */
  jp_n(n){
    const nextAddress = this._r.pc + Utils.uint8ToInt8(n);
    if (nextAddress < 0 || nextAddress > this.mmu.ADDR_MAX){
      throw new Error(`Program counter outside memory space at ${Utils.hex4(this._r.pc)}`);
    }
    this._r.pc = nextAddress;
  }

  /**
   * Jumps to address contained in hl.
   */
  jp_hl(){
    this._r.pc = this.hl();
  }

  /**
   * Does nothing
   */
  nop(){}

  /**
   * Register a AND a
   */
  and_a(){
    this.and_n(this._r.a);
  }

  /**
   * Register a AND b
   */
  and_b(){
    this.and_n(this._r.b);
  }

  /**
   * Register a AND c
   */
  and_c(){
    this.and_n(this._r.c);
  }

  /**
   * Register a AND d
   */
  and_d(){
    this.and_n(this._r.d);
  }

  /**
   * Register a AND e
   */
  and_e(){
    this.and_n(this._r.e);
  }

  /**
   * Register a AND h
   */
  and_h(){
    this.and_n(this._r.h);
  }

  /**
   * Register a AND l
   */
  and_l(){
    this.and_n(this._r.l);
  }

  /**
   * Register a AND value at memory location hl
   */
  and_0xhl(){
    this.and_n(this._0xhl());
  }

  /**
   * Register a AND n
   * @param n
   */
  and_n(n){
    if (this._r.a &= n){
      this.setZ(0);
    } else {
      this.setZ(1);
    }
    this.setN(0); this.setH(1); this.setC(0);
  }

  /** 
   * Register a OR a. Does nothing.
   */
  or_a(){
    this.or_n(this._r.b);
  }

  /**
   * Register a OR b
   */
  or_b(){
    this.or_n(this._r.b);
  }

  /**
   * Register a OR c
   */
  or_c(){
    this.or_n(this._r.c);
  }

  /**
   * Register a OR d
   */
  or_d(){
    this.or_n(this._r.d);
  }

  /**
   * Register a OR e
   */
  or_e(){
    this.or_n(this._r.e);
  }

  /**
   * Register a OR h
   */
  or_h(){
    this.or_n(this._r.h);
  }

  /**
   * Register a OR l
   */
  or_l(){
    this.or_n(this._r.l);
  }

  /**
   * Register a OR memory location hl
   */
  or_0xhl(){
    this.or_n(this._0xhl());
  }
  
  /**
   * Register a OR n
   * @param {number} n
   * @private
   */
  or_n(n){
    if (this._r.a |= n){
      this.setZ(0);
    } else {
      this.setZ(1);
    }
    this.setN(0); this.setH(0); this.setC(0);
  }

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

  /**
   * XOR register c, result in a.
   */
  xor_c(){
    this._xor(this._r.c);
  }

  /**
   * XOR register d, result in a.
   */
  xor_d(){
    this._xor(this._r.d);
  }

  /**
   * XOR register e, result in a.
   */
  xor_e(){
    this._xor(this._r.e);
  }

  /**
   * XOR register h, result in a.
   */
  xor_h(){
    this._xor(this._r.h);
  }

  /**
   * XOR register l, result in a.
   */
  xor_l(){
    this._xor(this._r.l);
  }

  /**
   * XOR memory location hl, result in a.
   */
  xor_0xhl(){
    this._xor(this._0xhl());
  }

  /**
   * XOR byte n, result in a.
   */
  xor_n(n){
    this._xor(n);
  }

  /**
   * XOR byte n with register a.
   * @param {number} n, a byte
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
   * @param {number} value of flag N
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
   * @param {number} value of flag H
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
   * @param {number} value of flag C
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
   * @param {number} nn 16 bits
   */
  ld_bc_nn(nn) {
    this._ld_rr_nn('b', 'c', nn);
  }

  /**
   * Loads 16 bits nn into de.
   * @param {number} nn, 16 bits
   */
  ld_de_nn(nn) {
    this._ld_rr_nn('d', 'e', nn);
  }

  /**
   * Loads 16 bits nn into hl.
   * @param {number} nn, 16 bits
   */
  ld_hl_nn(nn) {
    this._ld_rr_nn('h', 'l', nn);
  }

  /**
   * Loads 16 bits nn into sp.
   * @param {number} nn, 16 bits
   */
  ld_sp_nn(nn) {
    this._r.sp = nn;
  }

  /**
   * Loads MSB in r1, LSB in r2
   * @param {string} r1
   * @param {string} r2
   * @param {number} nn, 16 bits
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
  ld_a_0xbc(){
    this.ld_a_n(this.mmu.readByteAt(this.bc()));
  }

  /**
   * Loads address memory of de into a.
   */
  ld_a_0xde(){
    this.ld_a_n(this.mmu.readByteAt(this.de()));
  }

  /**
   * Loads address memory of hl into a.
   */
  ld_a_0xhl(){
    this.ld_a_n(this._0xhl());
  }

  /**
   * Loads value at memory location hl into b.
   */
  ld_b_0xhl(){
    this._ld_r_0xhl('b');
  }

  /**
   * Loads value at memory location hl into c.
   */
  ld_c_0xhl(){
    this._ld_r_0xhl('c');
  }

  /**
   * Loads value at memory location hl into d.
   */
  ld_d_0xhl(){
    this._ld_r_0xhl('d');
  }

  /**
   * Loads value at memory location hl into e.
   */
  ld_e_0xhl(){
    this._ld_r_0xhl('e');
  }

  /**
   * Loads value at memory location hl into h.
   */
  ld_h_0xhl(){
    this._ld_r_0xhl('h');
  }

  /**
   * Loads value at memory location hl into l.
   */
  ld_l_0xhl(){
    this._ld_r_0xhl('l');
  }

  /**
   * Loads value at memory location hl into register r.
   * @param r
   * @private
   */
  _ld_r_0xhl(r){
    this._ld_r_n(r, this._0xhl());
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
    this._r.a = this._0xhl();
    this.dec_hl();
  }

  /**
   * Puts a into memory address hl. Decrements hl.
   */
  ldd_hl_a(){
    this.ld_0xhl_a();
    this.dec_hl();
  }

  /** 
   * Puts a into memory address hl. Increments hl.
   */
  ldi_0xhl_a(){
    this.ld_0xhl_a();
    this.inc_hl();
  }

  /**
   * Puts value at memory location hl into a. Increments hl.
   */
  ldi_a_0xhl(){
    this._ld_a_0xhl();
    this.inc_hl();
  }

  /**
   * Loads value at memory location hl into a.
   * @private
   */
  _ld_a_0xhl(){
    this._r.a = this._0xhl();
  }

  /**
   * Decrements a by 1.
   */
  dec_a(){
    this._dec_r('a');
  }

  /**
   * Decrements b by 1.
   */
  dec_b(){
    this._dec_r('b');
  }

  /**
   * Decrements c by 1.
   */
  dec_c(){
    this._dec_r('c');
  }

  /**
   * Decrements d by 1.
   */
  dec_d(){
    this._dec_r('d');
  }

  /**
   * Decrements e by 1.
   */
  dec_e(){
    this._dec_r('e');
  }

  /**
   * Decrements h by 1.
   */
  dec_h(){
    this._dec_r('h');
  }

  /**
   * Decrements l by 1.
   */
  dec_l(){
    this._dec_r('l');
  }

  /**
   * Decrements register r by 1.
   * @param {string} r, register
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

  /**
   * Decrements memory location hl by 1
   */
  dec_0xhl(){
    let value = this._0xhl();
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
   * Jumps to address nn if last operation was not zero.
   * @param nn
   */
  jp_nz_nn(nn){
    if (this.Z() === 0){
      this._r.pc = nn;
    }
  }

  /**
   * Jumps to address nn if last operation was zero.
   * @param nn
   */
  jp_z_nn(nn){
    if (this.Z() === 1){
      this._r.pc = nn;
    }
  }

  /**
   * Jumps to address nn if last operation did not carry a bit.
   * @param nn
   */
  jp_nc_nn(nn){
    if (this.C() === 0){
      this._r.pc = nn;
    }
  }

  /**
   * Jumps to address nn if last operation carried a bit.
   * @param nn
   */
  jp_c_nn(nn){
    if (this.C() === 1){
      this._r.pc = nn;
    }
  }

  /**
   * Jumps to current address + n if last operation was not zero.
   * @param {number} n, signed integer
   */
  jr_nz_n(n){
    if (this.Z() === 0){
      this._r.pc += Utils.uint8ToInt8(n);
    }
  }

  /**
   * Jumps to current address + n if last operation was zero.
   * @param {number} n, signed integer
   */
  jr_z_n(n){
    if (this.Z() === 1){
      this._r.pc += Utils.uint8ToInt8(n);
    }
  }

  /**
   * Jumps to current address + n if last operation did not carry 1 bit.
   * @param {number} n, signed integer
   */
  jr_nc_n(n){
    if (this.C() === 0){
      this._r.pc += Utils.uint8ToInt8(n);
    }
  }

  /**
   * Jumps to current address + n if last operation carried 1 bit
   * @param {number} n signed integer
   */
  jr_c_n(n){
    if (this.C() === 1){
      this._r.pc += Utils.uint8ToInt8(n);
    }
  }

  /** 
   * Disables interruptions after executing the next instruction.
   */
  di(){
    this._r.ime = 0;
  }

  /** 
   * Enables interruptions after executing the next instruction.
   */
  ei(){
    this._r.ime = 1;
  }

  /**
   * Loads a into memory address 0xff00 + n
   * @param {number} n
   */
  ldh_n_a(n){
    this.mmu.writeByteAt(0xff00 + n, this._r.a);
  }

  /**
   * Loads memory address 0xff00 + n into register a.
   * @param {number} n
   */
  ldh_a_n(n){
    this._r.a = this.mmu.readByteAt(0xff00 + n);
  }

  /**
   * Compares register a with register a
   */
  cp_a(){
    this.cp_n(this._r.a);
  }

  /**
   * Compares register b with register a
   */
  cp_b(){
    this.cp_n(this._r.b);
  }

  /**
   * Compares register c with register a
   */
  cp_c(){
    this.cp_n(this._r.c);
  }

  /**
   * Compares register d with register a
   */
  cp_d(){
    this.cp_n(this._r.d);
  }

  /**
   * Compares register e with register a
   */
  cp_e(){
    this.cp_n(this._r.e);
  }

  /**
   * Compares register h with register a
   */
  cp_h(){
    this.cp_n(this._r.h);
  }

  /**
   * Compares register l with register a
   */
  cp_l(){
    this.cp_n(this._r.l);
  }

  /**
   * Compares memory location hl with register a
   */
  cp_0xhl(){
    this.cp_n(this._0xhl());
  }

  /**
   * Compares n with register a.
   * @param {number} n
   */
  cp_n(n){
    
    this.setN(1); this.setZ(0); this.setC(0);
    const diff = this._r.a - n;
    
    if (diff === 0){
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
   * Attaches reset bit functions to the cpu programmatically.
   * @private
   */
  _attach_reset_bit_functions() {
    ['a', 'b', 'c', 'd', 'e', 'h', 'l', '0xhl'].map((r) => {
      for (let b = 0; b < 8; b++) {
        if (r === '0xhl'){
          this[`res_${b}_0xhl`] = function() {
            this.res_b_0xhl(b);
          };
        } else {
          this[`res_${b}_${r}`] = function() {
            this._res_b_r(b, r);
          };
        }
      }
    });
  }

  /**
   * Resets bit b of register r.
   * @param b
   * @param r
   * @private
   */
  _res_b_r(bit, r){
    this._r[r] &= (0xff & (0 << bit));
  }

  /**
   * Resets bit b of value at memory location hl.
   * @param bit
   */
  res_b_0xhl(bit){
    const value = this._0xhl() & (0xff & (0 << bit));
    this.mmu.writeByteAt(this.hl(), value);
  }

  /**
   * Loads register a into memory address 0xff00 + c
   */
  ld_0xc_a(){
    this.mmu.writeByteAt(0xff00 + this._r.c, this._r.a);
  }

  /**
   * Increases register a by 1
   */
  inc_a(){
    this._inc_r('a');
  }
  /**
   * Increases register b by 1
   */
  inc_b(){
    this._inc_r('b');
  }

  /**
   * Increases register c by 1
   */
  inc_c(){
    this._inc_r('c');
  }

  /**
   * Increases register d by 1
   */
  inc_d(){
    this._inc_r('d');
  }

  /**
   * Increases register e by 1
   */
  inc_e(){
    this._inc_r('e');
  }

  /**
   * Increases register h by 1
   */
  inc_h(){
    this._inc_r('h');
  }

  /**
   * Increases register l by 1
   */
  inc_l(){
    this._inc_r('l');
  }

  /**
   * Increases register bc by 1
   */
  inc_bc(){
    this._inc_rr('b', 'c');
  }

  /**
   * Increases register de by 1
   */
  inc_de(){
    this._inc_rr('d', 'e');
  }

  /**
   * Increases register hl by 1
   */
  inc_hl(){
    this._inc_rr('h', 'l');
  }

  /**
   * Increases stack pointer by 1
   */
  inc_sp(){
    if (this._r.sp >= this.mmu.ADDR_MAX - 1){
      throw new Error(`Cannot increase stack pointer more than ${this._r.sp}`);
    }
    this._r.sp++;
  }

  /**
   * Increases register rr by 1
   * @private
   */
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
  inc_0xhl(){
    let value = this._0xhl();

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

  /**
   * Loads register a into b
   */
  ld_b_a(){
    this._ld_r_a('b');
  }

  /**
   * Loads register a into c
   */
  ld_c_a(){
    this._ld_r_a('c');
  }

  /**
   * Loads register a into d
   */
  ld_d_a(){
    this._ld_r_a('d');
  }

  /**
   * Loads register a into e
   */
  ld_e_a(){
    this._ld_r_a('e');
  }

  /**
   * Loads register a into h
   */
  ld_h_a(){
    this._ld_r_a('h');
  }

  /**
   * Loads register a into l
   */
  ld_l_a(){
    this._ld_r_a('l');
  }

  /**
   * Loads register r into a
   * @param {string} r
   * @private
   */
  _ld_r_a(r){
    this._r[r] = this._r.a;
  }

  /**
   * Loads register r2 into r1
   * @param r1
   * @param r2
   * @private
   */
  _ld_r_r(r1, r2){
    this._r[r1] = this._r[r2];
  }

  /**
   * Loads b into b
   */
  ld_b_b(){
    // Nothing
  }

  /**
   * Loads c into b
   */
  ld_b_c(){
    this._ld_r_r('b', 'c');
  }

  /**
   * Loads d into b
   */
  ld_b_d(){
    this._ld_r_r('b', 'd');
  }

  /**
   * Loads e into b
   */
  ld_b_e(){
    this._ld_r_r('b', 'e');
  }

  /**
   * Loads h into b
   */
  ld_b_h(){
    this._ld_r_r('b', 'h');
  }

  /**
   * Loads l into b
   */
  ld_b_l(){
    this._ld_r_r('b', 'l');
  }

  /**
   * Loads b into c
   */
  ld_c_b(){
    this._ld_r_r('c', 'b');
  }

  /**
   * Loads c into c
   */
  ld_c_c(){
    // Nothing
  }

  /**
   * Loads d into c
   */
  ld_c_d(){
    this._ld_r_r('c', 'd');
  }

  /**
   * Loads e into c
   */
  ld_c_e(){
    this._ld_r_r('c', 'e');
  }

  /**
   * Loads h into c
   */
  ld_c_h(){
    this._ld_r_r('c', 'h');
  }

  /**
   * Loads l into c
   */
  ld_c_l(){
    this._ld_r_r('c', 'l');
  }

  /**
   * Loads b into d
   */
  ld_d_b(){
    this._ld_r_r('d', 'b');
  }

  /**
   * Loads c into d
   */
  ld_d_c(){
    this._ld_r_r('d', 'c');
  }

  /**
   * Loads d into d
   */
  ld_d_d(){
    // Nothing
  }

  /**
   * Loads e into d
   */
  ld_d_e(){
    this._ld_r_r('d', 'e');
  }

  /**
   * Loads h into d
   */
  ld_d_h(){
    this._ld_r_r('d', 'h');
  }

  /**
   * Loads l into d
   */
  ld_d_l(){
    this._ld_r_r('d', 'l');
  }

  /**
   * Loads b into e
   */
  ld_e_b(){
    this._ld_r_r('e', 'b');
  }

  /**
   * Loads c into e
   */
  ld_e_c(){
    this._ld_r_r('e', 'c');
  }

  /**
   * Loads d into e
   */
  ld_e_d(){
    this._ld_r_r('e', 'd');
  }

  /**
   * Loads e into e
   */
  ld_e_e(){
    // Nothing
  }

  /**
   * Loads h into e
   */
  ld_e_h(){
    this._ld_r_r('e', 'h');
  }

  /**
   * Loads l into e
   */
  ld_e_l(){
    this._ld_r_r('e', 'l');
  }

  /**
   * Loads b into h
   */
  ld_h_b(){
    this._ld_r_r('h', 'b');
  }

  /**
   * Loads c into h
   */
  ld_h_c(){
    this._ld_r_r('h', 'c');
  }

  /**
   * Loads d into h
   */
  ld_h_d(){
    this._ld_r_r('h', 'd');
  }

  /**
   * Loads e into h
   */
  ld_h_e(){
    this._ld_r_r('h', 'e');
  }

  /**
   * Loads h into h
   */
  ld_h_h(){
    this._ld_r_r('h', 'h');
  }

  /**
   * Loads l into h
   */
  ld_h_l(){
    this._ld_r_r('h', 'l');
  }

  /**
   * Loads b into l
   */
  ld_l_b(){
    this._ld_r_r('l', 'b');
  }

  /**
   * Loads c into l
   */
  ld_l_c(){
    this._ld_r_r('l', 'c');
  }

  /**
   * Loads d into l
   */
  ld_l_d(){
    this._ld_r_r('l', 'd');
  }

  /**
   * Loads e into l
   */
  ld_l_e(){
    this._ld_r_r('l', 'e');
  }

  /**
   * Loads h into l
   */
  ld_l_h(){
    this._ld_r_r('l', 'h');
  }

  /**
   * Loads l into l
   */
  ld_l_l(){
    // Nothing
  }

  /**
   * Loads register a into memory location bc
   */
  ld_0xbc_a(){
    this._ld_0xnn_a(this.bc());
  }

  /**
   * Loads register a into memory location de
   */
  ld_0xde_a(){
    this._ld_0xnn_a(this.de());
  }

  /**
   * Loads register a into memory location hl
   */
  ld_0xhl_a(){
    this._ld_0xnn_a(this.hl());
  }

  /**
   * Loads register a into memory address nn
   * @param addr
   */
  ld_0xnn_a(addr){
    this._ld_0xnn_a(addr);
  }

  /**
   * Loads register a into memory address nn
   * @param addr
   * @private
   */
  _ld_0xnn_a(addr){
    this.mmu.writeByteAt(addr, this._r.a);
  }

  /**
   * Calls a routine at a given address, saving the pc in the
   * stack.
   * @param addr
   */
  call(addr){
    this._push_pc();
    this._r.pc = addr;
  }

  /**
   * Pushes the pc into stack.
   * @private
   */
  _push_pc(){
    this.mmu.writeByteAt(--this._r.sp, Utils.msb(this._r.pc));
    this.mmu.writeByteAt(--this._r.sp, Utils.lsb(this._r.pc));
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

  /**
   * Pops two bytes off the stack
   * @returns {number}
   * @private
   */
  _pop_nn(){
    return this.mmu.readByteAt(this._r.sp++) + (this.mmu.readByteAt(this._r.sp++) << 8);
  }

  /**
   * Rotates left register a
   */
  rl_a(){
    this._rl_r('a');
  }

  /**
   * Rotates left register a
   */
  rla(){
    this.rl_a();
  }

  /**
   * Rotates left register b
   */
  rl_b(){
    this._rl_r('b');
  }

  /**
   * Rotates left register c
   */
  rl_c(){
    this._rl_r('c');
  }

  /**
   * Rotates left register d
   */
  rl_d(){
    this._rl_r('d');
  }

  /**
   * Rotates left register e
   */
  rl_e(){
    this._rl_r('e');
  }

  /**
   * Rotates left register h
   */
  rl_h(){
    this._rl_r('h');
  }

  /**
   * Rotates left register l
   */
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
  rl_0xhl(){

    const value = this._0xhl();

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

  /** 
   * Pops two bytes from stack and jumps to that address
   */
  ret(){
    this.jp(this._pop_nn());
  }

  /**
   * Jumps if last operation was not zero
   */
  ret_nz(){
    if (this.Z() === 0){
      this.jp(this._pop_nn());
    }
  }

  /**
   * Jumps if last operation was zero
   */
  ret_z(){
    if (this.Z() === 1){
      this.jp(this._pop_nn());
    }
  }

  /**
   * Jumps if last operation did not carry
   */
  ret_nc(){
    if (this.C() === 0){
      this.jp(this._pop_nn());
    }
  }

  /**
   * Jumps if last operation carried
   */
  ret_c(){
    if (this.C() === 1){
      this.jp(this._pop_nn());
    }
  }

  /**
   * Returns from interruption routine
   */
  reti(){
    this.jp(this._pop_nn());
    this._r.ime = 1;
  }

  /**
   * Subtract a from a
   */
  sub_a(){
    this._sub_r(this._r.a);
  }

  /**
   * Subtract b from a
   */
  sub_b(){
    this._sub_r(this._r.b);
  }

  /**
   * Subtract c from a
   */
  sub_c(){
    this._sub_r(this._r.c);
  }

  /**
   * Subtract d from a
   */
  sub_d(){
    this._sub_r(this._r.d);
  }

  /**
   * Subtract e from a
   */
  sub_e(){
    this._sub_r(this._r.e);
  }

  /**
   * Subtract h from a
   */
  sub_h(){
    this._sub_r(this._r.h);
  }

  /**
   * Subtract l from a
   */
  sub_l(){
    this._sub_r(this._r.l);
  }

  /**
   * Subtract value at memory address hl from a
   */
  sub_0xhl(){
    this._sub_r(this._0xhl());
  }

  /**
   * Subtract n from a
   * @param n
   */
  sub_n(n){
    this._sub_r(n);
  }

  /**
   * Writes a value n into memory address hl
   * @param {number} n
   */
  ld_0xhl_n(n){
    this.mmu.writeByteAt(this.hl(), n);
  }

  /**
   * Subtract register value from register a
   * @param value
   * @private
   */
  _sub_r(value){

    this.setN(1);

    const diff = this._r.a - value;
    const nybble_a = this._r.a & 0xf0;

    if (diff >= 0){
      this._r.a -= value;
      
      if (this._r.a === 0){
        this.setZ(1);
      } else {
        this.setZ(0);
      }

      if ((this._r.a & 0xf0) < nybble_a){
        this.setH(1);
      } else {
        this.setH(0);
      }

      this.setC(0);
    
    } else {
      this._r.a = diff + 0x100;
      this.setZ(0);
      this.setH(0);
      this.setC(1);
    }
  }

  /**
   * Adds a to a
   */
  add_a(){
    this._add_r(this._r.a);
  }

  /**
   * Adds b to a
   */
  add_b(){
    this._add_r(this._r.b);
  }

  /**
   * Adds c to a
   */
  add_c(){
    this._add_r(this._r.c);
  }

  /**
   * Adds d to a
   */
  add_d(){
    this._add_r(this._r.d);
  }

  /**
   * Adds e to a
   */
  add_e(){
    this._add_r(this._r.e);
  }

  /**
   * Adds h to a
   */
  add_h(){
    this._add_r(this._r.h);
  }

  /**
   * Adds l to a
   */
  add_l(){
    this._add_r(this._r.l);
  }

  /**
   * Adds value at memory hl to a
   */
  add_0xhl(){
    this._add_r(this._0xhl());
  }

  /**
   * Adds byte to a
   * @param {number} n, 8 bits
   */
  add_n(n){
    this._add_r(n);
  }

  /**
   * Adds a value to register a
   * @param {number} value, 8 bits
   * @private
   */
  _add_r(value){

    this.setN(0);

    // Half carry
    if (value > (0x0f - (this._r.a & 0x0f))){
      this.setH(1);
    } else {
      this.setH(0);
    }

    this._r.a = this._r.a + value;

    // Carry
    if ((this._r.a & 0x100) > 0){
      this._r.a -= 0x100;
      this.setC(1);
    } else {
      this.setC(0);
    }

    if (this._r.a === 0){
      this.setZ(1);
    } else {
      this.setZ(0);
    }
  }

  /**
   * Adds register bc to hl
   */
  add_hl_bc(){
    this._add_hl_nn(this.bc());
  }

  /**
   * Adds register de to hl
   */
  add_hl_de(){
    this._add_hl_nn(this.de());
  }

  /**
   * Adds register hl to hl
   */
  add_hl_hl(){
    this._add_hl_nn(this.hl());
  }

  /**
   * Adds stack pointer to hl
   */
  add_hl_sp(){
    this._add_hl_nn(this.sp());
  }

  /**
   * Adds 16 bits to hl
   * @param nn
   * @private
   */
  _add_hl_nn(nn){

    const hl = this.hl();
    let value = hl + nn;

    if ((value & 0xf000) > (hl & 0xf000)){
      this.setH(1);
    } else {
      this.setH(0);
    }

    if ((value & 0x10000) > 0){
      value -= 0x10000;
      this.setC(1);
    } else {
      this.setC(0);
    }

    this._set_hl(value);

    this.setN(0);
  }

  /**
   * Loads register b into memory location hl
   */
  ld_0xhl_b(){
    this.ld_0xhl_n(this._r.b);
  }

  /**
   * Loads register c into memory location hl
   */
  ld_0xhl_c(){
    this.ld_0xhl_n(this._r.c);
  }

  /**
   * Loads register d into memory location hl
   */
  ld_0xhl_d(){
    this.ld_0xhl_n(this._r.d);
  }

  /**
   * Loads register e into memory location hl
   */
  ld_0xhl_e(){
    this.ld_0xhl_n(this._r.e);
  }

  /**
   * Loads register h into memory location hl
   */
  ld_0xhl_h(){
    this.ld_0xhl_n(this._r.h);
  }

  /**
   * Loads register l into memory location hl
   */
  ld_0xhl_l(){
    this.ld_0xhl_n(this._r.l);
  }

  /** 
   * Complements register a
   */
  cpl() {
    this._r.a = ~this._r.a;
    this.setN(1); this.setH(1);
  }

  /**
   * Swaps nybbles of a
   */
  swap_a(){
    this._swap_n('a');
  }

  /**
   * Swaps nybbles of b
   */
  swap_b(){
    this._swap_n('b');
  }

  /**
   * Swaps nybbles of c
   */
  swap_c(){
    this._swap_n('c');
  }

  /**
   * Swaps nybbles of d
   */
  swap_d(){
    this._swap_n('d');
  }

  /**
   * Swaps nybbles of e
   */
  swap_e(){
    this._swap_n('e');
  }

  /**
   * Swaps nybbles of h
   */
  swap_h(){
    this._swap_n('h');
  }

  /**
   * Swaps nybbles of l
   */
  swap_l(){
    this._swap_n('l');
  }

  /**
   * Swaps nybbles of value at memory location hl
   */
  swap_0xhl(){
    const swapped = this._swap4bits(this._0xhl());

    if (swapped){
      this.setZ(0);
    } else {
      this.setZ(1);
    }
    this.ld_0xhl_n(swapped);
    this.setN(0); this.setH(0); this.setC(0);
  }

  /**
   * Swaps nybbles of register r
   * @param {string} r
   * @private
   */
  _swap_n(r){
    if (this._r[r] = this._swap4bits(this._r[r])){
      this.setZ(0);
    } else {
      this.setZ(1);
    }
    this.setN(0); this.setH(0); this.setC(0);
  }

  /**
   * Swaps top-bottom 4 bits in a byte.
   * @param byte
   * @returns {number}
   * @private
   */
  _swap4bits(byte){
    return (byte >> 4 & 0x0f) + (byte << 4 & 0xf0);
  }

  /**
   * Restarts to address 0x0000
   */
  rst_00(){
    this._rst_n(0x00);
  }

  /**
   * Restarts to address 0x0008
   */
  rst_08(){
    this._rst_n(0x08);
  }

  /**
   * Restarts to address 0x0010
   */
  rst_10(){
    this._rst_n(0x10);
  }

  /**
   * Restarts to address 0x0018
   */
  rst_18(){
    this._rst_n(0x18);
  }

  /**
   * Restarts to address 0x0020
   */
  rst_20(){
    this._rst_n(0x20);
  }

  /**
   * Restarts to address 0x0028
   */
  rst_28(){
    this._rst_n(0x28);
  }

  /**
   * Restarts to address 0x0030
   */
  rst_30(){
    this._rst_n(0x30);
  }

  /**
   * Restarts to address 0x0038
   */
  rst_38(){
    this._rst_n(0x38);
  }

  /**
   * Restarts to vblank interrupt routine
   * @private
   */
  _rst_40(){
    this._rst_n(this.ADDR_VBLANK_INTERRUPT);
  }

  /**
   * Pushes the pc into stack and jumps to address n
   * @param n
   * @private
   */
  _rst_n(n){
    this._push_pc();
    this.jp(n);
  }
}