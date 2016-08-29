export default class MMUMock {

  constructor(){
    this._ly = 0;
  }

  ly(){
    return this._ly;
  }

  setLy(line){
    this._ly = line;
  }

  lcdc(){
    return 0x90;
  }
  
}