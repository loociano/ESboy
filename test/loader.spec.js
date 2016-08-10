import Loader from '../src/Loader';
import assert from 'assert';
import should from 'should';

describe('Loader', function() {
  it('should read a file without error', () => {

    (function(){
      new Loader().load('./roms/tetris.gb');
    }).should.not.throw();

  });

  it('should not fail if file does not exist', () => {

    (function(){
      new Loader().load('./roms/nope.gb');
    }).should.not.throw();

  });

});