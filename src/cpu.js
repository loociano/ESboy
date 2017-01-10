import Utils from './utils';
import Logger from './logger';
import config from './config';

export default class CPU {

  /**
   * @param {Object} mmu
   * @param {Object} ctx
   */
  constructor(mmu, lcd) {

    if (mmu == null) {
      throw new Error('Missing mmu');
    }

    if (lcd == null){
      throw new Error('Missing lcd');
    }

    this.mmu = mmu;

    this._checkSupportedROM();

    this.lcd = lcd;
    this._lastInstrWasEI = false;

    this._m = 0; // machine cycles for lcd
    this._m_dma = 0; // machine cycles for DMA

    // Constants
    this.EXTENDED_PREFIX = 0xcb;
    this.ADDR_VBLANK_INTERRUPT = 0x40;
    this.ADDR_STAT_INTERRUPT = 0x48;
    this.ADDR_TIMER_INTERRUPT = 0x50;
    this.ADDR_SERIAL_INTERRUPT = 0x58;
    this.ADDR_P10P13_INTERRUPT = 0x60;

    this.M_CYCLES_PER_LINE = 114;
    this.M_CYCLES_STOP_MODE_0 = 4;
    this.M_CYCLES_STOP_MODE_2 = 20;
    this.M_CYCLES_STOP_MODE_3 = 40; // Naive
    this.M_CYCLES_DMA = 40;

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

    // CPU modes
    this._halt = false;
    this._stop = false;

    this._attach_bit_functions();

    this._instructions = {
      0x00: {fn: this.nop, paramBytes: 0},
      0x01: {fn: this.ld_bc_nn, paramBytes: 2},
      0x02: {fn: this.ld_0xbc_a, paramBytes: 0},
      0x03: {fn: this.inc_bc, paramBytes: 0},
      0x04: {fn: this.inc_b, paramBytes: 0},
      0x05: {fn: this.dec_b, paramBytes: 0},
      0x06: {fn: this.ld_b_n, paramBytes: 1},
      0x07: {fn: this.rlca, paramBytes: 0},
      0x08: {fn: this.ld_nn_sp, paramBytes: 2},
      0x09: {fn: this.add_hl_bc, paramBytes: 0},
      0x0a: {fn: this.ld_a_0xbc, paramBytes: 0},
      0x0b: {fn: this.dec_bc, paramBytes: 0},
      0x0c: {fn: this.inc_c, paramBytes: 0},
      0x0d: {fn: this.dec_c, paramBytes: 0},
      0x0e: {fn: this.ld_c_n, paramBytes: 1},
      0x0f: {fn: this.rrca, paramBytes: 0},
      0x10: {fn: this.stop, paramBytes: 0},
      0x11: {fn: this.ld_de_nn, paramBytes: 2},
      0x12: {fn: this.ld_0xde_a, paramBytes: 0},
      0x13: {fn: this.inc_de, paramBytes: 0},
      0x14: {fn: this.inc_d, paramBytes: 0},
      0x15: {fn: this.dec_d, paramBytes: 0},
      0x16: {fn: this.ld_d_n, paramBytes: 1},
      0x17: {fn: this.rla, paramBytes: 0},
      0x18: {fn: this.jr_e, paramBytes: 1},
      0x19: {fn: this.add_hl_de, paramBytes: 0},
      0x1a: {fn: this.ld_a_0xde, paramBytes: 0},
      0x1b: {fn: this.dec_de, paramBytes: 0},
      0x1c: {fn: this.inc_e, paramBytes: 0},
      0x1d: {fn: this.dec_e, paramBytes: 0},
      0x1e: {fn: this.ld_e_n, paramBytes: 1},
      0x1f: {fn: this.rra, paramBytes: 0},
      0x20: {fn: this.jr_nz_n, paramBytes: 1},
      0x21: {fn: this.ld_hl_nn, paramBytes: 2},
      0x22: {fn: this.ldi_0xhl_a, paramBytes: 0},
      0x23: {fn: this.inc_hl, paramBytes: 0},
      0x24: {fn: this.inc_h, paramBytes: 0},
      0x25: {fn: this.dec_h, paramBytes: 0},
      0x26: {fn: this.ld_h_n, paramBytes: 1},
      0x27: {fn: this.daa, paramBytes: 0},
      0x28: {fn: this.jr_z_n, paramBytes: 1},
      0x29: {fn: this.add_hl_hl, paramBytes: 0},
      0x2a: {fn: this.ldi_a_0xhl, paramBytes: 0},
      0x2b: {fn: this.dec_hl, paramBytes: 0},
      0x2c: {fn: this.inc_l, paramBytes: 0},
      0x2d: {fn: this.dec_l, paramBytes: 0},
      0x2e: {fn: this.ld_l_n, paramBytes: 1},
      0x2f: {fn: this.cpl, paramBytes: 0},
      0x30: {fn: this.jr_nc_n, paramBytes: 1},
      0x31: {fn: this.ld_sp_nn, paramBytes: 2},
      0x32: {fn: this.ldd_0xhl_a, paramBytes: 0},
      0x33: {fn: this.inc_sp, paramBytes: 0},
      0x34: {fn: this.inc_0xhl, paramBytes: 0},
      0x35: {fn: this.dec_0xhl, paramBytes: 0},
      0x36: {fn: this.ld_0xhl_n, paramBytes: 1},
      0x37: {fn: this.scf, paramBytes: 0},
      0x38: {fn: this.jr_c_n, paramBytes: 1},
      0x39: {fn: this.add_hl_sp, paramBytes: 0},
      0x3a: {fn: this.ldd_a_0xhl, paramBytes: 0},
      0x3b: {fn: this.dec_sp, paramBytes: 0},
      0x3c: {fn: this.inc_a, paramBytes: 0},
      0x3d: {fn: this.dec_a, paramBytes: 0},
      0x3e: {fn: this.ld_a_n, paramBytes: 1},
      0x3f: {fn: this.ccf, paramBytes: 0},
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
      0x76: {fn: this.halt, paramBytes: 0},
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
      0x88: {fn: this.adc_b, paramBytes: 0},
      0x89: {fn: this.adc_c, paramBytes: 0},
      0x8a: {fn: this.adc_d, paramBytes: 0},
      0x8b: {fn: this.adc_e, paramBytes: 0},
      0x8c: {fn: this.adc_h, paramBytes: 0},
      0x8d: {fn: this.adc_l, paramBytes: 0},
      0x8e: {fn: this.adc_0xhl, paramBytes: 0},
      0x8f: {fn: this.adc_a, paramBytes: 0},
      0x90: {fn: this.sub_b, paramBytes: 0},
      0x91: {fn: this.sub_c, paramBytes: 0},
      0x92: {fn: this.sub_d, paramBytes: 0},
      0x93: {fn: this.sub_e, paramBytes: 0},
      0x94: {fn: this.sub_h, paramBytes: 0},
      0x95: {fn: this.sub_l, paramBytes: 0},
      0x96: {fn: this.sub_0xhl, paramBytes: 0},
      0x97: {fn: this.sub_a, paramBytes: 0},
      0x98: {fn: this.sbc_b, paramBytes: 0},
      0x99: {fn: this.sbc_c, paramBytes: 0},
      0x9a: {fn: this.sbc_d, paramBytes: 0},
      0x9b: {fn: this.sbc_e, paramBytes: 0},
      0x9c: {fn: this.sbc_h, paramBytes: 0},
      0x9d: {fn: this.sbc_l, paramBytes: 0},
      0x9e: {fn: this.sbc_0xhl, paramBytes: 0},
      0x9f: {fn: this.sbc_a, paramBytes: 0},
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
      0xc4: {fn: this.call_nz, paramBytes: 2},
      0xc5: {fn: this.push_bc, paramBytes: 0},
      0xc6: {fn: this.add_n, paramBytes: 1},
      0xc7: {fn: this.rst_00, paramBytes: 0},
      0xc8: {fn: this.ret_z, paramBytes: 0},
      0xc9: {fn: this.ret, paramBytes: 0},
      0xca: {fn: this.jp_z_nn, paramBytes: 2},
      0xcb00: {fn: this.rlc_b, paramBytes: 0},
      0xcb01: {fn: this.rlc_c, paramBytes: 0},
      0xcb02: {fn: this.rlc_d, paramBytes: 0},
      0xcb03: {fn: this.rlc_e, paramBytes: 0},
      0xcb04: {fn: this.rlc_h, paramBytes: 0},
      0xcb05: {fn: this.rlc_l, paramBytes: 0},
      0xcb06: {fn: this.rlc_0xhl, paramBytes: 0},
      0xcb07: {fn: this.rlc_a, paramBytes: 0},
      0xcb08: {fn: this.rrc_b, paramBytes: 0},
      0xcb09: {fn: this.rrc_c, paramBytes: 0},
      0xcb0a: {fn: this.rrc_d, paramBytes: 0},
      0xcb0b: {fn: this.rrc_e, paramBytes: 0},
      0xcb0c: {fn: this.rrc_h, paramBytes: 0},
      0xcb0d: {fn: this.rrc_l, paramBytes: 0},
      0xcb0e: {fn: this.rrc_0xhl, paramBytes: 0},
      0xcb0f: {fn: this.rrc_a, paramBytes: 0},
      0xcb10: {fn: this.rl_b, paramBytes: 0},
      0xcb11: {fn: this.rl_c, paramBytes: 0},
      0xcb12: {fn: this.rl_d, paramBytes: 0},
      0xcb13: {fn: this.rl_e, paramBytes: 0},
      0xcb14: {fn: this.rl_h, paramBytes: 0},
      0xcb15: {fn: this.rl_l, paramBytes: 0},
      0xcb16: {fn: this.rl_0xhl, paramBytes: 0},
      0xcb17: {fn: this.rl_a, paramBytes: 0},
      0xcb18: {fn: this.rr_b, paramBytes: 0},
      0xcb19: {fn: this.rr_c, paramBytes: 0},
      0xcb1a: {fn: this.rr_d, paramBytes: 0},
      0xcb1b: {fn: this.rr_e, paramBytes: 0},
      0xcb1c: {fn: this.rr_h, paramBytes: 0},
      0xcb1d: {fn: this.rr_l, paramBytes: 0},
      0xcb1e: {fn: this.rr_0xhl, paramBytes: 0},
      0xcb1f: {fn: this.rr_a, paramBytes: 0},
      0xcb20: {fn: this.sla_b, paramBytes: 0},
      0xcb21: {fn: this.sla_c, paramBytes: 0},
      0xcb22: {fn: this.sla_d, paramBytes: 0},
      0xcb23: {fn: this.sla_e, paramBytes: 0},
      0xcb24: {fn: this.sla_h, paramBytes: 0},
      0xcb25: {fn: this.sla_l, paramBytes: 0},
      0xcb26: {fn: this.sla_0xhl, paramBytes: 0},
      0xcb27: {fn: this.sla_a, paramBytes: 0},
      0xcb28: {fn: this.sra_b, paramBytes: 0},
      0xcb29: {fn: this.sra_c, paramBytes: 0},
      0xcb2a: {fn: this.sra_d, paramBytes: 0},
      0xcb2b: {fn: this.sra_e, paramBytes: 0},
      0xcb2c: {fn: this.sra_h, paramBytes: 0},
      0xcb2d: {fn: this.sra_l, paramBytes: 0},
      0xcb2e: {fn: this.sra_0xhl, paramBytes: 0},
      0xcb2f: {fn: this.sra_a, paramBytes: 0},
      0xcb30: {fn: this.swap_b, paramBytes: 0},
      0xcb31: {fn: this.swap_c, paramBytes: 0},
      0xcb32: {fn: this.swap_d, paramBytes: 0},
      0xcb33: {fn: this.swap_e, paramBytes: 0},
      0xcb34: {fn: this.swap_h, paramBytes: 0},
      0xcb35: {fn: this.swap_l, paramBytes: 0},
      0xcb36: {fn: this.swap_0xhl, paramBytes: 0},
      0xcb37: {fn: this.swap_a, paramBytes: 0},
      0xcb38: {fn: this.srl_b, paramBytes: 0},
      0xcb39: {fn: this.srl_c, paramBytes: 0},
      0xcb3a: {fn: this.srl_d, paramBytes: 0},
      0xcb3b: {fn: this.srl_e, paramBytes: 0},
      0xcb3c: {fn: this.srl_h, paramBytes: 0},
      0xcb3d: {fn: this.srl_l, paramBytes: 0},
      0xcb3e: {fn: this.srl_0xhl, paramBytes: 0},
      0xcb3f: {fn: this.srl_a, paramBytes: 0},
      0xcb40: {fn: this.bit_0_b, paramBytes: 0},
      0xcb41: {fn: this.bit_0_c, paramBytes: 0},
      0xcb42: {fn: this.bit_0_d, paramBytes: 0},
      0xcb43: {fn: this.bit_0_e, paramBytes: 0},
      0xcb44: {fn: this.bit_0_h, paramBytes: 0},
      0xcb45: {fn: this.bit_0_l, paramBytes: 0},
      0xcb46: {fn: this.bit_0_0xhl, paramBytes: 0},
      0xcb47: {fn: this.bit_0_a, paramBytes: 0},
      0xcb48: {fn: this.bit_1_b, paramBytes: 0},
      0xcb49: {fn: this.bit_1_c, paramBytes: 0},
      0xcb4a: {fn: this.bit_1_d, paramBytes: 0},
      0xcb4b: {fn: this.bit_1_e, paramBytes: 0},
      0xcb4c: {fn: this.bit_1_h, paramBytes: 0},
      0xcb4d: {fn: this.bit_1_l, paramBytes: 0},
      0xcb4e: {fn: this.bit_1_0xhl, paramBytes: 0},
      0xcb4f: {fn: this.bit_1_a, paramBytes: 0},
      0xcb50: {fn: this.bit_2_b, paramBytes: 0},
      0xcb51: {fn: this.bit_2_c, paramBytes: 0},
      0xcb52: {fn: this.bit_2_d, paramBytes: 0},
      0xcb53: {fn: this.bit_2_e, paramBytes: 0},
      0xcb54: {fn: this.bit_2_h, paramBytes: 0},
      0xcb55: {fn: this.bit_2_l, paramBytes: 0},
      0xcb56: {fn: this.bit_2_0xhl, paramBytes: 0},
      0xcb57: {fn: this.bit_2_a, paramBytes: 0},
      0xcb58: {fn: this.bit_3_b, paramBytes: 0},
      0xcb59: {fn: this.bit_3_c, paramBytes: 0},
      0xcb5a: {fn: this.bit_3_d, paramBytes: 0},
      0xcb5b: {fn: this.bit_3_e, paramBytes: 0},
      0xcb5c: {fn: this.bit_3_h, paramBytes: 0},
      0xcb5d: {fn: this.bit_3_l, paramBytes: 0},
      0xcb5e: {fn: this.bit_3_0xhl, paramBytes: 0},
      0xcb5f: {fn: this.bit_3_a, paramBytes: 0},
      0xcb60: {fn: this.bit_4_b, paramBytes: 0},
      0xcb61: {fn: this.bit_4_c, paramBytes: 0},
      0xcb62: {fn: this.bit_4_d, paramBytes: 0},
      0xcb63: {fn: this.bit_4_e, paramBytes: 0},
      0xcb64: {fn: this.bit_4_h, paramBytes: 0},
      0xcb65: {fn: this.bit_4_l, paramBytes: 0},
      0xcb66: {fn: this.bit_4_0xhl, paramBytes: 0},
      0xcb67: {fn: this.bit_4_a, paramBytes: 0},
      0xcb68: {fn: this.bit_5_b, paramBytes: 0},
      0xcb69: {fn: this.bit_5_c, paramBytes: 0},
      0xcb6a: {fn: this.bit_5_d, paramBytes: 0},
      0xcb6b: {fn: this.bit_5_e, paramBytes: 0},
      0xcb6c: {fn: this.bit_5_h, paramBytes: 0},
      0xcb6d: {fn: this.bit_5_l, paramBytes: 0},
      0xcb6e: {fn: this.bit_5_0xhl, paramBytes: 0},
      0xcb6f: {fn: this.bit_5_a, paramBytes: 0},
      0xcb70: {fn: this.bit_6_b, paramBytes: 0},
      0xcb71: {fn: this.bit_6_c, paramBytes: 0},
      0xcb72: {fn: this.bit_6_d, paramBytes: 0},
      0xcb73: {fn: this.bit_6_e, paramBytes: 0},
      0xcb74: {fn: this.bit_6_h, paramBytes: 0},
      0xcb75: {fn: this.bit_6_l, paramBytes: 0},
      0xcb76: {fn: this.bit_6_0xhl, paramBytes: 0},
      0xcb77: {fn: this.bit_6_a, paramBytes: 0},
      0xcb78: {fn: this.bit_7_b, paramBytes: 0},
      0xcb79: {fn: this.bit_7_c, paramBytes: 0},
      0xcb7a: {fn: this.bit_7_d, paramBytes: 0},
      0xcb7b: {fn: this.bit_7_e, paramBytes: 0},
      0xcb7c: {fn: this.bit_7_h, paramBytes: 0},
      0xcb7d: {fn: this.bit_7_l, paramBytes: 0},
      0xcb7e: {fn: this.bit_7_0xhl, paramBytes: 0},
      0xcb7f: {fn: this.bit_7_a, paramBytes: 0},
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
      0xcbc0: {fn: this.set_0_b, paramBytes: 0},
      0xcbc1: {fn: this.set_0_c, paramBytes: 0},
      0xcbc2: {fn: this.set_0_d, paramBytes: 0},
      0xcbc3: {fn: this.set_0_e, paramBytes: 0},
      0xcbc4: {fn: this.set_0_h, paramBytes: 0},
      0xcbc5: {fn: this.set_0_l, paramBytes: 0},
      0xcbc6: {fn: this.set_0_0xhl, paramBytes: 0},
      0xcbc7: {fn: this.set_0_a, paramBytes: 0},
      0xcbc8: {fn: this.set_1_b, paramBytes: 0},
      0xcbc9: {fn: this.set_1_c, paramBytes: 0},
      0xcbca: {fn: this.set_1_d, paramBytes: 0},
      0xcbcb: {fn: this.set_1_e, paramBytes: 0},
      0xcbcc: {fn: this.set_1_h, paramBytes: 0},
      0xcbcd: {fn: this.set_1_l, paramBytes: 0},
      0xcbce: {fn: this.set_1_0xhl, paramBytes: 0},
      0xcbcf: {fn: this.set_1_a, paramBytes: 0},
      0xcbd0: {fn: this.set_2_b, paramBytes: 0},
      0xcbd1: {fn: this.set_2_c, paramBytes: 0},
      0xcbd2: {fn: this.set_2_d, paramBytes: 0},
      0xcbd3: {fn: this.set_2_e, paramBytes: 0},
      0xcbd4: {fn: this.set_2_h, paramBytes: 0},
      0xcbd5: {fn: this.set_2_l, paramBytes: 0},
      0xcbd6: {fn: this.set_2_0xhl, paramBytes: 0},
      0xcbd7: {fn: this.set_2_a, paramBytes: 0},
      0xcbd8: {fn: this.set_3_b, paramBytes: 0},
      0xcbd9: {fn: this.set_3_c, paramBytes: 0},
      0xcbda: {fn: this.set_3_d, paramBytes: 0},
      0xcbdb: {fn: this.set_3_e, paramBytes: 0},
      0xcbdc: {fn: this.set_3_h, paramBytes: 0},
      0xcbdd: {fn: this.set_3_l, paramBytes: 0},
      0xcbde: {fn: this.set_3_0xhl, paramBytes: 0},
      0xcbdf: {fn: this.set_3_a, paramBytes: 0},
      0xcbe0: {fn: this.set_4_b, paramBytes: 0},
      0xcbe1: {fn: this.set_4_c, paramBytes: 0},
      0xcbe2: {fn: this.set_4_d, paramBytes: 0},
      0xcbe3: {fn: this.set_4_e, paramBytes: 0},
      0xcbe4: {fn: this.set_4_h, paramBytes: 0},
      0xcbe5: {fn: this.set_4_l, paramBytes: 0},
      0xcbe6: {fn: this.set_4_0xhl, paramBytes: 0},
      0xcbe7: {fn: this.set_4_a, paramBytes: 0},
      0xcbe8: {fn: this.set_5_b, paramBytes: 0},
      0xcbe9: {fn: this.set_5_c, paramBytes: 0},
      0xcbea: {fn: this.set_5_d, paramBytes: 0},
      0xcbeb: {fn: this.set_5_e, paramBytes: 0},
      0xcbec: {fn: this.set_5_h, paramBytes: 0},
      0xcbed: {fn: this.set_5_l, paramBytes: 0},
      0xcbee: {fn: this.set_5_0xhl, paramBytes: 0},
      0xcbef: {fn: this.set_5_a, paramBytes: 0},
      0xcbf0: {fn: this.set_6_b, paramBytes: 0},
      0xcbf1: {fn: this.set_6_c, paramBytes: 0},
      0xcbf2: {fn: this.set_6_d, paramBytes: 0},
      0xcbf3: {fn: this.set_6_e, paramBytes: 0},
      0xcbf4: {fn: this.set_6_h, paramBytes: 0},
      0xcbf5: {fn: this.set_6_l, paramBytes: 0},
      0xcbf6: {fn: this.set_6_0xhl, paramBytes: 0},
      0xcbf7: {fn: this.set_6_a, paramBytes: 0},
      0xcbf8: {fn: this.set_7_b, paramBytes: 0},
      0xcbf9: {fn: this.set_7_c, paramBytes: 0},
      0xcbfa: {fn: this.set_7_d, paramBytes: 0},
      0xcbfb: {fn: this.set_7_e, paramBytes: 0},
      0xcbfc: {fn: this.set_7_h, paramBytes: 0},
      0xcbfd: {fn: this.set_7_l, paramBytes: 0},
      0xcbfe: {fn: this.set_7_0xhl, paramBytes: 0},
      0xcbff: {fn: this.set_7_a, paramBytes: 0},
      0xcc: {fn: this.call_z, paramBytes: 2},
      0xcd: {fn: this.call, paramBytes: 2},
      0xce: {fn: this.adc_n, paramBytes: 1},
      0xcf: {fn: this.rst_08, paramBytes: 0},
      0xd0: {fn: this.ret_nc, paramBytes: 0},
      0xd1: {fn: this.pop_de, paramBytes: 0},
      0xd2: {fn: this.jp_nc_nn, paramBytes: 2},
      0xd3: {fn: this._noSuchOpcode, paramBytes: 0},
      0xd4: {fn: this.call_nc, paramBytes: 2},
      0xd5: {fn: this.push_de, paramBytes: 0},
      0xd6: {fn: this.sub_n, paramBytes: 1},
      0xd7: {fn: this.rst_10, paramBytes: 0},
      0xd8: {fn: this.ret_c, paramBytes: 0},
      0xd9: {fn: this.reti, paramBytes: 0},
      0xda: {fn: this.jp_c_nn, paramBytes: 2},
      0xdb: {fn: this._noSuchOpcode, paramBytes: 0},
      0xdc: {fn: this.call_c, paramBytes: 2},
      0xdd: {fn: this._noSuchOpcode, paramBytes: 0},
      0xde: {fn: this.sbc_n, paramBytes: 1},
      0xdf: {fn: this.rst_18, paramBytes: 0},
      0xe0: {fn: this.ldh_n_a, paramBytes: 1},
      0xe1: {fn: this.pop_hl, paramBytes: 0},
      0xe2: {fn: this.ld_0xc_a, paramBytes: 0},
      0xe3: {fn: this._noSuchOpcode, paramBytes: 0},
      0xe4: {fn: this._noSuchOpcode, paramBytes: 0},
      0xe5: {fn: this.push_hl, paramBytes: 0},
      0xe6: {fn: this.and_n, paramBytes: 1},
      0xe7: {fn: this.rst_20, paramBytes: 0},
      0xe8: {fn: this.add_sp_e, paramBytes: 1},
      0xe9: {fn: this.jp_hl, paramBytes: 0},
      0xea: {fn: this.ld_0xnn_a, paramBytes: 2},
      0xeb: {fn: this._noSuchOpcode, paramBytes: 0},
      0xec: {fn: this._noSuchOpcode, paramBytes: 0},
      0xed: {fn: this._noSuchOpcode, paramBytes: 0},
      0xee: {fn: this.xor_n, paramBytes: 1},
      0xef: {fn: this.rst_28, paramBytes: 0},
      0xf0: {fn: this.ldh_a_n, paramBytes: 1},
      0xf1: {fn: this.pop_af, paramBytes: 0},
      0xf2: {fn: this.ld_a_0xc, paramBytes: 0},
      0xf3: {fn: this.di, paramBytes: 0},
      0xf4: {fn: this._noSuchOpcode, paramBytes: 0},
      0xf5: {fn: this.push_af, paramBytes: 0},
      0xf6: {fn: this.or_n, paramBytes: 1},
      0xf7: {fn: this.rst_30, paramBytes: 0},
      0xf8: {fn: this.ldhl_sp_n, paramBytes: 1},
      0xf9: {fn: this.ld_sp_hl, paramBytes: 0},
      0xfa: {fn: this.ld_a_nn, paramBytes: 2},
      0xfb: {fn: this.ei, paramBytes: 0},
      0xfc: {fn: this._noSuchOpcode, paramBytes: 0},
      0xfd: {fn: this._noSuchOpcode, paramBytes: 0},
      0xfe: {fn: this.cp_n, paramBytes: 1},
      0xff: {fn: this.rst_38, paramBytes: 0},
    };
  }

