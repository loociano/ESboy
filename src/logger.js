import config from './config';
import Utils from './utils';

export default class Logger {

  /**
   * Logs the current instruction and state of registers
   * @param cpu
   * @param fn
   * @param paramLength
   * @param param
   */
  static state(cpu, fn, paramLength, param){
    if (config.DEBUG) {
      console.info(`[${Utils.hex4(cpu.pc() - paramLength - 1)}] ${Utils.str20(fn.name + ' ' + Utils.hexStr(param))} 0b${cpu.Z()}${cpu.N()}${cpu.H()}${cpu.C()}  a:${Utils.hex2(cpu.a())} bc:${Utils.hex4(cpu.bc())} de:${Utils.hex4(cpu.de())} hl:${Utils.hex4(cpu.hl())} sp:${Utils.hex4(cpu.sp())} pc:${Utils.hex4(cpu.pc())} if:${Utils.hex2(cpu.If())} ie:${Utils.hex2(cpu.ie())} ly:${Utils.hex2(cpu.mmu.ly())} lcdc:${Utils.hex2(cpu.lcdc())} stat:${Utils.hex2(cpu.mmu.stat())}`);
    }
  }

  static beforeCrash(cpu, instructionFn, paramLength, param){
    config.DEBUG = true;
    Logger.state(cpu, instructionFn, paramLength, param);
    config.DEBUG = false;
  }

  static warn(msg){
    if (!config.TEST) {
      console.warn(`${msg}`);
    }
  }

  static info(msg){
    if (config.DEBUG && !config.TEST) {
      console.info(`${msg}`);
    }
  }

  static error(msg){
    if (!config.TEST) {
      console.error(`${msg}`);
    }
  }
}