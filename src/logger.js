import config from './config';
import Utils from './utils';

export default class Logger {

  static state(cpu, fn, paramLength, param){
    if (!config.TEST) {
      console.info(`[${Utils.hex4(cpu.pc() - paramLength - 1)}] ${fn.name} ${Utils.hexStr(param)} af:${Utils.hex4(cpu.af())} bc:${Utils.hex4(cpu.bc())} de:${Utils.hex4(cpu.de())} hl:${Utils.hex4(cpu.hl())} sp:${Utils.hex4(cpu.sp())} pc:${Utils.hex4(cpu.pc())}`);
    }
  }

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