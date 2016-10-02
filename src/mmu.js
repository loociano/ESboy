import fs from 'fs';
import Logger from './logger';
import Utils from './utils';

export default class MMU {

  /**
   * @param {Uint8Array} rom
   */
  constructor(rom){

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

    // VRAM
    this.ADDR_VRAM_START = 0x8000;
    this.ADDR_OBJ_DATA_START = 0x8000;
    this.BG_CHAR_DATA_8000 = 0x8000;
    this.BG_CHAR_DATA_8800 = 0x8800;
    this.BG_CHAR_DATA_9000 = 0x9000;
    this.BG_DISPLAY_DATA_1 = 0x9800;
    this.BG_DISPLAY_DATA_2 = 0x9c00;
    this.ADDR_VRAM_END = 0x9fff;

    // Working RAM
    this.ADDR_WRAM_START = 0xc000;

    // OAM
    this.ADDR_OAM_START = 0xfe00;
    this.ADDR_OAM_END = 0xfe9f;

    // IO
    this.ADDR_P1 = 0xff00;
    this.ADDR_SB = 0xff01;
    this.ADDR_SC = 0xff02;
    this.ADDR_DIV = 0xff04;
    this.ADDR_TIMA = 0xff05;
    this.ADDR_TMA = 0xff06;
    this.ADDR_TAC = 0xff07;
    this.ADDR_IF = 0xff0f;
    this.ADDR_LCDC = 0xff40;
    this.ADDR_STAT = 0xff41;
    this.ADDR_LY = 0xff44;
    this.ADDR_DMA = 0xff46;
    this.ADDR_BGP = 0xff47;
    this.ADDR_OBG0 = 0xff48;
    this.ADDR_OBG1 = 0xff49;
    this.ADDR_KEY1 = 0xff4d;
    this.ADDR_VBK = 0xff4f;
    this.ADDR_SVBK = 0xff70;
    this.ADDR_IE = 0xffff;
    this.ADDR_MAX = 0xffff;

    // LCDC
    this.LCDC_ON = 0x80;
    this.LCDC_WINDOW = 0x20;
    this.LCDC_OBJ = 0x02;
    this.LCDC_BG = 0x01;
    this.LCDC_LINE_VBLANK = 0x90; // 114

    // P1 masks
    this.MASK_P1_RW = 0xcf;
    this.MASK_P14 = 0x20;
    this.MASK_P10_P13 = 0xf0;
    this.MASK_P1_RIGHT_ON = this.MASK_P1_A_ON = 0xfe;
    this.MASK_P1_LEFT_ON = this.MASK_P1_B_ON = 0xfd;
    this.MASK_P1_UP_ON = this.MASK_P1_SELECT_ON = 0xfb;
    this.MASK_P1_DOWN_ON = this.MASK_P1_START_ON = 0xf7;
    this.MASK_P1_RIGHT_OFF = this.MASK_P1_A_OFF = 0x01;
    this.MASK_P1_LEFT_OFF = this.MASK_P1_B_OFF = 0x02;
    this.MASK_P1_UP_OFF = this.MASK_P1_SELECT_OFF = 0x04;
    this.MASK_P1_DOWN_OFF = this.MASK_P1_START_OFF = 0x08;

    // LCDC masks
    this.MASK_BG_CHAR_DATA = 0x10;
    this.MASK_WINDOW_ON = 0x20;
    this.MASK_OBJ_ON = 0x02;
    this.MASK_OBJ_OFF = 0xfd;
    this.MASK_OBJ_8x16 = 0x04;
    this.MASK_BG_ON = 0x01;
    this.MASK_BG_OFF = 0xfe;

    this.MASK_BG_CHAR_DATA_8000 = 0x10;
    this.MASK_BG_CHAR_DATA_8800 = 0xef;
    this.MASK_BG_CODE_AREA_1 = 0xf7;
    this.MASK_BG_CODE_AREA_2 = 0x08;

    this.MASK_STAT_MODE = 0x03;

    this.MASK_OBJ_ATTR_PRIORITY = 0x80;
    this.MASK_OBJ_ATTR_HFLIP = 0x20;
    this.MASK_OBJ_ATTR_OBG = 0x10;

    // Character Data
    this.CHAR_SIZE = 0x10; // 0x00 to 0x0f

    // LCD
    this.NUM_LINES = 153;
    this.CHARS_PER_LINE = 32;

    // OBJ
    this.MAX_OBJ = 40;

    // DMA
    this.DMA_LENGTH = 0xa0;

    // Values
    this.IS_GB_COLOR = 0x80;

    // Cartridge types
    this._ROM_ONLY = 0;
    this._ROM_MBC1 = 1;
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

    this._memory = new Uint8Array(this.ADDR_MAX + 1);
    this._bios = this.getBIOS();

    this.inBIOS = true;
    this._isDMA = false;
    this._buttons = 0x0f; // Buttons unpressed, on HIGH

    this._VRAMRefreshed = true;
    this._LCDCUpdated = false;

    this._div = 0x0000; // Internal divider, register DIV is msb

    this._initMemory();
    this._loadROM(rom);
  }