  /**
   * @private
   */
  _checkSupportedROM(){
    try {
      this.mmu.getCartridgeType();
    } catch(e){
      throw e;
    }
  }

  /**
   * @returns {number} Accumulator
   */
  a(){
    return this._r.a;
  }

  /**
   * @param n
   * @private
   */
  _set_a(n){
    this._r.a = n;
  }

  /**
   * @returns {number} register b
   */
  b(){
    return this._r.b;
  }

  /**
   * @param n
   * @private
   */
  _set_b(n){
    this._r.b = n;
  }

  /**
   * @returns {number} register c
   */
  c(){
    return this._r.c;
  }

  /**
   * @param n
   * @private
   */
  _set_c(n){
    this._r.c = n;
  }

  /**
   * @returns {number} register d
   */
  d(){
    return this._r.d;
  }

  /**
   * @param n
   * @private
   */
  _set_d(n){
    this._r.d = n;
  }

  /**
   * @returns {number} register e
   */
  e(){
    return this._r.e;
  }

  /**
   * @param n
   * @private
   */
  _set_e(n){
    this._r.e = n;
  }

  /**
   * @returns {number} register h
   */
  h(){
    return this._r.h;
  }

  /**
   * @param n
   * @private
   */
  _set_h(n){
    this._r.h = n;
  }

