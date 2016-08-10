import fs from 'fs';

export default class Loader {

  constructor(){
    this.rom = null;
  }

  load(filename){
    try {
      this.rom = fs.readFileSync(filename);
    } catch (e){
      console.log('File not found');
    }
  }
}