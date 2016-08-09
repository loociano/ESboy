import Loader from '../lib/Loader';
import assert from 'assert';
import should from 'should';

describe('Loader', function() {
  it('should read a file without error', () => {

    (function(){
      new Loader().load('./roms/tetris.gb');
    }).should.not.throw();

  });

  it('should fail if file does not exist', () => {

    (function(){
      new Loader().load('./roms/nope.gb');
    }).should.throw();

  });
});