export default class Utils {

  static hexStr(number){
    if (number == null) return '';
    return `0x${number.toString(16)}`;
  }
}