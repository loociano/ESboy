import config from './config';
import Utils from './Utils';

export default class Logger {

  /**
   * Logs executing instruction
   * @param PC
   * @param instruction
   */
  static instr(PC, instruction){
    if (!config.TEST) {
      console.info(`[${Utils.hexStr(PC)}] ${instruction}`);
    }
  }

  static info(msg){
    if (!config.TEST) {
      console.info(msg);
    }
  }

  static error(msg){
    if (!config.TEST) {
      console.error(msg);
    }
  }
}