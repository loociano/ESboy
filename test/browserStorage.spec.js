import BrowserStorage from '../src/browserStorage';
import assert from 'assert';
import {describe, beforeEach, it} from 'mocha';

describe('Storage tests', () => {

  let storage;

  describe('Init', () => {
    it('should initialize', () => {
      assert.throws( () => new BrowserStorage(null), Error, 'Must pass a local storage');
    });
    it('should provide localstorage', () => {
      const invalidStorage = {};
      assert.throws( () => new BrowserStorage(invalidStorage), Error, 'local storage must provide getItem(), setItem()');
    });
  });

  describe('Read', () => {
    it('should do sanity check', () => {
      let localStorageMock = {
        getItem: function(key) {
          return 0;
        },
        setItem: function(key, value){}
      };
      storage = new BrowserStorage(localStorageMock);
      assert.equal(storage.read('GAME TITLE'), null);
    });

    it('should do sanity check', () => {
      let localStorageMock = {
        getItem: function(key) {
          return;
        },
        setItem: function(key, value){}
      };
      storage = new BrowserStorage(localStorageMock);
      assert.equal(storage.read('GAME TITLE'), null);
    });
  });
});