import Loader from '../src/Loader';
import CPU from '../src/CPU';
import assert from 'assert';
import should from 'should';

describe('CPU', function() {
  it('should fail without loader', () => {
    (function(){
      let cpu = new CPU();
    }).should.throw();
  });

  it('should read the game title', () => {

    let loader = new Loader();
    loader.load('./roms/tetris.gb');
    let cpu = new CPU(loader);

    assert.equal(cpu.getGameTitle(), 'TETRIS');

  });

});