  /**
   * @param {Uint8array} rom
   * @private
   */
  _loadROM(rom){
    const memory_start = 0;
    const rom_start = 0;
    const rom_32kb = 0x7fff;

    try {
      this._memory.set(rom.subarray(rom_start, rom_32kb), memory_start);

    } catch (e){
      throw new Error('Could not load ROM into memory');
    }
  }

  /**
   * @private
   */
  _initMemory() {
    this._memory.fill(0); // Buffers are created with random data

    this._memory[this.ADDR_P1] = 0xff;
    this._memory[0xff05] = 0x00;
    this._memory[0xff06] = 0x00;
    this._memory[0xff07] = 0x00;
    this._memory[0xff10] = 0x80;
    this._memory[0xff14] = 0xbf;
    this._memory[0xff16] = 0x3f;
    this._memory[0xff17] = 0x00;
    this._memory[0xff19] = 0xbf;
    this._memory[0xff1a] = 0x7f;
    this._memory[0xff1b] = 0xff;
    this._memory[0xff1c] = 0x9f;
    this._memory[0xff1e] = 0xbf;
    this._memory[0xff20] = 0xff;
    this._memory[0xff21] = 0x00;
    this._memory[0xff22] = 0x00;
    this._memory[0xff23] = 0xbf;

    this._memory[this.ADDR_IF] = 0x00;
    this._memory[this.ADDR_IE] = 0x01;
  }

  /**
   * @returns {Uint8Array} BIOS
   */
  getBIOS(){
    return new Uint8Array([0x31,0xfe,0xff,0xaf,0x21,0xff,0x9f,0x32,0xcb,0x7c,0x20,0xfb,0x21,0x26,0xff,0x0e,0x11,0x3e,0x80,0x32,0xe2,0x0c,0x3e,0xf3,0xe2,0x32,0x3e,0x77,0x77,0x3e,0xfc,0xe0,0x47,0x11,0x04,0x01,0x21,0x10,0x80,0x1a,0xcd,0x95,0x00,0xcd,0x96,0x00,0x13,0x7b,0xfe,0x34,0x20,0xf3,0x11,0xd8,0x00,0x06,0x08,0x1a,0x13,0x22,0x23,0x05,0x20,0xf9,0x3e,0x19,0xea,0x10,0x99,0x21,0x2f,0x99,0x0e,0x0c,0x3d,0x28,0x08,0x32,0x0d,0x20,0xf9,0x2e,0x0f,0x18,0xf3,0x67,0x3e,0x64,0x57,0xe0,0x42,0x3e,0x91,0xe0,0x40,0x04,0x1e,0x02,0x0e,0x0c,0xf0,0x44,0xfe,0x90,0x20,0xfa,0x0d,0x20,0xf7,0x1d,0x20,0xf2,0x0e,0x13,0x24,0x7c,0x1e,0x83,0xfe,0x62,0x28,0x06,0x1e,0xc1,0xfe,0x64,0x20,0x06,0x7b,0xe2,0x0c,0x3e,0x87,0xe2,0xf0,0x42,0x90,0xe0,0x42,0x15,0x20,0xd2,0x05,0x20,0x4f,0x16,0x20,0x18,0xcb,0x4f,0x06,0x04,0xc5,0xcb,0x11,0x17,0xc1,0xcb,0x11,0x17,0x05,0x20,0xf5,0x22,0x23,0x22,0x23,0xc9,0xce,0xed,0x66,0x66,0xcc,0x0d,0x00,0x0b,0x03,0x73,0x00,0x83,0x00,0x0c,0x00,0x0d,0x00,0x08,0x11,0x1f,0x88,0x89,0x00,0x0e,0xdc,0xcc,0x6e,0xe6,0xdd,0xdd,0xd9,0x99,0xbb,0xbb,0x67,0x63,0x6e,0x0e,0xec,0xcc,0xdd,0xdc,0x99,0x9f,0xbb,0xb9,0x33,0x3e,0x3c,0x42,0xb9,0xa5,0xb9,0xa5,0x42,0x3c,0x21,0x04,0x01,0x11,0xa8,0x00,0x1a,0x13,0xbe,0x20,0xfe,0x23,0x7d,0xfe,0x34,0x20,0xf5,0x06,0x19,0x78,0x86,0x23,0x05,0x20,0xfb,0x86,0x20,0xfe,0x3e,0x01,0xe0,0x50]);
  }