  /**
   * @returns {number} register l
   */
  l(){
    return this._r.l;
  }

  /**
   * @param n
   */
  _set_l(n){
    this._r.l = n;
  }

  /**
   * @returns {number} program counter
   */
  pc(){
    return this._r.pc;
  }

  /**
   * @returns {number} stack pointer
   */
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

  /**
   * Sets register hl
   * @param nn
   * @private
   */
  _set_hl(nn){
    this._r.h = nn >> 8 & 0x00ff;
    this._r.l = nn & 0x00ff;
  }

  /**
   * @returns {number} byte at memory location hl
   * @private
   */
  _0xhl(){
    this._m++;
    return this.mmu.readByteAt(this.hl());
  }

  /**
   * @returns {number} byte at memory location hl
   */
  $hl(){
    return this.mmu.readByteAt(this.hl());
  }

  /**
   * @returns {number} flags (4 bits)
   */
  f(){
    return (this._r._f & 0xf0) >> 4;
  }

  /**
   * @returns {number} interrupt master enable
   */
  ime(){
    return this._r.ime;
  }

  /**
   * @returns {number} interrupt enable register
   */
  ie(){
    return this.mmu.ie();
  }

  /**
   * @returns {*|number} interrupt flags
   * @constructor
   */
  If(){
    return this.mmu.If();
  }

