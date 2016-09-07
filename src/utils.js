export default class Utils {

  /**
   * Pads with spaces to fill 20 characters.
   * @param string
   * @returns {string}
   */
  static str20(string){
    return string + ' '.repeat(20 - string.length);
  }

  /**
   * @param number
   * @returns {string} hexadecimal, example: 0xab
   */
  static hexStr(number){
    if (number == null) return '';
    return `0x${number.toString(16)}`;
  }

  /**
   * @param {number} number
   * @returns {string} 4 hex, example: '0x0abc'
   */
  static hex4(number){
    if (number == null) return '0x0000';
    const hex = number.toString(16);

    return `0x${'0'.repeat(4 - hex.length) + hex}`;
  }

  /**
   * @param {number} number
   * @returns {string} 2 hex, example: '0x0abc'
   */
  static hex2(number){
    if (number == null) return '0x00';
    let hex = number.toString(16);
    if (hex.length < 2){
      hex = '0' + hex;
    }
    return `0x${hex}`;
  }

  /**
   * @param {number} number, unsigned 8 bits
   * @returns {number} number, signed 8 bits
   */
  static uint8ToInt8(number){
    if ((number & 0x80) > 0) {
      number -= 0x100;
    }
    return number;
  }

  /**
   * @param word 16 bits
   * @returns {number} least significant 8 bits
   */
  static lsb(word){
    return word & 0x00ff;
  }

  /**
   * @param word 16 bits
   * @returns {number} most significant 8 bits
   */
  static msb(word){
    return (word & 0xff00) >> 8;
  }

  static toBin8(number){
    const binary = number.toString(2);
    return '0'.repeat(8 - binary.length) + binary; // pad
  }

  static toFsStamp(date = new Date()){
    return date.toISOString().replace(/\.|:/g,'-');
  }

  /**
   * Complements bit of a 8 bit number
   * @param number
   * @returns {number}
   */
  static cplBin8(number){
    const binStr = Utils.toBin8(number);
    let complStr = '';
    for(let b = 0; b < binStr.length; b++){
      if (binStr[b] === '1'){
        complStr += '0';
      } else if (binStr[b] === '0') {
        complStr += '1';
      }
    }
    return parseInt(complStr, 2);
  }

  static bitMask(bit){
    if (bit > 7) throw new Error('Bit must be [0,7]');

    let result = 0;
    for(let b = 0; b < 8; b++){
      if (b != bit){
        result |= (1 << b);
      }
    }
    return result;
  }
}