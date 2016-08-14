import fs from 'fs';
import Utils from './Utils';
import Logger from './logger';

export default class CPU {

  constructor(filename) {
    if (filename == null) {
      throw new Error('Missing ROM filename');
    }
    this.rom = this._load(filename);

    if (!this.rom) return;

    // Addresses
    this.ADDR_GAME_START = 0x100;
    this.ADDR_NINTENDO_GRAPHIC_START = 0x104;
    this.ADDR_NINTENDO_GRAPHIC_END = 0x133;
    this.ADDR_TITLE_START = 0x134;
    this.ADDR_TITLE_END = 0x142;
    this.ADDR_IS_GB_COLOR = 0x143;
    this.ADDR_IS_SGB = 0x146;
    this.ADDR_CARTRIDGE_TYPE = 0x147;
    this.ADDR_ROM_SIZE = 0x148;
    this.ADDR_RAM_SIZE = 0x149;
    this.ADDR_DESTINATION_CODE = 0x14a;
    this.ADDR_COMPLEMENT_CHECK = 0x14d;
    this.ADDR_ROM_MAX = 0x7fff;
    this.ADDR_MAX = 0xffff;

    // Values
    this.IS_GB_COLOR = 0x80;

    // Cartridge types
    this.ROM_ONLY = 0;
    // TODO add rest of types

    // Rom sizes
    this._32KB = 0x0;
    this._64KB = 0x1;
    this._128KB = 0x2;
    this._256KB = 0x3;
    this._512KB = 0x4;
    this._1MB = 0x5;
    this._1_1MB = 0x52;
    this._1_2MB = 0x53;
    this._1_5MB = 0x54;
    this._2MB = 0x6;

    // RAM Size
    this.RAM_NONE = 0x0;
    this.RAM_2KB = 0x1;
    this.RAM_8KB = 0x2;
    this.RAM_32KB = 0x3;
    this.RAM_128KB = 0x4;

    // Destination codes
    this.JAPANESE = 0x0;
    this.NON_JAPANESE = 0x1;

    this._r = {
      pc: this.ADDR_GAME_START,
      sp: this.ADDR_MAX - 1,
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
      0xc3: {fn: this.jp, param: 2},
      0xaf: {fn: this.xor_a, param: 0},
      0xa8: {fn: this.xor_b, param: 0},
      0xa9: {fn: this.xor_c, param: 0},
      0xaa: {fn: this.xor_d, param: 0},
      0xab: {fn: this.xor_e, param: 0},
      0xac: {fn: this.xor_h, param: 0},
      0xad: {fn: this.xor_l, param: 0},
      0xae: {fn: this.xor_hl, param: 0},
      0xee: {fn: this.xor_n, param: 1},
      0x01: {fn: this.ld_bc_nn, param: 2},
      0x11: {fn: this.ld_de_nn, param: 2},
      0x21: {fn: this.ld_hl_nn, param: 2},
      0x31: {fn: this.ld_sp_nn, param: 2},
      0x06: {fn: this.ld_b_n, param: 1},
      0x0e: {fn: this.ld_c_n, param: 1},
      0x16: {fn: this.ld_d_n, param: 1},
      0x1e: {fn: this.ld_e_n, param: 1},
      0x26: {fn: this.ld_h_n, param: 1},
      0x2e: {fn: this.ld_l_n, param: 1},
      0x7f: {fn: this.ld_a_a, param: 0},
      0x78: {fn: this.ld_a_b, param: 0},
      0x79: {fn: this.ld_a_c, param: 0},
      0x7a: {fn: this.ld_a_d, param: 0},
      0x7b: {fn: this.ld_a_e, param: 0},
      0x7c: {fn: this.ld_a_h, param: 0},
      0x7d: {fn: this.ld_a_l, param: 0},
      0x0a: {fn: this.ld_a_bc, param: 0},
      0x1a: {fn: this.ld_a_de, param: 0},
      0x7e: {fn: this.ld_a_hl, param: 0},
      0xfa: {fn: this.ld_a_nn, param: 2},
      0x3e: {fn: this.ld_a_n, param: 1},
      0x0b: {fn: this.dec_bc, param: 0},
      0x1b: {fn: this.dec_de, param: 0},
      0x2b: {fn: this.dec_hl, param: 0},
      0x3b: {fn: this.dec_sp, param: 0},
      0x3a: {fn: this.ldd_hl_a, param: 0}
    };

    this.memory = new Buffer(this.ADDR_MAX + 1);
    this._initMemory();
  }

  /**
   * @param filename
   * @private
   */
  _load(filename){
    try {
      return fs.readFileSync(filename);
    } catch (e){
      throw new Error('ROM was not found.');
    }
  }