  /**
   * Sets Interrupt flags
   * @param value
   * @returns {*}
   */
  setIf(value){
    this.mmu.setIf(value);
  }

  /**
   * @returns {number} LCD Control Register
   */
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
   * @returns {number} machine cycles, for TDD
   */
  m(){
    return this._m;
  }

  /**
   * Main loop
   * @param {number} pc_stop
   */
  start(pc_stop = -1){
    try {
      this.frame(pc_stop);
    } catch(e){
      Logger.error(e.stack);
      throw e;
    }
  }

  /**
   * Runs cpu during a frame
   */
  frame(pc_stop){

    do {
      if (this.isStopped() || (pc_stop !== -1 && this._r.pc === pc_stop)){
        return;
      }

      const m = this._m;

      if (!this.isHalted()) {
        this._execute();
      } else {
        this._m++;
      }

      this._handle_lcd();
      this._handleDMA();
      this._handleDIV(this._m - m);

      if (this._r.pc === this.mmu.ADDR_GAME_START){
        this._afterBIOS();
      }

      if (this._isLYCInterrupt()){
        this._handleLYCInterrupt();      
      }

    } while (!this._isVBlankTriggered());

    this._handleVBlankInterrupt();
  }

  /**
   * @returns {boolean}
   * @private
   */
  _isLYCInterrupt(){
    return ( (this.mmu.ie() & this.mmu.If() & this.mmu.IF_STAT_ON) >> 1) === 1;
  }

  /**
   * @private
   */
  _handleLYCInterrupt(){
    if (this._r.ime === 0){
      return false;
    }
    this.setIf(this.If() & this.mmu.IF_STAT_OFF);
    this._rst_48();
  }

  /**
   * @private
   */
  _handleDIV(m_instr){
    this.mmu.set_HW_DIV(m_instr * 2);
  }

  /**
   * Handles DMA
   * @private
   */
  _handleDMA(){
    if (this.mmu.isDMA()){
      if (this._m_dma === this.M_CYCLES_DMA) {
        this.mmu.setDMA(false);
      } else {
        this._m_dma++;
      }
    } else {
      this._m_dma = 0;
    }
  }

  /**
   * Handles LCD updates
   * @private
   */
  _handle_lcd(){

    if (!this._is_lcd_on()){
      this._m = 0;
      return;
    }

    if (this._m >= (this._mLyOffset() + this.M_CYCLES_PER_LINE)) {

      this.mmu.incrementLy();
      this._lineDrawn = false;

      if (this.ly() === 0) {
        this._m = 0;
        this.mmu.setLCDMode(0);
      }

      if (this.ly() === this.mmu.LCDC_LINE_VBLANK) {
        this.mmu.setLCDMode(1);
        this._triggerVBlank();
      }

    } else {
      this._handleTransitionsBeforeVBL();
    }
  }

  /**
   * @private
   */
  _handleTransitionsBeforeVBL() {
    switch (this.mmu.getLCDMode()) {
      case 0:
        if (!this._lineDrawn && this._m > (this._mLyOffset() + this.M_CYCLES_STOP_MODE_0)) {
          this.mmu.setLCDMode(2);
        }
        break;
      case 1:
        break; // No transition during vblank
      case 2:
        if (this._m > (this._mLyOffset() + this.M_CYCLES_STOP_MODE_2)) {
          this.mmu.setLCDMode(3);
        }
        break;
      case 3:
        if (this._m > (this._mLyOffset() + this.M_CYCLES_STOP_MODE_3)) {
          this.mmu.setLCDMode(0);
          this.lcd.drawLine(this.ly());
          this._lineDrawn = true;
        }
        break;
    }
  }

  /**
   * @returns {number} clock start value for a given lcd line
   * @private
   */
  _mLyOffset(){
    return this.ly() * this.M_CYCLES_PER_LINE;
  }

  /**
   * @returns {boolean} true if LCD is on
   * @private
   */
  _is_lcd_on(){
    return (this.lcdc() & 0x80) === 0x80;
  }

  /**
   * Sets adjustments before game starts.
   * @private
   */
  _afterBIOS(){
    this.mmu.setRunningBIOS(false);
    this.mmu.setIe(0x00);
    this.mmu.setLy(0x00);
    this._r.c = 0x13; // there's a bug somewhere that leaves c=0x14
  }

  /**
   * @returns {boolean} if vblank interrupt should be triggered
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

    this._resetVBlank();
    this._halt = false;

    // BIOS does not have an vblank routine to execute
    if (!this.mmu.isRunningBIOS()) {
      this.di();
      this._rst_40();
    }
  }

  paint(){
    this.lcd.paint();
  }

  /**
   * @returns {boolean} true if vblank
   */
  isVBlank(){
    if (this._r.ime === 1 && (this.mmu.ie() & this.mmu.If() & this.IF_VBLANK_ON) === 1){
      if (this._lastInstrWasEI){
        this._lastInstrWasEI = false;
        return false; // wait one instruction more
      } else {
        return true;
      }
    }
    return false;
  }

  /**
   * Sets IF to trigger a vblank interruption
   * @private
   */
  _triggerVBlank(){
    this.mmu.setIf(this.If() | this.IF_VBLANK_ON);
  }

  /**
   * Resets vblank when dispatched.
   * @private
   */
  _resetVBlank(){
    this.mmu.setIf(this.If() & this.IF_VBLANK_OFF);
  }

  /**
   * Start emulation until a given program counter. For tests.
   * @param {number} pc_stop
   */
  runUntil(pc_stop){
    while (this.pc() < pc_stop){
      this.start(pc_stop);
    }
  }

  /**
   * Executes the next instruction and increases the pc.
   * @private
   */
  _execute() {

    let opcode = this._nextOpcode();

    if (opcode === this.EXTENDED_PREFIX){
      opcode = (opcode << 8) + this._nextOpcode();
    }

    const {fn, paramBytes} = this._getInstruction(opcode);
    const param = this._getInstrParams(paramBytes);

    Logger.state(this, fn, paramBytes, param);

    try {
      fn.call(this, param, opcode);
    } catch (e){
      Logger.beforeCrash(this, fn, paramBytes, param);
      throw e;
    }
  }

