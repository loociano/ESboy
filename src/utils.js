export default class Utils {

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
   * @param {integer} number
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
   * @param unsigned number 8 bits
   * @returns signed number 8 bits
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
}