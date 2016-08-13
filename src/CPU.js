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

    this.commands = {
      0x00: {fn: this.nop},
      0xc3: {fn: this.jp},
      0xaf: {fn: this.xor, args: [this.A]}
    };

    this.PC = this.ADDR_GAME_START;
    this.SP = this.ADDR_MAX - 1;
    this.A = 0x01;
    this.B = 0x00;
    this.C = 0x13;
    this.D = 0x00;
    this.E = 0xd8;
    this.F = 0xb0;
    this.H = 0x01;
    this.L = 0x4d;

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

  /**
   * @returns {number} Register AF
   */
  AF(){
    return this.A;
  }

  /**
   * @returns {number} Register BC
   */
  BC(){
    return (this.B << 8) + this.C;
  }

  /**
   * @returns {number} Register DE
   */
  DE(){
    return (this.D << 8) + this.E;
  }

  /**
   * @returns {number} Register HL
   */
  HL(){
    return (this.H << 8) + this.L;
  }

  /**
   * Main loop method.
   */
  start(){
    while(true){
      this.execute();
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
      throw new Error(`[${Utils.hexStr(this.PC)}] ${Utils.hexStr(opcode)} opcode not implemented.`);
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
    return this.byteAt(this.PC);
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
   * Executes the next command and increases the PC.
   */
  execute() {

    const command = this.getCommand(this.nextCommand());

    if(command.fn === this.jp){
      const param = this.byteAt(++this.PC) + (this.byteAt(++this.PC) << 8);
      command.fn.call(this, param);
      return;
    }

    command.fn.call(this, command.args);
    this.PC++;
  }

  /**
   * Jumps to address
   * @param {number} 16 bits
   */
  jp(jump_to){
    Logger.info(`JP ${Utils.hexStr(jump_to)}`);
    this.PC = jump_to;
  }

  /**
   * Does nothing
   */
  nop(){
    Logger.info('NOP');
  }

  xor(n){
    this.A ^= n;
  }
}