  /**
   * @param param
   * @param opcode
   * @private
   */
  _noSuchOpcode(param, opcode){
    Logger.info(`Opcode ${Utils.hex2(opcode)} not supported in original DMG. Ignoring.`);
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
   * @param {number} opcode
   * @returns {Object} instruction given the opcode
   * @private
   */
  _getInstruction(opcode) {
    if (this._instructions[opcode] != null) {
      return this._instructions[opcode];
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
    this._m += 4;
  }

  /**
   * Adds signed byte to current address and jumps to it.
   * @param {number} signed byte
   */
  jr_e(signed){
    let nextAddress = this._r.pc + Utils.uint8ToInt8(signed);
    if (nextAddress < 0){
      nextAddress += 0x10000;
    } else if (nextAddress > 0xffff) {
      nextAddress -= 0x10000;
    }
    this._r.pc = nextAddress;
    this._m += 3;
  }

  /**
   * Jumps to address contained in hl.
   */
  jp_hl(){
    this._r.pc = this.hl();
    this._m++;
  }

  /**
   * No operation.
   */
  nop(){
    this._m++;
  }

  /**
   * Register a AND a
   */
  and_a(){
    this._and_n(this._r.a);
  }

  /**
   * Register a AND b
   */
  and_b(){
    this._and_n(this._r.b);
  }

  /**
   * Register a AND c
   */
  and_c(){
    this._and_n(this._r.c);
  }

  /**
   * Register a AND d
   */
  and_d(){
    this._and_n(this._r.d);
  }

  /**
   * Register a AND e
   */
  and_e(){
    this._and_n(this._r.e);
  }

  /**
   * Register a AND h
   */
  and_h(){
    this._and_n(this._r.h);
  }

  /**
   * Register a AND l
   */
  and_l(){
    this._and_n(this._r.l);
  }

  /**
   * Register a AND value at memory location hl
   */
  and_0xhl(){
    this._and_n(this._0xhl());
  }

  /**
   * Register a AND n
   * @param n
   */
  and_n(n){
    this._and_n(n);
    this._m++;
  }

  /**
   * Register a AND n
   * @param n
   * @private
   */
  _and_n(n){
    if (this._r.a &= n){
      this.setZ(0);
    } else {
      this.setZ(1);
    }
    this.setN(0); this.setH(1); this.setC(0);
    this._m++;
  }

  /** 
   * Register a OR a. Does nothing.
   */
  or_a(){
    this._or_n(this._r.a);
  }

  /**
   * Register a OR b
   */
  or_b(){
    this._or_n(this._r.b);
  }

  /**
   * Register a OR c
   */
  or_c(){
    this._or_n(this._r.c);
  }

  /**
   * Register a OR d
   */
  or_d(){
    this._or_n(this._r.d);
  }

  /**
   * Register a OR e
   */
  or_e(){
    this._or_n(this._r.e);
  }

  /**
   * Register a OR h
   */
  or_h(){
    this._or_n(this._r.h);
  }

  /**
   * Register a OR l
   */
  or_l(){
    this._or_n(this._r.l);
  }

  /**
   * Register a OR memory location hl
   */
  or_0xhl(){
    this._or_n(this._0xhl());
  }

  /**
   * Register a OR n
   * @param n
   */
  or_n(n){
    this._or_n(n);
    this._m++;
  }
  
  /**
   * Register a OR n
   * @param {number} n
   * @private
   */
  _or_n(n){
    if (this._r.a |= n){
      this.setZ(0);
    } else {
      this.setZ(1);
    }
    this.setN(0); this.setH(0); this.setC(0);
    this._m++;
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
    this._m++;
  }

  /**
   * XOR byte n with register a.
   * @param {number} n, a byte
   * @private
   */
  _xor(n){
    this._r.a ^= n;
    this._resetAllFlags();
    if (this._r.a === 0){
      this.setZ(1);
    }
    this._m++;
  }

  /**
   * @private
   */
  _resetAllFlags(){
    this._r._f &= 0x0f;
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
   * Sets carry flag
   */
  scf(){
    this.setC(1);
    this.setN(0);
    this.setH(0);
    this._m++;
  }

  /**
   * Complements carry flag
   */
  ccf(){
    if (this.C() === 0)
      this.setC(1);
    else
      this.setC(0);
    this.setN(0);
    this.setH(0);
    this._m++;
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
    this._m += 3;
  }

  /**
   * Loads hl into stack pointer
   */
  ld_sp_hl(){
    this._r.sp = this.hl();
    this._m += 2;
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
    this._m += 3;
  }

  /**
   * Loads 8 bits into b
   * @param n
   */
  ld_b_n(n){
    this._ld_r_n('b', n);
    this._m++;
  }

  /**
   * Loads 8 bits into c
   * @param n
   */
  ld_c_n(n){
    this._ld_r_n('c', n);
    this._m++;
  }

  /**
   * Loads 8 bits into d
   * @param n
   */
  ld_d_n(n){
    this._ld_r_n('d', n);
    this._m++;
  }

  /**
   * Loads 8 bits into e
   * @param n
   */
  ld_e_n(n){
    this._ld_r_n('e', n);
    this._m++;
  }

  /**
   * Loads 8 bits into h
   * @param n
   */
  ld_h_n(n){
    this._ld_r_n('h', n);
    this._m++;
  }

  /**
   * Loads 8 bits into l
   * @param n
   */
  ld_l_n(n){
    this._ld_r_n('l', n);
    this._m++;
  }

  /**
   * Loads 8 bits into register r
   * @param r
   * @param n
   * @private
   */
  _ld_r_n(r, n){
    this._r[r] = n;
    this._m++;
  }

  /**
   * Loads register a into a.
   */
  ld_a_a(){
    this._ld_r_r('a', 'a');
  }

  /**
   * Loads register b into a.
   */
  ld_a_b(){
    this._ld_r_r('a', 'b');
  }

  /**
   * Loads register c into a.
   */
  ld_a_c(){
    this._ld_r_r('a', 'c');
  }

  /**
   * Loads register a into d.
   */
  ld_a_d(){
    this._ld_r_r('a', 'd');
  }

  /**
   * Loads register e into a.
   */
  ld_a_e(){
    this._ld_r_r('a', 'e');
  }

  /**
   * Loads register h into a.
   */
  ld_a_h(){
    this._ld_r_r('a', 'h');
  }

  /**
   * Loads register l into a.
   */
  ld_a_l(){
    this._ld_r_r('a', 'l');
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
    this._ld_r_0xhl('a');
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
    this._m += 2;
  }

  /**
   * Loads 8 bits into register a.
   * @param n
   */
  ld_a_n(n){
    this._ld_r_n('a', n);
    this._m++;
  }

  /**
   * Loads a with value at address hl. Decrements hl.
   */
  ldd_a_0xhl(){
    this._r.a = this._0xhl();
    this._dec_hl();
  }

  /**
   * Puts a into memory address hl. Decrements hl.
   */
  ldd_0xhl_a(){
    this._ld_0xnn_a(this.hl());
    this._dec_hl();
  }

  /** 
   * Puts a into memory address hl. Increments hl.
   */
  ldi_0xhl_a(){
    this._ld_0xnn_a(this.hl());
    this._inc_hl();
  }

  /**
   * Puts value at memory location hl into a. Increments hl.
   */
  ldi_a_0xhl(){
    this._ld_a_0xhl();
    this._inc_hl();
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
    this._m++;
  }

  /**
   * Decrements memory location hl by 1
   */
  dec_0xhl(){
    let value = this._0xhl();
    this.setN(1); // subtracting

    if ((value & 0x0f) === 0){
      this.setH(1); // half carry
    } else {
      this.setH(0);
    }

    if (value === 0){
      value = 0xff; // loop value
    } else {
      value--;
    }

    if (value === 0){
      this.setZ(1); // result is zero
    } else {
      this.setZ(0);
    }
    this.mmu.writeByteAt(this.hl(), value);
    this._m += 2;
  }

  /**
   * Decrements bc by 1.
   */
  dec_bc(){
    this._dec_rr('b', 'c');
    this._m++;
  }

  /**
   * Decrements de by 1.
   */
  dec_de(){
    this._dec_rr('d', 'e');
    this._m++;
  }

  /**
   * Decrements hl by 1.
   */
  dec_hl(){
    this._dec_hl();
    this._m++;
  }

  /**
   * Decrements hl by 1.
   * @private
   */
  _dec_hl(){
    this._dec_rr('h', 'l');
  }

  /**
   * Decrements sp by 1.
   */
  dec_sp(){
    if (this._r.sp === 0){
      this._r.sp = this.mmu.ADDR_MAX;
    } else {
      this._r.sp--;
    }
    this._m += 2;
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
    this._m++;
  }

  /**
   * Jumps to address nn if last operation was not zero.
   * @param nn
   */
  jp_nz_nn(nn){
    this._jp_flag_nn(this.Z(), 0, nn);
  }

  /**
   * Jumps to address nn if last operation was zero.
   * @param nn
   */
  jp_z_nn(nn){
    this._jp_flag_nn(this.Z(), 1, nn);
  }

  /**
   * Jumps to memory nn if the given flag has the given value.
   * @param flag
   * @param valueToJump
   * @param nn
   * @private
   */
  _jp_flag_nn(flag, valueToJump, nn){
    if (flag === valueToJump){
      this.jp(nn);
    } else {
      this._m += 3;
    }
  }

  /**
   * Jumps to address nn if last operation did not carry a bit.
   * @param nn
   */
  jp_nc_nn(nn){
    this._jp_flag_nn(this.C(), 0, nn);
  }

  /**
   * Jumps to address nn if last operation carried a bit.
   * @param nn
   */
  jp_c_nn(nn){
    this._jp_flag_nn(this.C(), 1, nn);
  }

  /**
   * Jumps to current address + n if last operation was not zero.
   * @param {number} n, signed integer
   */
  jr_nz_n(n){
    this._jr_flag_n(this.Z(), 0, n);
  }

  /**
   * Jumps to current address + n if last operation was zero.
   * @param {number} n, signed integer
   */
  jr_z_n(n){
    this._jr_flag_n(this.Z(), 1, n);
  }

  /**
   * Jumps to signed value n if given flag matches given value
   * @param flag
   * @param valueToJump
   * @param n
   * @private
   */
  _jr_flag_n(flag, valueToJump, n){
    if (flag === valueToJump){
      this.jr_e(n);
    } else {
      this._m += 2;
    }
  }

  /**
   * Jumps to current address + n if last operation did not carry 1 bit.
   * @param {number} n, signed integer
   */
  jr_nc_n(n){
    this._jr_flag_n(this.C(), 0, n);
  }

  /**
   * Jumps to current address + n if last operation carried 1 bit
   * @param {number} n signed integer
   */
  jr_c_n(n){
    this._jr_flag_n(this.C(), 1, n);
  }

  /** 
   * Disables interruptions after executing the next instruction.
   */
  di(){
    this._r.ime = 0;
    this._m++;
  }

  /** 
   * Enables interruptions after executing the next instruction.
   */
  ei(){
    this._r.ime = 1;
    this._lastInstrWasEI = true;
    this._m++;
  }

  /**
   * Loads a into memory address 0xff00 + n
   * @param {number} n
   */
  ldh_n_a(n){
    this.mmu.writeByteAt(0xff00 + n, this._r.a);
    this._m += 3;
  }

  /**
   * Loads memory address 0xff00 + n into register a.
   * @param {number} n
   */
  ldh_a_n(n){
    this._r.a = this.mmu.readByteAt(0xff00 + n);
    this._m += 3;
  }

  /**
   * Compares register a with register a
   */
  cp_a(){
    this._cp_n(this._r.a);
  }

  /**
   * Compares register b with register a
   */
  cp_b(){
    this._cp_n(this._r.b);
  }

  /**
   * Compares register c with register a
   */
  cp_c(){
    this._cp_n(this._r.c);
  }

  /**
   * Compares register d with register a
   */
  cp_d(){
    this._cp_n(this._r.d);
  }

  /**
   * Compares register e with register a
   */
  cp_e(){
    this._cp_n(this._r.e);
  }

  /**
   * Compares register h with register a
   */
  cp_h(){
    this._cp_n(this._r.h);
  }

  /**
   * Compares register l with register a
   */
  cp_l(){
    this._cp_n(this._r.l);
  }

  /**
   * Compares memory location hl with register a
   */
  cp_0xhl(){
    this._cp_n(this._0xhl());
  }

  /**
   * Compares n with register a.
   * @param n
   */
  cp_n(n){
    this._cp_n(n);
    this._m++;
  }

  /**
   * Compares n with register a.
   * @param {number} n
   * @private
   */
  _cp_n(n){
    
    this.setN(1); this.setZ(0); this.setC(0);
    const diff = this._r.a - n;
    
    if (diff === 0){
      this.setZ(1);
    } else if (diff < 0){
       this.setC(1);
    }
    this._m++;
  }

  /**
   * Tests bit b in value
   * @param b
   * @param value
   * @private
   */
  _bit_b_r(b, value) {
    if ((value & (1 << b)) >> b) {
      this.setZ(0);
    } else {
      this.setZ(1);
    }
    this.setN(0); this.setH(1);
    this._m += 2;
  }

  /**
   * Tests bit b at memory location hl
   * @param b
   * @private
   */
  _bit_b_0xhl(b){
    this._bit_b_r(b, this._0xhl());
  }

  /**
   * Attaches reset bit functions to the cpu programmatically.
   * @private
   */
  _attach_bit_functions() {
    ['a', 'b', 'c', 'd', 'e', 'h', 'l', '0xhl'].map((r) => {
      for (let b = 0; b < 8; b++) {
        if (r === '0xhl'){
          this[`bit_${b}_0xhl`] = function() { this._bit_b_0xhl(b); };
          this[`res_${b}_0xhl`] = function() { this._res_b_0xhl(b); };
          this[`set_${b}_0xhl`] = function() { this._set_b_0xhl(b); };
        } else {
          this[`bit_${b}_${r}`] = function() { this._bit_b_r(b, this._r[r]); };
          this[`res_${b}_${r}`] = function() { this._res_b_r(b, r); };
          this[`set_${b}_${r}`] = function() { this._set_b_r(b, r); };
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
    this._r[r] &= Utils.bitMask(bit);
    this._m += 2;
  }

  /**
   * Resets bit b of value at memory location hl.
   * @param bit
   * @private
   */
  _res_b_0xhl(bit){
    this.mmu.writeByteAt(this.hl(), this._0xhl() & Utils.bitMask(bit));
    this._m += 3;
  }

  /**
   * Sets bit b of register r.
   * @param bit
   * @private
   */
  _set_b_r(bit, r){
    this._r[r] |= (1 << bit);
    this._m += 2;
  }

  /**
   * Sets bit b of value at memory location hl.
   * @param bit
   * @private
   */
  _set_b_0xhl(bit){
    const value = this._0xhl() | (1 << bit);
    this.mmu.writeByteAt(this.hl(), value);
    this._m += 3;
  }

  /**
   * Loads register a into memory address 0xff00 + c
   */
  ld_0xc_a(){
    this.mmu.writeByteAt(0xff00 + this._r.c, this._r.a);
    this._m += 2;
  }

  /**
   * Loads memory address 0xff00 + c into a
   */
  ld_a_0xc(){
    this._r.a = this.mmu.readByteAt(0xff00 + this._r.c);
    this._m += 2;
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
    this._m++;
  }

  /**
   * Increases register de by 1
   */
  inc_de(){
    this._inc_rr('d', 'e');
    this._m++;
  }

  /**
   * Increases register hl by 1
   * @public
   */
  inc_hl(){
    this._inc_hl();
    this._m++;
  }

  /**
   * Increases register hl by 1
   * @private
   */
  _inc_hl(){
    this._inc_rr('h', 'l');
  }

  /**
   * Increases stack pointer by 1
   */
  inc_sp(){
    if (this._r.sp === this.mmu.ADDR_MAX){
      this._r.sp = 0;
    } else {
      this._r.sp++;
    }
    this._m += 2;
  }

  /**
   * Increases register rr by 1
   * @private
   */
  _inc_rr(r1, r2){
    const value = (this._r[r1] << 8) + this._r[r2] + 1;
    if ((value & 0x10000) > 0){
      this._r[r1] = 0;
      this._r[r2] = 0;
    } else {
      this._r[r1] = (value & 0xff00) >> 8;
      this._r[r2] = value & 0x00ff;
    }
    this._m++;
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
    this._m += 2;
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
    this._m++;
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
    this._m++;
  }

  /**
   * Loads register r2 into r1
   * @param r1
   * @param r2
   * @private
   */
  _ld_r_r(r1, r2){
    this._r[r1] = this._r[r2];
    this._m++;
  }

  /**
   * Loads b into b
   */
  ld_b_b(){
    this._ld_r_r('b', 'b');
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
    this._ld_r_r('c', 'c');
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
    this._ld_r_r('d', 'd');
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
    this._ld_r_r('e', 'e');
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
    this._ld_r_r('l', 'l');
  }

  /**
   * Loads register a into memory location bc
   */
  ld_0xbc_a(){
    this._ld_0xnn_a(this.bc());
    this._m++;
  }

  /**
   * Loads register a into memory location de
   */
  ld_0xde_a(){
    this._ld_0xnn_a(this.de());
    this._m++;
  }

  /**
   * Loads register a into memory location hl
   */
  ld_0xhl_a(){
    this._ld_0xnn_a(this.hl());
    this._m++;
  }

  /**
   * Loads register a into memory address nn
   * @param addr
   */
  ld_0xnn_a(addr){
    this._ld_0xnn_a(addr);
    this._m += 3;
  }

  /**
   * Loads register a into memory address nn
   * @param addr
   * @private
   */
  _ld_0xnn_a(addr){
    this.mmu.writeByteAt(addr, this._r.a);
    this._m++;
  }

  /**
   * Calls a routine at a given address, saving the pc in the
   * stack.
   * @param addr
   */
  call(addr){
    this._push_pc();
    this._r.pc = addr;
    this._m += 6;
  }

  /**
   * Calls a routine at a given address if z flag is not set
   * @param addr
   */
  call_nz(addr){
    this._call_flag(addr, this.Z(), 0);
  }

  /**
   * Calls a routine at a given address if z flag is set
   * @param addr
   */
  call_z(addr){
    this._call_flag(addr, this.Z(), 1);
  }

  /**
   * Calls a routine at a given address if c flag is not set
   * @param addr
   */
  call_nc(addr){
    this._call_flag(addr, this.C(), 0);
  }

  /**
   * Calls a routine at a given address if c flag is set
   * @param addr
   */
  call_c(addr){
    this._call_flag(addr, this.C(), 1);
  }

  /**
   * Calls a routine if a given flag has a given value
   * @param addr
   * @param flag
   * @param trigger
   * @private
   */
  _call_flag(addr, flag, trigger){
    if (flag === trigger){
      this.call(addr);
    } else {
      this._m += 3;
    }
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
    this.mmu.writeByteAt(--this._r.sp, this._r.a);
    this.mmu.writeByteAt(--this._r.sp, (this._r._f & 0xf0)); // do not store lower hidden bits on stack
    this._m += 4;
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
    this._m += 4;
  }

  /**
   * Pops two bytes off the stack into af
   */
  pop_af(){
    this._r._f = (this.mmu.readByteAt(this._r.sp++) & 0xf0); // keep hidden bits at zero
    this._r.a = this.mmu.readByteAt(this._r.sp++);
    this._m += 3;
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
    this._m += 3;
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
    this.rla();
    this._m++;
  }

  /**
   * Rotates left register a
   */
  rla(){
    this._rl_r(this._set_a, this.a);
  }

  /**
   * Rotates left register b
   */
  rl_b(){
    this._rl_r(this._set_b, this.b);
    this._m++;
  }

  /**
   * Rotates left register c
   */
  rl_c(){
    this._rl_r(this._set_c, this.c);
    this._m++;
  }

  /**
   * Rotates left register d
   */
  rl_d(){
    this._rl_r(this._set_d, this.d);
    this._m++;
  }

  /**
   * Rotates left register e
   */
  rl_e(){
    this._rl_r(this._set_e, this.e);
    this._m++;
  }

  /**
   * Rotates left register h
   */
  rl_h(){
    this._rl_r(this._set_h, this.h);
    this._m++;
  }

  /**
   * Rotates left register l
   */
  rl_l(){
    this._rl_r(this._set_l, this.l);
    this._m++;
  }

  /**
   * Rotates left register r with carry flag.
   * @param {function} setter
   * @param {function} getter
   * @param carried
   * @private
   */
  _rl_r(setter, getter, carried=this.C()){

    let value = getter.call(this);
    const rotated = (value << 1) + carried;
    value = rotated & 0xff;
    setter.call(this, value);

    this.setC((rotated & 0x100) >> 8);

    if (value === 0){
      this.setZ(1);
    } else {
      this.setZ(0);
    }

    this.setN(0);
    this.setH(0);
    this._m++;
  }

  /**
   * Rotates right register a
   */
  rra(){
    this._rr_r(this._set_a, this.a);
  }

  /**
   * Rotates right register a
   */
  rr_a(){
    this.rra();
    this._m++;
  }

  /**
   * Rotates right register b
   */
  rr_b(){
    this._rr_r(this._set_b, this.b);
    this._m++;
  }

  /**
   * Rotates right register c
   */
  rr_c(){
    this._rr_r(this._set_c, this.c);
    this._m++;
  }

  /**
   * Rotates right register d
   */
  rr_d(){
    this._rr_r(this._set_d, this.d);
    this._m++;
  }

  /**
   * Rotates right register e
   */
  rr_e(){
    this._rr_r(this._set_e, this.e);
    this._m++;
  }

  /**
   * Rotates right register h
   */
  rr_h(){
    this._rr_r(this._set_h, this.h);
    this._m++;
  }

  /**
   * Rotates right register l
   */
  rr_l(){
    this._rr_r(this._set_l, this.l);
    this._m++;
  }

  /**
   * Rotates right register r
   * @param {function} setter
   * @param {function} getter
   * @param carried
   * @private
   */
  _rr_r(setter, getter, carried=this.C()){

    let value = getter.call(this);
    this.setC(value & 0x01);
    value = (value >> 1) + (carried << 7);
    setter.call(this, value);

    if (value === 0){
      this.setZ(1);
    } else {
      this.setZ(0);
    }

    this.setN(0);
    this.setH(0);
    this._m++;
  }

  /**
   * Rotates left the value at memory hl. Sets carry flag.
   */
  rl_0xhl(carried=this.C()) {
    this._rl_r(this._ld_0xhl_n, this._0xhl, carried);
  }

  /**
   * Rotates right the value at memory hl. Sets carry flag.
   */
  rr_0xhl(carried=this.C()){
    this._rr_r(this._ld_0xhl_n, this._0xhl, carried);
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
      this._m++;
    } else {
      this._m += 2;
    }
  }

  /**
   * Jumps if last operation was zero
   */
  ret_z(){
    if (this.Z() === 1){
      this.jp(this._pop_nn());
      this._m++;
    } else {
      this._m += 2;
    }
  }

  /**
   * Jumps if last operation did not carry
   */
  ret_nc(){
    if (this.C() === 0){
      this.jp(this._pop_nn());
      this._m++;
    } else {
      this._m += 2;
    }
  }

  /**
   * Jumps if last operation carried
   */
  ret_c(){
    if (this.C() === 1){
      this.jp(this._pop_nn());
      this._m++;
    } else {
      this._m += 2;
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
    this._sub_n(this._r.a);
  }

  /**
   * Subtract b from a
   */
  sub_b(){
    this._sub_n(this._r.b);
  }

  /**
   * Subtract c from a
   */
  sub_c(){
    this._sub_n(this._r.c);
  }

  /**
   * Subtract d from a
   */
  sub_d(){
    this._sub_n(this._r.d);
  }

  /**
   * Subtract e from a
   */
  sub_e(){
    this._sub_n(this._r.e);
  }

  /**
   * Subtract h from a
   */
  sub_h(){
    this._sub_n(this._r.h);
  }

  /**
   * Subtract l from a
   */
  sub_l(){
    this._sub_n(this._r.l);
  }

  /**
   * Subtract value at memory address hl from a
   */
  sub_0xhl(){
    this._sub_n(this._0xhl());
  }

  /**
   * Subtract n from a
   * @param n
   */
  sub_n(n){
    this._sub_n(n);
    this._m++;
  }

  /**
   * Writes a value n into memory address hl
   * @param {number} n
   */
  ld_0xhl_n(n){
    this._ld_0xhl_n(n);
    this._m++;
  }

  /**
   * Writes a value n into memory address hl
   * @param {number} n
   * @private
   */
  _ld_0xhl_n(n){
    this.mmu.writeByteAt(this.hl(), n);
    this._m += 2;
  }

  /**
   * Subtract register value from register a
   * @param value
   * @private
   */
  _sub_n(value, carry=0){

    this.setN(1);

    let subtract = value + carry;
    const diff = this._r.a - subtract;
    let nybble_a = this._r.a & 0xf0;

    if (diff < 0) {
      this._r.a += 0x100;
      nybble_a = 0xf0;
      this.setC(1);
    } else {
      this.setC(0);
    }

    this._r.a -= subtract;
      
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

    this._m++;
  }

  /**
   * Subtract a and carry flag to a
   */
  sbc_a(){
    this._sbc_n(this._r.a);
  }

  /**
   * Subtract b and carry flag to a
   */
  sbc_b(){
    this._sbc_n(this._r.b);
  }

  /**
   * Subtract c and carry flag to a
   */
  sbc_c(){
    this._sbc_n(this._r.c);
  }

  /**
   * Subtract d and carry flag to a
   */
  sbc_d(){
    this._sbc_n(this._r.d);
  }

  /**
   * Subtract e and carry flag to a
   */
  sbc_e(){
    this._sbc_n(this._r.e);
  }

  /**
   * Subtract h and carry flag to a
   */
  sbc_h(){
    this._sbc_n(this._r.h);
  }

  /**
   * Subtract l and carry flag to a
   */
  sbc_l(){
    this._sbc_n(this._r.l);
  }

  /**
   * Subtract n and carry flag to a
   * @param {number} byte
   */
  sbc_n(n){
    this._sbc_n(n);
    this._m++;
  }

  /**
   * Subtract value at memory hl minus carry to a
   */
  sbc_0xhl(){
    this._sbc_n(this._0xhl());
  }

  /**
   * Subtract value and carry flag to a
   * @param n
   * @private
   */
  _sbc_n(n){
    this._sub_n(n, this.C());
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
    this._m++;
  }

  /**
   * Adds a value to register a
   * @param {number} value, 8 bits
   * @private
   */
  _add_r(value, carry=0){

    this.setN(0);
    const add = value + carry;

    // Half carry
    if (add > (0x0f - (this._r.a & 0x0f))){
      this.setH(1);
    } else {
      this.setH(0);
    }

    this._r.a = this._r.a + add;

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
    this._m++;
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
    this._m += 2;
  }

  /**
   * @param {number} signed byte
   */
  add_sp_e(signed){
    this.setN(0); this.setZ(0); this.setH(0); this.setC(0);

    const newValue = this._r.sp + Utils.uint8ToInt8(signed);

    if (newValue > 0xffff){
      this.setC(1); this.setH(1);
      this._r.sp -= 0x10000;
    }
    if (newValue < 0){
      this._r.sp =+ 0x10000;
    }

    this._r.sp += Utils.uint8ToInt8(signed);

    this._m += 4;
  }

  /**
   * Loads register b into memory location hl
   */
  ld_0xhl_b(){
    this._ld_0xhl_n(this._r.b);
  }

  /**
   * Loads register c into memory location hl
   */
  ld_0xhl_c(){
    this._ld_0xhl_n(this._r.c);
  }

  /**
   * Loads register d into memory location hl
   */
  ld_0xhl_d(){
    this._ld_0xhl_n(this._r.d);
  }

  /**
   * Loads register e into memory location hl
   */
  ld_0xhl_e(){
    this._ld_0xhl_n(this._r.e);
  }

  /**
   * Loads register h into memory location hl
   */
  ld_0xhl_h(){
    this._ld_0xhl_n(this._r.h);
  }

  /**
   * Loads register l into memory location hl
   */
  ld_0xhl_l(){
    this._ld_0xhl_n(this._r.l);
  }

  /** 
   * Complements register a
   */
  cpl() {
    this._r.a = Utils.cplBin8(this._r.a);
    this.setN(1); this.setH(1);
    this._m++;
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
    const swapped = Utils.swapNybbles(this._0xhl());

    if (swapped){
      this.setZ(0);
    } else {
      this.setZ(1);
    }
    this._ld_0xhl_n(swapped);
    this.setN(0); this.setH(0); this.setC(0);
    this._m++;
  }

  /**
   * Swaps nybbles of register r
   * @param {string} r
   * @private
   */
  _swap_n(r){
    if (this._r[r] = Utils.swapNybbles(this._r[r])){
      this.setZ(0);
    } else {
      this.setZ(1);
    }
    this.setN(0); this.setH(0); this.setC(0);
    this._m += 2;
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
   * Jumps to STAT interrupt routine
   * @private
   */
  _rst_48(){
    this._rst_n(this.ADDR_STAT_INTERRUPT);
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

  /**
   * Shifts register a left
   */
  sla_a(){
    this._sla_r(this._set_a, this.a);
  }

  /**
   * Shifts register b left
   */
  sla_b(){
    this._sla_r(this._set_b, this.b);
  }

  /**
   * Shifts register c left
   */
  sla_c(){
    this._sla_r(this._set_c, this.c);
  }

  /**
   * Shifts register d left
   */
  sla_d(){
    this._sla_r(this._set_d, this.d);
  }

  /**
   * Shifts register e left
   */
  sla_e(){
    this._sla_r(this._set_e, this.e);
  }

  /**
   * Shifts register h left
   */
  sla_h(){
    this._sla_r(this._set_h, this.h);
  }

  /**
   * Shifts register l left
   */
  sla_l(){
    this._sla_r(this._set_l, this.l);
  }

  /**
   * Shifts register r left
   * @param {function} setter
   * @param {function} getter
   * @private
   */
  _sla_r(setter, getter){
    this._rl_r(setter, getter, 0);
    this._m++;
  }

  /**
   * Shifts left the value at memory location hl
   */
  sla_0xhl(){
    this.rl_0xhl(0);
  }

  /**
   * @param {function} setter
   * @param {function} getter
   * @private
   */
  _sra_r(setter, getter){
    this._rr_r(setter, getter, getter.call(this) >> 7);
  }

  /**
   * Shift right register a without modifying bit 7
   */
  sra_a(){
    this._sra_r(this._set_a, this.a);
    this._m++;
  }

  /**
   * Shift right register b without modifying bit 7
   */
  sra_b(){
    this._sra_r(this._set_b, this.b);
    this._m++;
  }

  /**
   * Shift right register c without modifying bit 7
   */
  sra_c(){
    this._sra_r(this._set_c, this.c);
    this._m++;
  }

  /**
   * Shift right register d without modifying bit 7
   */
  sra_d(){
    this._sra_r(this._set_d, this.d);
    this._m++;
  }

  /**
   * Shift right register e without modifying bit 7
   */
  sra_e(){
    this._sra_r(this._set_e, this.e);
    this._m++;
  }

  /**
   * Shift right register h without modifying bit 7
   */
  sra_h(){
    this._sra_r(this._set_h, this.h);
    this._m++;
  }

  /**
   * Shift right register l without modifying bit 7
   */
  sra_l(){
    this._sra_r(this._set_l, this.l);
    this._m++;
  }

  /**
   * Shift right value at memory location hl without modifying bit 7
   */
  sra_0xhl(){
    this._sra_r(this._ld_0xhl_n, this.$hl);
    this._m++;
  }

  /**
   * Shifts right the value at memory location hl
   */
  srl_0xhl(){
    this.rr_0xhl(0);
  }

  /**
   * Shifts register r right
   * @param {function} setter
   * @param {function} getter
   * @private
   */
  _srl_r(setter, getter){
    this._rr_r(setter, getter, 0);
    this._m++;
  }

  /**
   * Shifts register a right
   */
  srl_a(){
    this._srl_r(this._set_a, this.a);
  }

  /**
   * Shifts register b right
   */
  srl_b(){
    this._srl_r(this._set_b, this.b);
  }

  /**
   * Shifts register c right
   */
  srl_c(){
    this._srl_r(this._set_c, this.c);
  }

  /**
   * Shifts register d right
   */
  srl_d(){
    this._srl_r(this._set_d, this.d);
  }

  /**
   * Shifts register e right
   */
  srl_e(){
    this._srl_r(this._set_e, this.e);
  }

  /**
   * Shifts register h right
   */
  srl_h(){
    this._srl_r(this._set_h, this.h);
  }

  /**
   * Shifts register l right
   */
  srl_l(){
    this._srl_r(this._set_l, this.l);
  }

  /**
   * Rotates left a with copy to carry
   */
  rlca(){
    this._rlc_r(this._set_a, this.a);
  }

  /**
   * Rotates left a with copy to carry
   */
  rlc_a(){
    this.rlca();
    this._m++;
  }

  /**
   * Rotates left b with copy to carry
   */
  rlc_b(){
    this._rlc_r(this._set_b, this.b);
    this._m++;
  }

  /**
   * Rotates left c with copy to carry
   */
  rlc_c(){
    this._rlc_r(this._set_c, this.c);
    this._m++;
  }

  /**
   * Rotates left d with copy to carry
   */
  rlc_d(){
    this._rlc_r(this._set_d, this.d);
    this._m++;
  }

  /**
   * Rotates left e with copy to carry
   */
  rlc_e(){
    this._rlc_r(this._set_e, this.e);
    this._m++;
  }

  /**
   * Rotates left h with copy to carry
   */
  rlc_h(){
    this._rlc_r(this._set_h, this.h);
    this._m++;
  }

  /**
   * Rotates left l with copy to carry
   */
  rlc_l(){
    this._rlc_r(this._set_l, this.l);
    this._m++;
  }

  /**
   * Rotates left the value at memory location hl with copy to carry
   */
  rlc_0xhl(){
    this._rlc_r(this._ld_0xhl_n, this._0xhl);
  }

  /**
   * Rotates left register with copy to carry
   * @param {function} setter
   * @param {function} getter
   * @private
   */
  _rlc_r(setter, getter){
    let value = getter.call(this);
    const rotated = (value << 1);
    const carry = (rotated & 0x100) >> 8;
    value = (rotated & 0xff) + carry;
    setter.call(this, value);

    this.setC(carry);

    if (value === 0){
      this.setZ(1);
    } else {
      this.setZ(0);
    }

    this.setN(0);
    this.setH(0);
    this._m++;
  }

  /**
   * Rotates right r with copy to carry
   * @param {function} setter
   * @param {function} getter
   * @private
   */
  _rrc_r(setter, getter){
    let value = getter.call(this);

    const carried = value & 0x01;
    const rotated = (value >> 1) + (carried << 7);
    setter.call(this, rotated);

    this.setC(carried);

    if (value === 0){
      this.setZ(1);
    } else {
      this.setZ(0);
    }

    this.setN(0);
    this.setH(0);
    this._m++;
  }

  /**
   * Rotates right register a with copy to carry
   */
  rrca(){
    this._rrc_r(this._set_a, this.a);
  }

  /**
   * Rotates right register a with copy to carry
   */
  rrc_a(){
    this.rrca();
    this._m++;
  }

  /**
   * Rotates right register b with copy to carry
   */
  rrc_b(){
    this._rrc_r(this._set_b, this.b);
    this._m++;
  }

  /**
   * Rotates right register c with copy to carry
   */
  rrc_c(){
    this._rrc_r(this._set_c, this.c);
    this._m++;
  }

  /**
   * Rotates right register d with copy to carry
   */
  rrc_d(){
    this._rrc_r(this._set_d, this.d);
    this._m++;
  }

  /**
   * Rotates right register e with copy to carry
   */
  rrc_e(){
    this._rrc_r(this._set_e, this.e);
    this._m++;
  }

  /**
   * Rotates right register h with copy to carry
   */
  rrc_h(){
    this._rrc_r(this._set_h, this.h);
    this._m++;
  }

  /**
   * Rotates right register l with copy to carry
   */
  rrc_l(){
    this._rrc_r(this._set_l, this.l);
    this._m++;
  }

  /**
   * Rotates right value at memory location hl with copy to carry
   */
  rrc_0xhl(){
    this._rrc_r(this._ld_0xhl_n, this._0xhl);
  }

  /**
   * Adds register a and carry to register a
   */
  adc_a(){
    this._adc_r(this._r.a);
  }

  /**
   * Adds register b and carry to register a
   */
  adc_b(){
    this._adc_r(this._r.b);
  }

  /**
   * Adds register c and carry to register a
   */
  adc_c(){
    this._adc_r(this._r.c);
  }

  /**
   * Adds register d and carry to register a
   */
  adc_d(){
    this._adc_r(this._r.d);
  }

  /**
   * Adds register e and carry to register a
   */
  adc_e(){
    this._adc_r(this._r.e);
  }

  /**
   * Adds register h and carry to register a
   */
  adc_h(){
    this._adc_r(this._r.h);
  }

  /**
   * Adds register l and carry to register a
   */
  adc_l(){
    this._adc_r(this._r.l);
  }

  /**
   * Adds value at memory hl plus carry to a
   */
  adc_0xhl(){
    this._adc_r(this._0xhl());
  }

  /**
   * Adds byte n and carry to register a
   * @param {number} n
   */
  adc_n(n){
    this._adc_r(n);
    this._m++;
  }

  /**
   * Adds register r and carry to register a
   * @param r
   * @private
   */
  _adc_r(r){
    this._add_r(r, this.C());
  }

  /**
   * Decimal Adjust to register a
   */
  daa(){
    if ( (this._r.a & 0x0f) > 9 || this.H()){
      if (this.N() === 1){
        this._r.a -= 0x06;
      } else {
        this._r.a += 0x06;
      }
    }
    if ((this._r.a >> 4) > 9 || this.C()){
      if (this.N() === 1){
        this._r.a -= 0x60;
      } else {
        this._r.a += 0x60;
      }
      this.setC(1);
    } else {
      this.setC(0);
    }
    this._r.a &= 0xff;

    if (this._r.a === 0){
      this.setZ(1);
    } else {
      this.setZ(0);
    }
    this.setH(0);
    this._m++;
  }

  /**
   * Halt
   */
  halt(){
    this._halt = true;
    this._m++;
  }

  /**
   * @returns {boolean}
   */
  isHalted(){
    return this._halt;
  }

  /**
   * Stops CPU and LCD
   */
  stop(){
    this._stop = true;
    this._m++;
  }

  /**
   * @returns {boolean}
   */
  isStopped(){
    return this._stop;
  }

  /**
   * Writes the LSB of stack pointer into address nn, MSB into nn+1
   * @param nn
   */
  ld_nn_sp(nn){
    this.mmu.writeByteAt(nn++, Utils.lsb(this.sp()));
    this.mmu.writeByteAt(nn, Utils.msb(this.sp()));
    this._m += 5;
  }

  /**
   * Loads the stack pointer plus a signed int into hl
   * @param n [-128,127]
   */
  ldhl_sp_n(n){
    let value = this.sp() + Utils.uint8ToInt8(n);

    this.setZ(0);
    this.setN(0);
    if (Math.abs((this.sp() & 0xf000) - (value & 0xf000)) > 0x0fff){
      this.setH(1);
    } else {
      this.setH(0);
    }
    if (value > 0xffff){
      this.setC(1);
    } else {
      this.setC(0);
    }
    this.ld_hl_nn(value & 0xffff);
  }

  pressA(){
    this._handle_input();
    this.mmu.pressA();
  }

  pressB(){
    this._handle_input();
    this.mmu.pressB();
  }

  pressSTART(){
    this._handle_input();
    this.mmu.pressSTART();
  }

  pressSELECT(){
    this._handle_input();
    this.mmu.pressSELECT();
  }

  pressUp(){
    this._handle_input();
    this.mmu.pressUp();
  }

  pressDown(){
    this._handle_input();
    this.mmu.pressDown();
  }

  pressLeft(){
    this._handle_input();
    this.mmu.pressLeft();
  }

  pressRight(){
    this._handle_input();
    this.mmu.pressRight();
  }

  /**
   * Handles action upon input
   * @private
   */
  _handle_input(){
    this._stop = false;
  }
}