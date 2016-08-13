import config from './config';

export default class Logger {

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