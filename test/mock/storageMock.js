export default class StorageMock {
  constructor(){
    this._memory = {};
  }
  write(gameTitle, memory){
    this._memory[gameTitle] = memory;
  }
  read(gameTitle){
    return this._memory[gameTitle];
  }
}