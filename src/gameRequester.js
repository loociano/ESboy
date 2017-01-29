export default class GameRequester {

  constructor(){
    this._games = {
      'load-game': 'roms/load-game.gb',
      'CPU instructions tests': 'roms/blargg/cpu_instrs/cpu_instrs.gb',
      'fonts': 'roms/gbdk/fonts.gb',
      'galaxy': 'roms/gbdk/galaxy.gb',
      'rand': 'roms/gbdk/rand.gb',
      'colorbar': 'roms/gbdk/colorbar.gb'
    };
  }

  /**
   * @param {string} gameName
   * @param {Function} callback
   */
  request(gameName, callback){

    const file = this._games[gameName];

    if (file){
      const request = new XMLHttpRequest();
      request.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
          callback.call(this, this.response);
        }
      };
      request.open('GET', file, true);
      request.responseType = 'arraybuffer';
      request.send();
    }
  }

}