  /**
   * @param {number} addr
   * @return {number} byte at memory address
   */
  readByteAt(addr) {

    if (addr > this.ADDR_MAX || addr < 0){
      throw new Error(`Cannot read memory address ${Utils.hexStr(addr)}`);
    }

    switch(addr){
      case this.ADDR_DMA:
      case this.ADDR_SB:
      case this.ADDR_SC:
      case this.ADDR_TIMA:
      case this.ADDR_TMA:
      case this.ADDR_TAC:
      case this.ADDR_SVBK:
      case this.ADDR_KEY1:
        throw new Error('Unsupported');

      case this.ADDR_P1:
        if ((this._memory[addr] & this.MASK_P14) === 0){
          return (this._memory[addr] & this.MASK_P10_P13 | this._buttons);
        }
    }

    if (this._isOAMAddr(addr) && !this._canAccessOAM()){
      throw new Error('Cannot read OAM');
    }
    if (this._isVRAMAddr(addr) && !this._canAccessVRAM()){
      throw new Error('Cannot read VRAM');
    }

    if (addr <= this.ADDR_ROM_MAX){
      if (addr < this.ADDR_GAME_START && this.inBIOS){
        return this._biosByteAt(addr);
      }
      return this.romByteAt(addr);
    }

    return this._memory[addr];
  }

  /**
   * Reads buffer from memory
   * @param {number} addr_start, 16 bits
   * @param {number} addr_end, 16 bits (exclusive)
   */
  readBuffer(addr_start, addr_end){
    return this._memory.slice(addr_start, addr_end);
  }

  /**
   * @param {Uint8Array} buffer
   * @param addr_start
   */
  writeBuffer(buffer, addr_start){
    if (!addr_start) throw new Error('Must indicate start address');
    this._memory.set(buffer, addr_start);
  }

  /**
   * @returns {Uint8Array}
   */
  readBIOSBuffer(){
    return this._bios.slice(0, this.ADDR_GAME_START);
  }

  /**
   * Returns the buffer given a tile number
   * Tiles are numbered from 0x00 to 0xff
   * @param tile_number
   * @returns {Uint8Array}
   */
  readBGData(tile_number){
    if (tile_number < 0 || tile_number > 0xff){
      throw new Error(`Cannot read tile ${tile_number}`);
    }

    if ((this.lcdc() & this.LCDC_BG) === 0){
      return this._genEmptyCharBuffer();
    }

    const start_addr = this.getBgCharDataStartAddr(tile_number);
    return this._memory.slice(start_addr, start_addr + this.CHAR_SIZE);
  }

  /**
   * @param tile_number
   * @returns {Uint8Array}
   */
  readOBJData(tile_number){
    if (tile_number < 0 || tile_number > 0xff){
      throw new Error(`OBJ ${tile_number} out of range`);
    }

    if ((this.lcdc() & this.MASK_OBJ_ON) === 0){
      return this._genEmptyCharBuffer();
    }

    const start_addr = this.getOBJCharDataStartAddr(tile_number);
    return this._memory.slice(start_addr, start_addr + this.CHAR_SIZE);
  }

