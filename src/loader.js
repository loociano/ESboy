import fs from 'fs';

export default class Loader {

  constructor(filename){
    this._filename = filename;
    const buffer = fs.readFileSync(filename);
    this._u8array = new Uint8Array(buffer);
  }

  asUint8Array() {
    return this._u8array;
  }
}