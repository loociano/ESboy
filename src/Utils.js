export default class Utils {

  static hexStr(number){
    if (number == null) return '';
    return `0x${number.toString(16)}`;
  }

  static hex4(number){
    if (number == null) return '0x0000';
    const hex = number.toString(16);
    switch(hex.length){
      case 1: return `0x000${hex}`;
      case 2: return `0x00${hex}`;
      case 3: return `0x0${hex}`;
      case 4: return `0x${hex}`;
    }
  }

  static uint8ToInt8(number){
    if ((number & 0x80) > 0) {
      number -= 0x100;
    }
    return number;
  }
}