  /**
   * @returns {Uint8Array} generates an char-size, empty buffer
   * @private
   */
  _genEmptyCharBuffer(){
    return new Buffer(this.CHAR_SIZE).fill(0);
  }

  /**
   * @param tile_number
   * @returns {number} address
   */
  getBgCharDataStartAddr(tile_number){
    if (tile_number < 0 || tile_number >> 0xff)
      throw new Error(`BG ${tile_number} out of range`);

    if ((this.lcdc() & this.MASK_BG_CHAR_DATA) === 0){
      let start = this.BG_CHAR_DATA_8000;
      if (tile_number < 0x80) {
        start = this.BG_CHAR_DATA_9000;
      }
      return start + (tile_number << 4);
    } else {
      return this.getOBJCharDataStartAddr(tile_number);
    }
  }

  /**
   * @param tile_number
   * @returns {number} address
   */
  getOBJCharDataStartAddr(tile_number){
    if (tile_number < 0 || tile_number >> 0xff) throw new Error(`OBJ ${tile_number} out of range`);
    return this.ADDR_OBJ_DATA_START + (tile_number << 4);
  }

  /**
   * Returns the char code given the x,y lcd coordinates
   * @param {number} x between 0 and 31
   * @param {number} y between 0 and 31
   * @returns {number}
   */
  getCharCode(grid_x, grid_y){
    if (grid_x < 0 || grid_x > 0x1f || grid_y < 0 || grid_y > 0x1f){
      throw new Error(`Cannot read tile at coord ${grid_x}, ${grid_y}`);
    }
    const addr = this._getBgDisplayDataStartAddr() + grid_x + (grid_y * this.CHARS_PER_LINE);
    return this.readByteAt(addr);
  }

  /**
   * @returns {number} start address of the background display data
   * @private
   */
  _getBgDisplayDataStartAddr(){
    if((this.lcdc() & this.MASK_BG_CODE_AREA_2) === 0){
      return this.BG_DISPLAY_DATA_1;
    } else {
      return this.BG_DISPLAY_DATA_2;
    }
  }

  /**
   * @returns {boolean} true if OBJ are enabled
   */
  areOBJOn(){
    return (this.lcdc() & this.MASK_OBJ_ON) === this.MASK_OBJ_ON;
  }

  /**
   * Writes a byte n into address
   * @param {number} 16 bit address
   * @param {number} byte
   */
  writeByteAt(addr, n){
    if (addr > this.ADDR_MAX || addr < 0 || addr <= this.ADDR_ROM_MAX){
      Logger.warn(`Cannot set memory address ${Utils.hexStr(addr)}`);
      return;
    }
    if (n < 0 || n > 0xff){
      throw new Error(`Cannot write value ${n} in memory`);
    }
    if (this._isOAMAddr(addr)){
      if (!this._canAccessOAM()) throw new Error('Cannot write OAM');
    }
    if (this._isVRAMAddr(addr)){
      if (!this._canAccessVRAM()) throw new Error('Cannot write on VRAM');
      this._VRAMRefreshed = true;
    }

    switch(addr){
      case this.ADDR_P1:
        n = (this._memory[addr] & this.MASK_P1_RW) | n;
        break;
      case this.ADDR_VBK:
        Logger.info(`Cannot write on ${Utils.hex4(addr)}`);
        return;
      case this.ADDR_STAT:
        n |= 0x80; // Bit 7 is always set
        break;
      case this.ADDR_LCDC:
        this._handle_lcdc(n);
        break;
      case this.ADDR_DMA:
        this._handleDMA(n);
        break;
      case this.ADDR_DIV:
        this.set_HW_DIV(0);
        return;
    }
    this._memory[addr] = n;
  }

  /**
   * Hardware mock interface for CPU
   * @param n
   */
  set_HW_DIV(n){
    this._div = (this._div + n) % 0xffff;
    this._memory[this.ADDR_DIV] = Utils.msb(this._div);
  }

  /**
   * @param n
   * @private
   */
  _handleDMA(n){
    if (n <= (this.ADDR_ROM_MAX >> 8)){
      throw new Error('No DMA allowed from ROM area in DMG');
    }
    const sourceStart = n << 8;
    const sourceEnd = sourceStart + this.DMA_LENGTH;

    const source = this.readBuffer(sourceStart, sourceEnd);
    this.writeBuffer(source, this.ADDR_OAM_START);

    this._isDMA = true;
  }

