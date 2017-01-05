import assert from 'assert';
import LCD from '../src/lcd';
import ContextMock from './mock/contextMock';
import MMUMock from './mock/mmuMock';
import {describe, beforeEach, it} from 'mocha';

describe('LCD', () => {

  let lcd;
  const lineRgbaLength = 160*4;

  beforeEach(function() {
    lcd = new LCD(new MMUMock(), new ContextMock(), new ContextMock());
    /**
     * @param {number} line
     * @returns {Uint8ClampedArray}
     */
    lcd.getBGLineData = function(line){
      return this.getImageDataBG().data.subarray(line*lineRgbaLength, (line+1)*lineRgbaLength);
    };
    /**
     * For testing purposes, LCD HW will always draw line by line
     */
    lcd.drawTiles = function() {
      this._clear();
      this._clear(this._imageDataOBJ, this._ctxOBJ);
      for(let l = 0; l < lcd._HW_HEIGHT; l++){
        lcd.drawLine(l);
      }
    };
    /**
     * Asserts that each pixel of a line at x,y equals to a rbga vector
     * @param {number} line
     * @param {number} grid_x
     * @param {Array} rgba
     * @param {ImageData} imageData
     */
    lcd.assertLinePixels = function(line, grid_x, rgba, imageData){
      for(let x = grid_x*8; x < (grid_x+1)*8; x++){
        assert.deepEqual(Array.from(this.getPixelData(x, line, imageData)), Array.from(rgba), `Line=${line} x=${x} pixel data ${rgba}`);
      }
    };
    /**
     * @param {number} x
     * @param {number} y
     * @param {ImageData} imageData
     * @returns {Array} pixel data
     */
    lcd.getPixelData = function(x, y, imageData){
      const index = (x + y * this._HW_WIDTH) * 4;
      return imageData.data.slice(index, index + 4);
    };

  });

  describe('Tile reading', () => {

    it('should transform a Nintendo tile buffer into a matrix', () => {
      assert.deepEqual(LCD.tileToIntensityVector(new Buffer('3c00', 'hex')), [0,0,1,1,1,1,0,0]);
      assert.deepEqual(LCD.tileToIntensityVector(new Buffer('4200', 'hex')), [0,1,0,0,0,0,1,0]);
      assert.deepEqual(LCD.tileToIntensityVector(new Buffer('b900', 'hex')), [1,0,1,1,1,0,0,1]);
      assert.deepEqual(LCD.tileToIntensityVector(new Buffer('a500', 'hex')), [1,0,1,0,0,1,0,1]);
    });

    it('should transform a tile buffer into levels of gray matrix', () => {
      assert.deepEqual(LCD.tileToIntensityVector(new Buffer('5533', 'hex')), [0,1,2,3,0,1,2,3]);
      assert.deepEqual(LCD.tileToIntensityVector(new Buffer('aacc', 'hex')), [3,2,1,0,3,2,1,0]);
    });

    it('should transform a tile buffer into a the lightest matrix', () => {
      assert.deepEqual(LCD.tileToIntensityVector(new Buffer('0000', 'hex')), [0,0,0,0,0,0,0,0]);
    });

    it('should transform a tile buffer into a darkest matrix', () => {
      assert.deepEqual(LCD.tileToIntensityVector(new Buffer('ffff', 'hex')), [3,3,3,3,3,3,3,3]);
    });
  });

  describe('Pixel drawing', () => {

    it('should write pixel data', () => {

      const WIDTH = 160;
      const HEIGHT = 144;
      const lastIndex = WIDTH * HEIGHT * 4 - 1;
      const data = lcd.getImageDataBG().data;

      let pixel = {x: 0, y: 0, level: 0};
      lcd.drawPixel(pixel);

      assert.deepEqual([data[0], data[1], data[2], data[3]], lcd.SHADES[lcd._bgp[pixel.level]]);

      pixel = {x: 1, y: 0, level: 1};
      lcd.drawPixel(pixel);

      assert.deepEqual([data[4], data[5], data[6], data[7]], lcd.SHADES[lcd._bgp[pixel.level]]);

      pixel = {x: WIDTH - 1, y: 0, level: 2};
      lcd.drawPixel(pixel);

      assert.deepEqual([data[WIDTH * 4 - 4], data[WIDTH * 4 - 3], data[WIDTH * 4 - 2], data[WIDTH * 4 - 1]], lcd.SHADES[lcd._bgp[pixel.level]]);

      pixel = {x: WIDTH - 1, y: HEIGHT - 1, level: 3};
      lcd.drawPixel(pixel);

      assert.deepEqual([data[lastIndex - 3], data[lastIndex - 2], data[lastIndex - 1], data[lastIndex]], lcd.SHADES[lcd._bgp[pixel.level]]);
    });

  });

  describe('Tile drawing', () => {

    it('should draw a line', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = (tileNumber) => {
        if (tileNumber === 0) {
          return new Buffer('ffff', 'hex');
        } else {
          return new Buffer('0000', 'hex');
        }
      };
      mmu.getCharCode = (gridX) => {
        if (gridX === 0) {
          return 0;
        } else {
          return 1;
        }
      };

      const expectedData = new Uint8ClampedArray(lineRgbaLength); // first LCD line
      for(let p = 0; p < expectedData.length; p++){
        if (p < 8*4){
          expectedData[p] = lcd.SHADES[lcd._bgp[3]][p % 4]; // left-most tile
        } else {
          expectedData[p] = lcd.SHADES[lcd._bgp[0]][p % 4];
        }
      }

      lcd.drawLine(0);

      assert.deepEqual(Array.from(lcd.getBGLineData(0)), Array.from(expectedData));
    });

    it('should draw horizontal lines, dark and light', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = (tileNumber, tileLine) => {
        if (tileLine % 2 === 0) {
          return new Buffer('ffff', 'hex'); // even lines are dark
        } else {
          return new Buffer('0000', 'hex'); // odd lines are light
        }
      };
      mmu.getCharCode = (any) => 0;

      const expectedDarkLine = new Uint8ClampedArray(lineRgbaLength);
      const expectedLightLine = new Uint8ClampedArray(lineRgbaLength);
      for(let p = 0; p < expectedDarkLine.length; p++){
        expectedDarkLine[p] = lcd.SHADES[lcd._bgp[3]][p % 4];
        expectedLightLine[p] = lcd.SHADES[lcd._bgp[0]][p % 4];
      }

      lcd.drawTiles();

      for(let l = 0; l < 144; l++) {
        const lineData = lcd.getBGLineData(l);
        if (l % 2 === 0) {
          assert.deepEqual(lineData, expectedDarkLine);
        } else {
          assert.deepEqual(lineData, expectedLightLine);
        }
      }
    });

    it('should cache tiles and clear cache when VRAM is updated', () => {
      const mmu = lcd.getMMU();
      let calculated = 0;
      mmu.getCharCode = (any) => 0;
      mmu.writeByteAt = (addr, n) => {
        mmu._VRAMRefreshed = true;
      };
      lcd._calculateIntensityVector = () => {
        calculated++;
        return [1,1,1,1,1,1,1,1];
      };

      lcd.drawLine(0);
      lcd.drawLine(0);

      assert.equal(calculated, 1, 'only calculated once');

      mmu.writeByteAt(mmu.ADDR_VRAM_START, 0x01);

      lcd.drawLine(0);

      assert.equal(calculated, 2, 'calculated again');
    });

    it('should not drawn the same line twice', () => {
      let called = 0;
      const array = [];

      const mmu = lcd.getMMU();
      mmu.isTileLineDrawn = (pos) => {
        return array[pos];
      };
      mmu.setTileLineDrawn = (pos) => {
        array[pos] = true;
      };

      lcd._drawTileLine = () => {
        called++;
      };

      lcd.drawLine(0);
      lcd.drawLine(0);
      lcd.drawLine(0);

      assert.equal(called, 20, 'draw 20 tile once');
    });

    it('should not draw lines outside screen', () => {
      const bg = lcd.getImageDataBG();

      lcd.drawLine(144);

      assert.deepEqual(bg, lcd.getImageDataBG(), 'No change');
    });

    it('should write darkest tiles on screen', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = (tileNumber) => {
        if (tileNumber === 0) {
          return new Buffer('ffff', 'hex');
        } else {
          return new Buffer('0000', 'hex');
        }
      };
      mmu.getCharCode = (gridX, gridY) => {
        if (gridX === 0 && gridY === 0) {
          return 0; // top-left most tile
        } else if (gridX === 19 && gridY === 17){
          return 0; // bottom-right most tile
        } else if (gridX === 10 && gridY === 9){
          return 0; // center tile
        } else {
          return 1;
        }
      };

      lcd.drawTiles();

      assertDarkestTile.call(lcd, 0, 0, lcd.getImageDataBG());
      assertDarkestTile.call(lcd, 10, 9, lcd.getImageDataBG());
      assertDarkestTile.call(lcd, 19, 17, lcd.getImageDataBG());
    });

  });

  describe('OBJ (Sprites)', () => {
    it('should draw OBJs if they are enabled on MMU', () => {
      const mmu = lcd.getMMU();
      mmu.getCharCode = (any) =>  0;
      mmu.readBGData = (any) => new Buffer('0000', 'hex');
      mmu.readOBJData = (any) => new Buffer('ffff', 'hex');
      mmu.areOBJOn = () => true;
      mmu.getOBJ = (any) => { return {y: 16, x: 8, chrCode: 0, attr: 0}; };

      lcd.drawLine(0);

      lcd.assertLinePixels(0, 0, lcd.SHADES[3], lcd.getImageDataOBJ());

      mmu.areOBJOn = () => false;
      lcd.drawLine(0);

      lcd.assertLinePixels(0, 0, [0,0,0,0], lcd.getImageDataOBJ());
    });

    it('should draw OBJs in any line', () => {
      const mmu = lcd.getMMU();
      mmu.getCharCode = (any) =>  0;
      mmu.readBGData = (any) => new Buffer('0000', 'hex');
      mmu.readOBJData = (tileNumber, tileLine) => {
        if (tileLine % 2 === 0){
          return new Buffer('ffff', 'hex');
        } else {
          return new Buffer('ff00', 'hex');
        }
      };
      mmu.areOBJOn = () => true;
      mmu.getOBJ = (n) => {
        if (n === 0){
          return {y: 116, x: 108, chrCode: 0, attr: 0};
        } else {
          return {y: 0, x: 0};
        }
      };

      // OBJ should be in lines 100..107
      lcd.drawLine(100);
      lcd.drawLine(101);

      lcd.assertLinePixels(100, 12.5, lcd.SHADES[3], lcd.getImageDataOBJ());
      lcd.assertLinePixels(101, 12.5, lcd.SHADES[1], lcd.getImageDataOBJ());
    });

    it('should write OBJ on top of BG', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = (any) => { return new Buffer('0000', 'hex'); };
      mmu.areOBJOn = () => true;
      mmu.readOBJData = (any) => { return new Buffer('ffff', 'hex'); };
      mmu.getOBJ = function(obj_number) {
        if (obj_number === 0) {
          return {y: 16, x: 8, chrCode: 0x01, attr: 0x00};
        } else if (obj_number === 1){
          return {y: 8, x: 0, chrCode: 0x01, attr: 0x00}; // hidden as x < 8 and y < 16
        } else {
          return {y: 0, x: 0, chrCode: 0x00, attr: 0x00}; // Empty OBJ, should not paint
        }
      };
      mmu.getCharCode = (any) => { return 0x00; };
      mmu._VRAMRefreshed = true;

      lcd.drawTiles();

      for(let x = 0; x < lcd._H_TILES; x++){
        for(let y = 0; y < lcd._V_TILES; y++){
          if (x === 0 && y === 0){
            assertDarkestTile.call(lcd, x, y, lcd.getImageDataOBJ());
          } else {
            assertLightestTile.call(lcd, x, y, lcd.getImageDataBG());
          }
        }
      }
    });

    it('should detect transparency on OBJ', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = () => { return new Buffer('ffff', 'hex'); };
      mmu.readOBJData = () => { return new Buffer('0000', 'hex'); };
      mmu.getOBJ = () => { return {y: 16, x: 8, chrCode: 0x00, attr: 0x00}; };
      mmu.getCharCode = () => { return 0x00; };
      mmu.obg0 = () => { return 0b11100100; };

      lcd.drawTiles();

      // Everything must be darkest, as the OBJ is all transparent
      assertTransparentTile.call(lcd, 0, 0, lcd.getImageDataOBJ());
    });

    it('should not paint pixels 00 from OBJ regardless of their palette', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = () => { return new Buffer('ffff', 'hex'); };
      mmu.readOBJData = () => { return new Buffer('0000', 'hex'); };
      mmu.getOBJ = () => { return {y: 16, x: 8, chrCode: 0x00, attr: 0x00}; };
      mmu.getCharCode = () => { return 0x00; };
      mmu.obg0 = () => { return 0b11111111; }; // force lightest level bit0,1 to darkest

      lcd.drawTiles();

      // Still, no OBJ is painted as the buffer is zero
      assertTransparentTile.call(lcd, 0, 0, lcd.getImageDataOBJ());
    });

    it('should transform palettes to intensity array', () => {
      assert.deepEqual(LCD.paletteToArray(0b11100100), [0, 1, 2, 3]);
      assert.deepEqual(LCD.paletteToArray(0b00000000), [0, 0, 0, 0]);
      assert.deepEqual(LCD.paletteToArray(0b11111111), [3, 3, 3, 3]);
    });

    it('should detect palette on OBJ', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = () => { return new Buffer('0000', 'hex'); };
      mmu.readOBJData = () => { return new Buffer('ff00', 'hex'); };
      mmu.getCharCode = () => { return 0x00; };
      mmu.getOBJ = () => { return {y: 16, x: 8, chrCode: 0x00, attr: 0x00}; };
      mmu.obg0 = () => { return 0b00000000; };

      lcd.drawTiles();

      assertTile.call(lcd, 0, 0, lcd.SHADES[0], lcd.getImageDataOBJ());

      // Use OBG1
      mmu.getOBJ = () => { return {y: 16, x: 8, chrCode: 0x00, attr: 0x10}; };
      mmu.obg1 = () => { return 0b00000100; };

      lcd.drawTiles();

      assertTile.call(lcd, 0, 0, lcd.SHADES[1], lcd.getImageDataOBJ());

      mmu.obg1 = () => { return 0b00001000; };

      lcd.drawTiles();

      assertTile.call(lcd, 0, 0, lcd.SHADES[2], lcd.getImageDataOBJ());

      mmu.obg1 = () => { return 0b00001100; };

      lcd.drawTiles();

      assertTile.call(lcd, 0, 0, lcd.SHADES[3], lcd.getImageDataOBJ());
    });

    it('should flip OBJ horizontally', () => {
      const mmu = lcd.getMMU();
      mmu.getCharCode = (any) => { return 0; };
      mmu.getOBJ = (any) => { return {y: 16, x: 8, chrCode: 0x00, attr: 0b00100000/* hor flip flag */ }; };
      mmu.readBGData = (any) => { return new Buffer('0000', 'hex'); };
      mmu.readOBJData = (any) => {
        // Left half is darkest, right half is transparent
        return new Buffer('f0f0', 'hex');
      };

      lcd.drawTiles();

      for(let x = 0; x < 8; x++){
        for(let y = 0; y < 8; y++){
          if (x < 4){
            assert.deepEqual(lcd.getPixelData(x, y, lcd.getImageDataOBJ()), [0, 0, 0, 0], 'Left half is transparent');
          } else {
            assert.deepEqual(lcd.getPixelData(x, y, lcd.getImageDataOBJ()), lcd.SHADES[3], 'Right half is darkest');
          }
        }
      }

    });

    it('should flip OBJ vertically', () => {
      const mmu = lcd.getMMU();
      mmu.getCharCode = (any) => { return 0; };
      mmu.readBGData = (any) => { return new Buffer('0000', 'hex'); };
      mmu.getOBJ = (n) => {
        if ( n === 0 ){
          return {y: 16, x: 8, chrCode: 0x00, attr: 0b01000000};
        } else {
          return {y: 0, x: 0};
        }
      };
      mmu.readOBJData = (tileNumber, tileLine) => {
        // Top half is darkest, bottom half is transparent
        if (tileLine < 4) {
          return new Buffer('ffff', 'hex');
        } else {
          return new Buffer('0000', 'hex');
        }
      };

      lcd.drawTiles();

      for(let x = 0; x < 8; x++){
        for(let y = 0; y < 8; y++){
          if (y < 4){
            assert.deepEqual(lcd.getPixelData(x, y, lcd.getImageDataOBJ()), [0, 0, 0, 0], 'Top half is transparent');
          } else {
            assert.deepEqual(lcd.getPixelData(x, y, lcd.getImageDataOBJ()), lcd.SHADES[3], 'Bottom half is darkest');
          }
        }
      }

    });

    it('should flip OBJ horizontally and vertically', () => {
      const mmu = lcd.getMMU();
      mmu.getCharCode = (any) => { return 0; };
      mmu.getOBJ = (number) => {
        if (number === 0){
          return {y: 16, x: 8, chrCode: 0, attr: 0b01100000};
        } else {
          return {y: 0, x: 0, chrCode: 0, attr: 0}
        }
      };
      mmu.readBGData = (any) => { return new Buffer('0000', 'hex'); };
      mmu.readOBJData = (tileNumber, tileLine) => {
        if (tileNumber === 0 && tileLine === 0) {
          return new Buffer('8080', 'hex'); // pixel at top-left most is darkest
        } else {
          return new Buffer('0000', 'hex');
        }
      };

      lcd.drawTiles();

      for(let x = 0; x < 8; x++){
        for(let y = 0; y < 8; y++){
          if (x === 7 && y === 7){
            assert.deepEqual(lcd.getPixelData(x, y, lcd.getImageDataOBJ()), lcd.SHADES[3], 'Bottom-right most pixel is darkest');
          } else {
            assert.deepEqual(lcd.getPixelData(x, y, lcd.getImageDataOBJ()), [0,0,0,0], `${x},${y} is transparent`);
          }
        }
      }

    });

    it('should detect OBJ priority flag', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = (any) => { return new Buffer('ffff', 'hex'); };
      mmu.readOBJData = (tileNumber, tileLine) => { return new Buffer('ff00', 'hex'); };
      mmu.getCharCode = (any) => { return 0; };
      mmu.getOBJ = (any) => { return {y: 16, x: 8, chrCode: 0x00, attr: 0b00000000}; };
      mmu.obg0 = () => { return 0b11100100; };

      lcd.drawTiles();

      assertTile.call(lcd, 0, 0, lcd.SHADES[1], lcd.getImageDataOBJ());

      // Priority flag: BG over OBJ
      mmu.getOBJ = (any) => { return {y: 16, x: 8, chrCode: 0x00, attr: 0b10000000}; };

      lcd.drawTiles();

      assertTransparentTile.call(lcd, 0, 0, lcd.getImageDataOBJ());
    });

    it('should display an OBJ with a priority flag only if the BG behind is zero', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = (any) => { return new Buffer('00000000000000000000000000000000', 'hex'); };
      mmu.readOBJData = (any) => { return new Buffer('ff00ff00ff00ff00ff00ff00ff00ff00', 'hex'); };
      mmu.getCharCode = (any) => { return 0x00; };
      mmu.getOBJ = (any) => { return {y: 16, x: 8, chrCode: 0x00, attr: 0b10000000}; };
      mmu.obg0 = () => { return 0b11100100; };

      lcd.drawTiles();

      assertTile.call(lcd, 0, 0, lcd.SHADES[1], lcd.getImageDataOBJ());
    });
  });

});

/**
 * Asserts that each pixel of a tile at x,y equals to rbga
 * @param grid_x
 * @param grid_y
 * @param {array} rgba
 */
function assertTile(grid_x, grid_y, rgba, imageData){

  for(let x = grid_x*8; x < (grid_x+1)*8; x++){
    for(let y = grid_y*8; y < (grid_y+1)*8; y++){
       assert.deepEqual(Array.from(this.getPixelData(x, y, imageData)), Array.from(rgba), `Tile: ${grid_x},${grid_y} x=${x}, y=${y} pixel data ${rgba}`);
    } 
  }
}

function assertDarkestTile(grid_x, grid_y, imageData){
  assertTile.call(this, grid_x, grid_y, this.SHADES[3], imageData);
}

function assertLightestTile(grid_x, grid_y, imageData){
  assertTile.call(this, grid_x, grid_y, this.SHADES[0], imageData);
}

function assertTransparentTile(grid_x, grid_y, imageData){
  assertTile.call(this, grid_x, grid_y, [0, 0, 0, 0], imageData);
}
