export default class BrowserStorage {

  /**
   * @param {Object} localStorage implementing getItem, setItem
   */
  constructor(localStorage){
    if (localStorage == null)
      throw new Error('Missing localStorage');

    if (typeof localStorage.getItem !== 'function' || typeof localStorage.setItem !== 'function')
      throw new Error('localStorage must implement getItem(key), setItem(key, value)');

    this._localStorage = localStorage;
  }

  /**
   * @param {number} expectedSize
   */
  setExpectedGameSize(expectedSize){
    this._expectedSize = expectedSize;
  }

  /**
   * @param gameTitle
   * @returns {Uint8Array} saved game
   */
  read(gameTitle){
    const stringyfiedMemory = this._localStorage.getItem(gameTitle);

    if (stringyfiedMemory == null || stringyfiedMemory.length == null )
      return null;

    const array = stringyfiedMemory.split(',');

    if (array.length !== this._expectedSize)
      return null;

    return new Uint8Array(array);
  }

  /**
   * @param {string} gameTitle
   * @param {Uint8Array} memory
   */
  write(gameTitle, memory){
    this._localStorage.setItem(gameTitle, memory);
  }
}