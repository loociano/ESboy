import fs from 'fs';
import Logger from './logger';

export default class Loader {

  constructor(){
    this.rom = null;
  }

  load(filename){
    try {
      this.rom = fs.readFileSync(filename);
    } catch (e){
      Logger.error('File not found');
    }
  }
}