  /**
   * @private
   */
  _initMemory() {
    this.memory.fill(0); // Buffers are created with random data

    this.memory[0xff05] = 0x00;
    this.memory[0xff06] = 0x00;
    this.memory[0xff07] = 0x00;
    this.memory[0xff10] = 0x80;
    this.memory[0xff11] = 0xbf;
    this.memory[0xff12] = 0xf3;
    this.memory[0xff14] = 0xbf;
    this.memory[0xff16] = 0x3f;
    this.memory[0xff17] = 0x00;
    this.memory[0xff19] = 0xbf;
    this.memory[0xff1a] = 0x7f;
    this.memory[0xff1b] = 0xff;
    this.memory[0xff1c] = 0x9f;
    this.memory[0xff1e] = 0xbf;
    this.memory[0xff20] = 0xff;
    this.memory[0xff21] = 0x00;
    this.memory[0xff22] = 0x00;
    this.memory[0xff23] = 0xbf;
    this.memory[0xff24] = 0x77;
    this.memory[0xff25] = 0xf3;
    this.memory[0xff26] = 0xf1;
    this.memory[0xff40] = 0x91;
    this.memory[0xff42] = 0x00;
    this.memory[0xff43] = 0x00;
    this.memory[0xff45] = 0x00;
    this.memory[0xff47] = 0xfc;
    this.memory[0xff48] = 0xff;
    this.memory[0xff49] = 0xff;
    this.memory[0xff4a] = 0x00;
    this.memory[0xff4b] = 0x00;
    this.memory[0xffff] = 0x00;
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
    return this._r.a;
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

  /** @return {string} game title */
  getGameTitle(){
    var title = this.rom.slice(this.ADDR_TITLE_START, this.ADDR_TITLE_END);
    var length = 0;
    while(title[length] != 0){
      length++;
    }
    return title.toString('ascii', 0, length);
  }

  /** @return {boolean} true if game is in color */
  isGameInColor() {
    return this.romByteAt(this.ADDR_IS_GB_COLOR) === this.IS_GB_COLOR;
  }

  /** @param {number} address
      @return {number} byte value */
  romByteAt(address) {
    if (address > this.ADDR_ROM_MAX || address < 0){
      throw new Error(`Cannot read ROM address ${Utils.hexStr(address)}`);
    }
    return this.rom[address];
  }

  /**
   * @param {number} start
   * @param {number} end
   * @returns {any}
   */
  romBufferAt(addr_start, addr_end){
    if (addr_start > this.ADDR_ROM_MAX || addr_start < 0 ||
      addr_end < addr_start || addr_end > this.ADDR_ROM_MAX){
      throw new Error(`Cannot read ROM Buffer ${Utils.hexStr(addr_start)} to ${Utils.hexStr(addr_end)}`);
    }
    return this.rom.slice(addr_start, addr_end);
  }

  /**
   * @returns {boolean} true if ROM is for Super Game Boy
   */
  isGameSuperGB() {
    return this.romByteAt(this.ADDR_IS_SGB);
  }

  /**
   * @returns {string} cartridge type
   */
  getCartridgeType() {
    switch(this.romByteAt(this.ADDR_CARTRIDGE_TYPE)){
      case this.ROM_ONLY:
        return 'ROM ONLY';
      default:
        throw new Error('Cartridge type unknown');
    }
  }

  /**
   * @returns {string} ROM size
   */
  getRomSize() {
    switch(this.romByteAt(this.ADDR_ROM_SIZE)){
      case this._32KB: return '32KB';
      case this._64KB: return '64KB';
      case this._128KB: return '128KB';
      case this._256KB: return '256KB';
      case this._512KB: return '512KB';
      case this._1MB: return '1MB';
      case this._1_1MB: return '1.1MB';
      case this._1_2MB: return '1.2MB';
      case this._1_5MB: return '1.5MB';
      case this._2MB: return '2MB';
      default:
        throw new Error('Rom size unknown');
    }
  }

  /**
   * @returns {string} RAM size
   */
  getRAMSize() {
    switch(this.romByteAt(this.ADDR_RAM_SIZE)){
      case this.RAM_NONE: return 'None';
      case this.RAM_2KB: return '2KB';
      case this.RAM_8KB: return '8KB';
      case this.RAM_32KB: return '32KB';
      case this.RAM_128KB: return '128KB';
      default:
        throw new Error('RAM size unknown');
    }
  }

  /**
   * @returns {string} destination code
   */
  getDestinationCode() {

    if (this.romByteAt(this.ADDR_DESTINATION_CODE) === this.JAPANESE){
      return 'Japanese';
    } else if (this.romByteAt(this.ADDR_DESTINATION_CODE) === this.NON_JAPANESE){
      return 'Non-Japanese';
    } else {
      throw new Error('Destination code unknown');
    }

  }

  /**
   * @returns {number|any} Buffer with nintendo graphic
   */
  getNintendoGraphicBuffer() {
    return this.romBufferAt(this.ADDR_NINTENDO_GRAPHIC_START,
      this.ADDR_NINTENDO_GRAPHIC_END + 1);
  }

  /**
   * Computes ROM checksum and verifies if correct.
   *
   * Checksum is computed by summing all bytes in the cartridge
   * from 0x134 to 0x14d plus 25. Checksum is correct if the least
   * significant byte is 0x00.
   *
   * @return {boolean} true if checksum is correct.
   */
  isChecksumCorrect() {
    let addr = this.ADDR_TITLE_START;
    let count = 0;
    while(addr <= this.ADDR_COMPLEMENT_CHECK){
      count += this.romByteAt(addr);
      addr++;
    }
    return (count + 25 & 0xff) === 0;
  }

  /**
   * @return {number} next opcode
   */
  nextCommand() {
    return this.byteAt(this._r.pc);
  }

  /**
   * @param {number} addr
   * @return {number} opcode
   */
  byteAt(addr) {

    if (addr > this.ADDR_MAX || addr < 0){
      throw new Error(`Cannot read memory address ${Utils.hexStr(addr)}`);
    }

    if (addr <= this.ADDR_ROM_MAX){
      return this.romByteAt(addr);
    }
    return this.memory[addr];
  }

  /**
   *
   * @param addr
   * @param n
   */
  writeByteAt(addr, n){
    if (addr > this.ADDR_MAX || addr < 0 || addr <= this.ADDR_ROM_MAX){
      throw new Error(`Cannot set memory address ${Utils.hexStr(addr)}`);
    }
    if (n < 0 || n > 0xff){
      throw new Error(`Cannot write ${n} in memory, it has more than 8 bits`);
    }
    this.memory[addr] = n;
  }

  /**
   * Executes the next command and increases the pc.
   */
  execute() {

    const command = this.getCommand(this.nextCommand());
    const numBytes = command.param;

    let param;
    if(numBytes > 0){
      param = this.byteAt(++this._r.pc);
      if (numBytes > 1){
        param += this.byteAt(++this._r.pc) << 8;
      }
    }

    if(command.fn === this.jp){
      command.fn.call(this, param);
      return;
    }

    command.fn.call(this, param);
    this._r.pc++;
  }

  /**
   * Jumps to address
   * @param {number} 16 bits
   */
  jp(nn){
    Logger.instr(this._r.pc - 2, `jp ${Utils.hexStr(nn)}`);
    this._r.pc = nn;
  }

  /**
   * Does nothing
   */
  nop(){
    Logger.instr(this._r.pc, 'nop');
  }

  xor_a(){
    Logger.instr(this._r.pc, `xor a`);
    this._xor(this._r.a);
  }

  xor_b(){
    Logger.instr(this._r.pc, `xor b`);
    this._xor(this._r.b);
  }

  xor_c(){
    Logger.instr(this._r.pc, `xor c`);
    this._xor(this._r.c);
  }

  xor_d(){
    Logger.instr(this._r.pc, `xor d`);
    this._xor(this._r.d);
  }

  xor_e(){
    Logger.instr(this._r.pc, `xor e`);
    this._xor(this._r.e);
  }

  xor_h(){
    Logger.instr(this._r.pc, `xor h`);
    this._xor(this._r.h);
  }

  xor_l(){
    Logger.instr(this._r.pc, `xor l`);
    this._xor(this._r.l);
  }

  xor_hl(){
    Logger.instr(this._r.pc, `xor (hl)`);
    this._xor(this.byteAt(this.hl()));
  }

  xor_n(n){
    Logger.instr(this._r.pc, `xor ${Utils.hexStr(n)}`);
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
    Logger.instr(this._r.pc - 2, `ld bc,${Utils.hexStr(nn)}`);
    this._ld_rr_nn('b', 'c', nn);
  }

  /**
   * Loads 16 bits nn into de.
   * @param {number} 16 bits
   */
  ld_de_nn(nn) {
    Logger.instr(this._r.pc - 2, `ld de,${Utils.hexStr(nn)}`);
    this._ld_rr_nn('d', 'e', nn);
  }

  /**
   * Loads 16 bits nn into hl.
   * @param {number} 16 bits
   */
  ld_hl_nn(nn) {
    Logger.instr(this._r.pc - 2, `ld hl,${Utils.hexStr(nn)}`);
    this._ld_rr_nn('h', 'l', nn);
  }

  /**
   * Loads 16 bits nn into sp.
   * @param {number} 16 bits
   */
  ld_sp_nn(nn) {
    Logger.instr(this._r.pc - 2, `ld sp,${Utils.hexStr(nn)}`);
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
    Logger.instr(this._r.pc - 1, `ld b,${Utils.hexStr(n)}`);
    this._ld_r_n('b', n);
  }

  /**
   * Loads 8 bits into c
   * @param n
   */
  ld_c_n(n){
    Logger.instr(this._r.pc - 1, `ld c,${Utils.hexStr(n)}`);
    this._ld_r_n('c', n);
  }

  /**
   * Loads 8 bits into d
   * @param n
   */
  ld_d_n(n){
    Logger.instr(this._r.pc - 1, `ld d,${Utils.hexStr(n)}`);
    this._ld_r_n('d', n);
  }

  /**
   * Loads 8 bits into e
   * @param n
   */
  ld_e_n(n){
    Logger.instr(this._r.pc - 1, `ld e,${Utils.hexStr(n)}`);
    this._ld_r_n('e', n);
  }

  /**
   * Loads 8 bits into h
   * @param n
   */
  ld_h_n(n){
    Logger.instr(this._r.pc - 1, `ld h,${Utils.hexStr(n)}`);
    this._ld_r_n('h', n);
  }

  /**
   * Loads 8 bits into l
   * @param n
   */
  ld_l_n(n){
    Logger.instr(this._r.pc - 1, `ld l,${Utils.hexStr(n)}`);
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
    Logger.instr(this._r.pc, 'ld a,a');
    this.ld_a_n(this._r.a);
  }

  /**
   * Loads register b into a.
   */
  ld_a_b(){
    Logger.instr(this._r.pc, `ld a,b`);
    this.ld_a_n(this._r.b);
  }

  /**
   * Loads register c into a.
   */
  ld_a_c(){
    Logger.instr(this._r.pc, `ld a,c`);
    this.ld_a_n(this._r.c);
  }

  /**
   * Loads register a into d.
   */
  ld_a_d(){
    Logger.instr(this._r.pc, `ld a,d`);
    this.ld_a_n(this._r.d);
  }

  /**
   * Loads register e into a.
   */
  ld_a_e(){
    Logger.instr(this._r.pc, `ld a,e`);
    this.ld_a_n(this._r.e);
  }

  /**
   * Loads register h into a.
   */
  ld_a_h(){
    Logger.instr(this._r.pc, `ld a,h`);
    this.ld_a_n(this._r.h);
  }

  /**
   * Loads register l into a.
   */
  ld_a_l(){
    Logger.instr(this._r.pc, `ld a,l`);
    this.ld_a_n(this._r.l);
  }

  /**
   * Loads address memory of bc into a.
   */
  ld_a_bc(){
    Logger.instr(this._r.pc, `ld a,[${Utils.hexStr(this.bc())}]`);
    this.ld_a_n(this.byteAt(this.bc()));
  }

  /**
   * Loads address memory of de into a.
   */
  ld_a_de(){
    Logger.instr(this._r.pc, `ld a,[${Utils.hexStr(this.de())}]`);
    this.ld_a_n(this.byteAt(this.de()));
  }

  /**
   * Loads address memory of hl into a.
   */
  ld_a_hl(){
    Logger.instr(this._r.pc, `ld a,[${Utils.hexStr(this.hl())}]`);
    this.ld_a_n(this.byteAt(this.hl()));
  }

  /**
   * Loads address memory of nn into a.
   */
  ld_a_nn(nn){
    Logger.instr(this._r.pc, `ld a,${Utils.hexStr(nn)}`);
    this.ld_a_n(this.byteAt(nn));
  }

  /**
   * Loads 8 bits into register a.
   * @param n
   */
  ld_a_n(n){
    Logger.instr(this._r.pc, `ld a,${Utils.hexStr(n)}`);
    this._r.a = n;
  }

  /**
   * Loads a with value at address hl. Decrements hl.
   */
  ldd_a_hl(){
    Logger.instr(this._r.pc, 'ldd a,[hl]');
    this._r.a = this.byteAt(this.hl());
    this.dec_hl();
  }

  /**
   * Decrements bc by 1.
   */
  dec_bc(){
    Logger.instr(this._r.pc, 'dec bc');
    this._dec_rr('b', 'c');
  }

  /**
   * Decrements de by 1.
   */
  dec_de(){
    Logger.instr(this._r.pc, 'dec de');
    this._dec_rr('d', 'e');
  }

  /**
   * Decrements hl by 1.
   */
  dec_hl(){
    Logger.instr(this._r.pc, 'dec hl');
    this._dec_rr('h', 'l');
  }

  /**
   * Decrements sp by 1.
   */
  dec_sp(){
    Logger.instr(this._r.pc, 'dec sp');
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
}