export default class CPU {

  constructor(loader){
    if(loader == null){
      throw new Error('Missing loader');
    }
    this.loader = loader;

    // Constants
    this.ADDR_TITLE_START = 0x134;
    this.ADDR_TITLE_END = 0x142;
  }

  getGameTitle(){
    var title = this.loader.rom.slice(this.ADDR_TITLE_START, this.ADDR_TITLE_END);
    var length = 0;
    while(title[length] != 0){
      length++;
    }
    return title.toString('ascii', 0, length);
  }

}