  setDMA(isDMA){
    this._isDMA = isDMA;
  }

  isDMA(){
    return this._isDMA;
  }

  /**
   * @param addr
   * @returns {boolean} true if addr is in OAM range
   * @private
   */
  _isOAMAddr(addr){
    return (addr >= this.ADDR_OAM_START) && (addr <= this.ADDR_OAM_END);
  }

  /**
   * @param addr
   * @returns {boolean} true if addr is in VRAM range
   * @private
   */
  _isVRAMAddr(addr){
    return (addr >= this.ADDR_VRAM_START) && (addr <= this.ADDR_VRAM_END);
  }

  /**
   * @returns {boolean} true OAM is accessible
   * @private
   */
  _canAccessOAM(){
    const mode = this.getLCDMode();
    return !this._isDMA && mode !== 2 && mode !== 3;
  }

  /**
   * @returns {boolean} true if VRAM is accessible
   * @private
   */
  _canAccessVRAM(){
    return this.getLCDMode() !== 3;
  }

  /**
   * @returns {number} LCD Mode: [0,3]
   */
  getLCDMode(){
    return this.stat() & this.MASK_STAT_MODE;
  }

  /**
   * Sets LCD Mode
   * @param {number} mode [0,3]
   */
  setLCDMode(mode){
    if (mode > 3 || mode < 0) return;
    this._memory[this.ADDR_STAT] &= 0xfc;
    this._memory[this.ADDR_STAT] += mode;
  };

  /**
   * Handles updates to LCD Control Register (LCDC)
   * @param n
   * @private
   */
  _handle_lcdc(n){
    switch(n & this.LCDC_ON){
      case 0:
        this._handle_lcd_off();
        break;
    }
    switch(n & this.LCDC_WINDOW){
      case 0:
        break;
      default:
        throw new Error('Windowing unsupported');
    }
    switch(n & this.MASK_OBJ_8x16){
      case 0:
        break;
      default:
        throw new Error('OBJ 8x16 unsupported');
    }
    this._LCDCUpdated = true;
  }

  /**
   * Handles actions when LCD turns off
   * @private
   */
  _handle_lcd_off(){
    this.setLy(0x00);
    this.setLCDMode(0);
  }

  /**
   * Sets value on Interrupt Enable Register
   * @param value
   */
  setIe(value){
    this._memory[this.ADDR_IE] = value;
  }

  /**
   * Reads the interrupt enable register
   * @returns {number}
   */
  ie(){
    return this.readByteAt(this.ADDR_IE);
  }

  /**
   * Sets value on interrupt request register
   * @param value
   */
  setIf(value){
    this._memory[this.ADDR_IF] = value;
  }

  /**
   * Reads the interrupt request register
   * @returns {number}
   */
  If(){
    return this.readByteAt(this.ADDR_IF);
  }

  /**
   * @param {number} address
   * @return {number} byte value
   */
  romByteAt(address) {
    if (address > this.ADDR_ROM_MAX || address < 0){
      throw new Error(`Cannot read ROM address ${Utils.hexStr(address)}`);
    }
    return this._memory[address];
  }

  _biosByteAt(addr){
    if (addr >= this.ADDR_GAME_START || addr < 0){
      throw new Error(`Cannot read bios address ${Utils.hexStr(addr)}`);
    }
    return this._bios[addr];
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
    return this._memory.slice(addr_start, addr_end);
  }

  /** @return {string} game title */
  getGameTitle(){
    const titleArray = this._memory.slice(this.ADDR_TITLE_START, this.ADDR_TITLE_END);

    let title = '';
    let length = 0;
    while(titleArray[length] != 0){
      title += String.fromCharCode(titleArray[length++]);
    }
    return title;
  }

