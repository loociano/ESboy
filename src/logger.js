import config from './config';
import Utils from './utils';

export default class Logger {

  static state(cpu, fn, paramLength, param){
    if (config.DEBUG && Logger._logBIOS(cpu)) {
      console.info(`[${Utils.hex4(cpu.pc() - paramLength - 1)}] ${Utils.str20(fn.name + ' ' + Utils.hexStr(param))} Z:${cpu.Z()} N:${cpu.N()} H:${cpu.H()} C:${cpu.C()}  a:${Utils.hex2(cpu.a())} bc:${Utils.hex4(cpu.bc())} de:${Utils.hex4(cpu.de())} hl:${Utils.hex4(cpu.hl())} sp:${Utils.hex4(cpu.sp())} pc:${Utils.hex4(cpu.pc())} if:${Utils.hex2(cpu.If())} ie:${Utils.hex2(cpu.ie())} ly:${Utils.hex2(cpu.mmu.ly())} lcdc:${Utils.hex2(cpu.lcdc())} stat:${Utils.hex2(cpu.stat())}`);
    }
  }

  static _logBIOS(cpu){
    if (!cpu.mmu.inBIOS) {
      return true;
    } else {
      return config.LOG_BIOS;
    }
  }

  static beforeCrash(cpu, instructionFn, paramLength, param){
    config.DEBUG = true;
    Logger.state(cpu, instructionFn, paramLength, param);
    config.DEBUG = false;
  }

  static info(msg){
    if (config.DEBUG) {
      console.info(`<info> ${msg}`);
    }
  }

  static error(msg){
    if (!config.TEST) {
      console.error(`<error> ${msg}`);
    }
  }
}