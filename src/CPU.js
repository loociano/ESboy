export default class CPU {

  constructor(loader) {
    if (loader == null) {
      throw new Error('Missing loader');
    }
    this.loader = loader;
    this.rom = this.loader.rom;

    // Addresses
    this.ADDR_TITLE_START = 0x134;
    this.ADDR_TITLE_END = 0x142;
    this.ADDR_IS_GB_COLOR = 0x143;
    this.ADDR_IS_SGB = 0x146;
    this.ADDR_CARTRIDGE_TYPE = 0x147;
    this.ADDR_ROM_SIZE = 0x148;
    this.ADDR_RAM_SIZE = 0x149;

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
  }


  /** @return {string} game title */
  getGameTitle(){
    var title = this.loader.rom.slice(this.ADDR_TITLE_START, this.ADDR_TITLE_END);
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
    return this.rom[address];
  }

  isGameSuperGB() {
    return this.romByteAt(this.ADDR_IS_SGB);
  }

  getCartridgeType() {
    switch(this.romByteAt(this.ADDR_CARTRIDGE_TYPE)){
      case this.ROM_ONLY:
        return 'ROM ONLY';
      default:
        throw new Error('Cartridge type unknown');
    }
  }

  getRomSize() {
    switch(this.romByteAt(this.ADDR_ROM_SIZE)){
      case this._32KB = 0: return '32KB';
      case this._64KB = 1: return '64KB';
      case this._128KB = 2: return '128KB';
      case this._256KB = 3: return '256KB';
      case this._512KB = 4: return '512KB';
      case this._1MB = 5: return '1MB';
      case this._1_1MB = 0x52: return '1.1MB';
      case this._1_2MB = 0x53: return '1.2MB';
      case this._1_5MB = 0x54: return '1.5MB';
      case this._2MB = 6: return '2MB';
      default:
        throw new Error('Rom size unknown');
    }
  }

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
}