  /** @return {boolean} true if game is in color */
  isGameInColor() {
    return this.romByteAt(this.ADDR_IS_GB_COLOR) === this.IS_GB_COLOR;
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
    const type = this.romByteAt(this.ADDR_CARTRIDGE_TYPE)
    switch(type){
      case this._ROM_ONLY: return 'ROM ONLY';
      case this._ROM_MBC1: return 'ROM+MBC1';
      default:
        throw new Error(`Cartridge type ${type} unknown`);
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
   * Dumps memory to a file
   */
  dumpMemoryToFile(pc){
    const filename = `${Utils.toFsStamp()}_memory_dump_at_${Utils.hex4(pc)}.bin`;
    try {
      fs.writeFileSync(filename, this._memory);
    } catch(e){
      console.error('Problem writing memory dump');
    }
    return filename;
  }

  /**
   * Returns the value of LCD Control register
   * @returns {number}
   */
  lcdc(){
    return this.readByteAt(this.ADDR_LCDC);
  }

  /**
   * LCDC Status Flag
   * @returns {number}
   */
  stat(){
    return this.readByteAt(this.ADDR_STAT);
  }

  /**
   * LCDC Y-Coordinate (read-only)
   * @returns {number}
   */
  ly(){
    return this.readByteAt(this.ADDR_LY);
  }

  /**
   * Sets value at register LY (emulates hardware)
   * @param {number} line
   */
  setLy(line){
    this.writeByteAt(this.ADDR_LY, line);
  }

    /**
   * Increments register LY by 1. Resets after 153.
   */
  incrementLy(){
    let ly = this.ly();
    if (ly >= 153){
      ly = 0;
    } else {
      ly++;
    }
    this.setLy(ly);
  }

  /**
   * Bank register for LCD display RAM.
   * Always zero in DMG.
   */
  vbk(){
    return this.readByteAt(this.ADDR_VBK);
  }

  p1(){
    return this.readByteAt(this.ADDR_P1);
  }

  pressRight(){
    this._memory[this.ADDR_P1] &= this.MASK_P1_RIGHT_ON;
  }

  liftRight(){
    this._memory[this.ADDR_P1] |= this.MASK_P1_RIGHT_OFF;
  }

  pressLeft(){
    this._memory[this.ADDR_P1] &= this.MASK_P1_LEFT_ON;
  }

  liftLeft(){
    this._memory[this.ADDR_P1] |= this.MASK_P1_LEFT_OFF;
  }

  pressUp(){
    this._memory[this.ADDR_P1] &= this.MASK_P1_UP_ON;
  }

  liftUp(){
    this._memory[this.ADDR_P1] |= this.MASK_P1_UP_OFF;
  }

  pressDown(){
    this._memory[this.ADDR_P1] &= this.MASK_P1_DOWN_ON;
  }

  liftDown(){
    this._memory[this.ADDR_P1] |= this.MASK_P1_DOWN_OFF;
  }

  pressA(){
    this._buttons &= this.MASK_P1_A_ON;
  }

  liftA(){
    this._buttons |= this.MASK_P1_A_OFF;
  }

  pressB(){
    this._buttons &= this.MASK_P1_B_ON;
  }

  liftB(){
    this._buttons |= this.MASK_P1_B_OFF;
  }

  pressSELECT(){
    this._buttons &= this.MASK_P1_SELECT_ON;
  }

  liftSELECT(){
    this._buttons |= this.MASK_P1_SELECT_OFF;
  }

  pressSTART(){
    this._buttons &= this.MASK_P1_START_ON;
  }

  liftSTART(){
    this._buttons |= this.MASK_P1_START_OFF;
  }

  /**
   * @param number
   * @returns {{y: number, x: number, chrCode: number, attr: number}}
   */
  getOBJ(number){
    if (number < 0 || number > 39) throw new Error('OBJ number out of range');

    const addr = this.ADDR_OAM_START + (4 * number);
    return {
      y: this.readByteAt(addr),
      x: this.readByteAt(addr + 1),
      chrCode: this.readByteAt(addr + 2),
      attr: this.readByteAt(addr + 3)
    }
  }

  /**
   * @returns {number} BackGround Palette
   */
  bgp() {
    return this.readByteAt(this.ADDR_BGP);
  }

  /**
   * @returns {number} Object Palette 0
   */
  obg0() {
    return this.readByteAt(this.ADDR_OBG0);
  }

  /**
   * @returns {number} Object Palette 1
   */
  obg1() {
    return this.readByteAt(this.ADDR_OBG1);
  }
}