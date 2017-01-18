export default class BrowserStorage {
  constructor(){}

  read(gameTitle){
    const stringyfiedMemory = window.localStorage.getItem(gameTitle);
    if (stringyfiedMemory == null) return null;
    return new Uint8Array(stringyfiedMemory.split(','));
  }
  write(gameTitle, memory){
    window.localStorage.setItem(gameTitle, memory);
  }
}