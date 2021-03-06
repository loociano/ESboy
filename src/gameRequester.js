export default class GameRequester {

  constructor(){
    this._games = {
      'load-game': 'roms/load-game.gb'
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