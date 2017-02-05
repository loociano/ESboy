import assert from 'assert';
import LCD from '../src/lcd';
import ContextMock from './mock/contextMock';
import MMUMock from './mock/mmuMock';
import Utils from '../src/utils';
import {describe, beforeEach, it} from 'mocha';

describe('LCD', () => {

  let lcd, mmu;
  const lineRgbaLength = 160*4;

  beforeEach(() => {
    mmu = new MMUMock();
    mmu.isGameInColor = () => false;
    lcd = new LCD(mmu, new ContextMock());

    /**
     * @returns {MMU}
     */
    lcd.getMMU = function(){
      return this._mmu;
    };
    /**
     * @param {number} line
     * @returns {Uint8ClampedArray}
     */
    lcd.getLineData = function(line){
      return this.getImageData().data.subarray(line*lineRgbaLength, (line+1)*lineRgbaLength);
    };
    /**
     * For testing purposes, LCD HW will always draw line by line
     */
    lcd.drawTiles = function() {
      this._clear();
      for(let l = 0; l < 144; l++){
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
    lcd.assertLinePixels = function(line, grid_x, rgba){
      for(let x = grid_x*8; x < (grid_x+1)*8; x++){
        assert.deepEqual(Array.from(this.getPixelData(x, line)), Array.from(rgba), `Line=${line} x=${x} pixel data ${rgba}`);
      }
    };
    /**
     * @param {number} x
     * @param {number} y
     * @returns pixel data
     */
    lcd.getPixelData = function(x, y){
      const index = (x + y * this._HW_WIDTH) * 4;
      return lcd.getImageData().data.slice(index, index + 4);
    };

    /**
     * Asserts that each pixel of a tile at x,y equals to rbga
     * @param grid_x
     * @param grid_y
     * @param {array} rgba
     */
    lcd.assertTile = function(grid_x, grid_y, rgba){
      for(let x = grid_x*8; x < (grid_x+1)*8; x++){
        for(let y = grid_y*8; y < (grid_y+1)*8; y++){
          assert.deepEqual(Array.from(this.getPixelData(x, y)), Array.from(rgba), `Tile: ${grid_x},${grid_y} x=${x}, y=${y} pixel data ${rgba}`);
        }
      }
    };

    lcd.assertDarkestTile = function(grid_x, grid_y){
      this.assertTile(grid_x, grid_y, this.SHADES[3]);
    };

    lcd.assertLightestTile = function(grid_x, grid_y){
      this.assertTile(grid_x, grid_y, this.SHADES[0]);
    };

    lcd.assertTransparentTile = function(grid_x, grid_y){
      this.assertTile(grid_x, grid_y, [0, 0, 0, 0]);
    };

    lcd.generateLineData = function(paletteLevel) {
      const lineData = new Uint8ClampedArray(lineRgbaLength);
      for (let p = 0; p < lineData.length; p++) {
        lineData[p] = lcd._bgp[paletteLevel][p % 4];
      }
      return lineData;
    };

  });

  describe('Tile reading and transformation to palette', () => {

    it('should transform a tile buffer into a intensity vector', () => {
      assert.deepEqual(LCD.tileToIntensityVector(new Buffer('3c00', 'hex')), [0,0,1,1,1,1,0,0]);
      assert.deepEqual(LCD.tileToIntensityVector(new Buffer('4200', 'hex')), [0,1,0,0,0,0,1,0]);
      assert.deepEqual(LCD.tileToIntensityVector(new Buffer('b900', 'hex')), [1,0,1,1,1,0,0,1]);
      assert.deepEqual(LCD.tileToIntensityVector(new Buffer('a500', 'hex')), [1,0,1,0,0,1,0,1]);
    });

    it('should transform a tile buffer into a gradient intensity vector', () => {
      assert.deepEqual(LCD.tileToIntensityVector(new Buffer('5533', 'hex')), [0,1,2,3,0,1,2,3]);
      assert.deepEqual(LCD.tileToIntensityVector(new Buffer('aacc', 'hex')), [3,2,1,0,3,2,1,0]);
    });

    it('should transform a tile buffer into the lightest intensity vector', () => {
      assert.deepEqual(LCD.tileToIntensityVector(new Buffer('0000', 'hex')), [0,0,0,0,0,0,0,0]);
    });

    it('should transform a tile buffer into the darkest intensity vector', () => {
      assert.deepEqual(LCD.tileToIntensityVector(new Buffer('ffff', 'hex')), [3,3,3,3,3,3,3,3]);
    });
  });

  describe('Pixel drawing', () => {

    it('should write pixel data', () => {

      const WIDTH = 160;
      const HEIGHT = 144;
      const lastIndex = WIDTH * HEIGHT * 4 - 1;
      const data = lcd.getImageData().data;

      let pixel = {x: 0, y: 0, paletteDataNb: 0};
      lcd.drawPixel(pixel);

      assert.deepEqual([data[0], data[1], data[2], data[3]], lcd._bgp[0]);

      pixel = {x: 1, y: 0, paletteDataNb: 1};
      lcd.drawPixel(pixel);

      assert.deepEqual([data[4], data[5], data[6], data[7]], lcd._bgp[1]);

      pixel = {x: WIDTH - 1, y: 0, paletteDataNb: 2};
      lcd.drawPixel(pixel);

      assert.deepEqual([data[WIDTH * 4 - 4], data[WIDTH * 4 - 3], data[WIDTH * 4 - 2], data[WIDTH * 4 - 1]], lcd._bgp[2]);

      pixel = {x: WIDTH - 1, y: HEIGHT - 1, paletteDataNb: 3};
      lcd.drawPixel(pixel);

      assert.deepEqual([data[lastIndex - 3], data[lastIndex - 2], data[lastIndex - 1], data[lastIndex]], lcd._bgp[3]);
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
      mmu.getBgCharCode = (gridX) => {
        if (gridX === 0) {
          return 0;
        } else {
          return 1;
        }
      };

      const expectedData = new Uint8ClampedArray(lineRgbaLength); // first LCD line
      for(let p = 0; p < expectedData.length; p++){
        if (p < 8*4){
          expectedData[p] = lcd._bgp[3][p % 4]; // left-most tile
        } else {
          expectedData[p] = lcd._bgp[0][p % 4];
        }
      }

      lcd.drawLine(0);

      assert.deepEqual(Array.from(lcd.getLineData(0)), Array.from(expectedData));
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
      mmu.getBgCharCode = (any) => 0;

      const expectedDarkLine = new Uint8ClampedArray(lineRgbaLength);
      const expectedLightLine = new Uint8ClampedArray(lineRgbaLength);
      for(let p = 0; p < expectedDarkLine.length; p++){
        expectedDarkLine[p] = lcd._bgp[3][p % 4];
        expectedLightLine[p] = lcd._bgp[0][p % 4];
      }

      lcd.drawTiles();

      for(let l = 0; l < 144; l++) {
        const lineData = lcd.getLineData(l);
        if (l % 2 === 0) {
          assert.deepEqual(lineData, expectedDarkLine);
        } else {
          assert.deepEqual(lineData, expectedLightLine);
        }
      }
    });

    it('should not draw lines outside screen', () => {
      const bg = lcd.getImageData();
      const mmu = lcd.getMMU();
      mmu.readBGData = (any) => new Buffer('0000', 'hex');
      mmu.scy = () => 0; // no vertical scrolling

      lcd.drawLine(144);

      assert.deepEqual(bg, lcd.getImageData(), 'No change');
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
      mmu.getBgCharCode = (gridX, gridY) => {
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

      lcd.assertDarkestTile(0, 0);
      lcd.assertDarkestTile(10, 9);
      lcd.assertDarkestTile(19, 17);
    });

    describe('Scrolling (SCX, SCY)', () => {
      it('should shift background horizontally', () => {
        const mmu = lcd.getMMU();
        mmu.readBGData = (tileNumber, tileLine) => {
          switch(tileNumber){
            case 1: // [1 0 0 0 0 0 0 0]
              return new Buffer('8000', 'hex');
            case 2: // [2 0 0 0 0 0 0 2]
              return new Buffer('0081', 'hex');
            default:
              return new Buffer('0000', 'hex');
          }
        };
        mmu.getBgCharCode = (gridX) => {
          if (gridX === 12 || gridX === 0) return 1;
          if (gridX === 31) return 2;
          return 0;
        };

        lcd.drawLine(0);

        assert.deepEqual(Array.from(lcd.getPixelData(0, 0)), lcd.SHADES[1]);
        assert.deepEqual(Array.from(lcd.getPixelData(12*8, 0)), lcd.SHADES[1]);
        // tile 31 is not visible

        mmu.scx = () => 1;
        lcd.drawLine(0);

        assert.deepEqual(Array.from(lcd.getPixelData(0, 0)), lcd.SHADES[0]);

        mmu.scx = () => 96;
        lcd.drawLine(0);

        assert.deepEqual(Array.from(lcd.getPixelData(12*8 - 96, 0)), lcd.SHADES[1], 'pixel shifted 96px left');
        assert.deepEqual(Array.from(lcd.getPixelData(31*8 - 96, 0)), lcd.SHADES[2], 'pixel shifted 96px left');
        assert.deepEqual(Array.from(lcd.getPixelData(31*8 - 96 + 7, 0)), lcd.SHADES[2], 'pixel shifted 96px left');

        mmu.scx = () => 255;
        lcd.drawLine(0);

        assert.deepEqual(Array.from(lcd.getPixelData(0, 0)), lcd.SHADES[2], 'pixel shifted 255px left');
        assert.deepEqual(Array.from(lcd.getPixelData(1, 0)), lcd.SHADES[1], 'pixel loop-shifted 255px left');
      });

      it('should shift background vertically', () => {
        const mmu = lcd.getMMU();
        mmu.readBGData = (tileNumber, tileLine) => {

          switch(tileNumber){
            case 1: // 1 pixel level-3 on top-left corner
              if (tileLine === 0){
                return new Buffer('8080', 'hex');
              } else {
                return new Buffer('0000', 'hex');
              }
            case 2: // 1 pixel level-3 on bottom-left corner
              if (tileLine === 7){
                return new Buffer('8080', 'hex');
              } else {
                return new Buffer('0000', 'hex');
              }
            case 3: // 1 pixel level-2 on top-left corner
              if (tileLine === 0){
                return new Buffer('0080', 'hex');
              } else {
                return new Buffer('0000', 'hex');
              }
            default:
              return new Buffer('0000', 'hex');
          }
        };
        mmu.getBgCharCode = (gridX, gridY) => {
          if (gridX === 0 && gridY === 12) return 1;
          if (gridX === 0 && gridY === 31) return 2;
          if (gridX === 0 && gridY === 0)  return 3;
          return 0;
        };

        lcd.drawLine(0);
        lcd.drawLine(96);
        // line 255 out of bounds

        assert.deepEqual(Array.from(lcd.getPixelData(0, 0)), lcd.SHADES[2]);
        assert.deepEqual(Array.from(lcd.getPixelData(0, 96)), lcd.SHADES[3]);

        mmu.scy = () => 96;

        lcd.drawLine(0);

        assert.deepEqual(Array.from(lcd.getPixelData(0, 0)), lcd.SHADES[3], 'pixel shifted 100px up');

        mmu.scy = () => 255;

        lcd.drawLine(0);
        lcd.drawLine(1);

        assert.deepEqual(Array.from(lcd.getPixelData(0, 0)), lcd.SHADES[3], 'pixel shifted 255px up');
        assert.deepEqual(Array.from(lcd.getPixelData(0, 1)), lcd.SHADES[2], 'pixel loop-shifted 255px up');
      });

      it('should shift background by means of registers SCX and SCY', () => {
        const mmu = lcd.getMMU();
        // 1 dark pixel at x=1 y=1
        mmu.readBGData = (tileNumber, tileLine) => {
          switch(tileNumber){
            case 0:
              if (tileLine === 1){
                return new Buffer('4040', 'hex');
              } else {
                return new Buffer('0000', 'hex');
              }
            case 1: return new Buffer('0000', 'hex');
            case 2:
              if (tileLine === 0){
                return new Buffer('8080', 'hex');
              } else {
                return new Buffer('0000', 'hex');
              }
          }
        };
        mmu.getBgCharCode = (gridX, gridY) => {
          if (gridX === 20 && gridY === 18) return 2;
          if (gridX !== 0 || gridY !== 0) return 1;
          return 0;
        };

        lcd.drawTiles();

        assert.deepEqual(Array.from(lcd.getPixelData(1, 1)), lcd.SHADES[3]);

        lcd._clear();
        mmu.scx = () => 1;
        mmu.scy = () => 1;

        lcd.drawTiles();

        assert.deepEqual(Array.from(lcd.getPixelData(0, 0)), lcd.SHADES[3], 'shifted from 1,1 to 0,0');
        assert.deepEqual(Array.from(lcd.getPixelData(159, 143)), lcd.SHADES[3], 'shifted from 160,144 to 159,143');
      });
    });

    it('should compute grid coordinates with boundaries', () => {

      assert.equal(lcd.getVerticalGrid(0, 0), 0);
      assert.equal(lcd.getVerticalGrid(0, 1), 0);
      assert.equal(lcd.getVerticalGrid(0, 7), 0);
      assert.equal(lcd.getVerticalGrid(0, 8), 1);
      assert.equal(lcd.getVerticalGrid(0, 16), 2);

      assert.equal(lcd.getVerticalGrid(8, 0), 1);
      assert.equal(lcd.getVerticalGrid(8, 8), 2);

      assert.equal(lcd.getVerticalGrid(255, 0), 31);
      assert.equal(lcd.getVerticalGrid(255, 1), 0);
      assert.equal(lcd.getVerticalGrid(255, 9), 1);
    });

  });

  describe('OBJ (Sprites)', () => {
    it('should draw OBJs if they are enabled on MMU', () => {
      const mmu = lcd.getMMU();
      mmu.getBgCharCode = (any) =>  0;
      mmu.readBGData = (any) => new Buffer('0000', 'hex');
      mmu.readOBJData = (any) => new Buffer('ffff', 'hex');
      mmu.areOBJOn = () => true;
      mmu.getOBJ = (any) => { return {y: 16, x: 8, chrCode: 0, attr: 0}; };

      lcd.drawLine(0);

      lcd.assertLinePixels(0, 0, lcd.SHADES[3]);

      mmu.areOBJOn = () => false;
      lcd.drawLine(0);

      lcd.assertLinePixels(0, 0, lcd.SHADES[0]);
    });

    it('should draw OBJs in any line', () => {
      const mmu = lcd.getMMU();
      mmu.getBgCharCode = (any) =>  0;
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

      lcd.assertLinePixels(100, 12.5, lcd.SHADES[3]);
      lcd.assertLinePixels(101, 12.5, lcd.SHADES[1]);
    });

    it('should draw 8x16 OBJs', () => {
      const mmu = lcd.getMMU();
      mmu.areOBJDouble = () => true;
      mmu.areOBJOn = () => true;
      mmu.readOBJData = (tileNumber) => {
        if (tileNumber === 2) {
          return new Buffer('ff00', 'hex');
        }
        if (tileNumber === 3) {
          return new Buffer('00ff', 'hex'); /* with double objs, non even tile numbers are picked consequently */
        }
        return new Buffer('0000', 'hex');
      };
      mmu.getOBJ = function(obj_number) {
        if (obj_number === 0) {
          return {y: 17, x: 16, chrCode: 0x02, attr: 0x00}; /* top: 1px, left: 8px */
        }
      };
      mmu.readBGData = (any) => new Buffer('0000', 'hex');
      mmu.getBgCharCode = (any) => 0x00;

      lcd.drawTiles();

      for(let l = 1; l < 17; l++){
        if (l < 9)
          lcd.assertLinePixels(l, 1, lcd.SHADES[1]);
        else
          lcd.assertLinePixels(l, 1, lcd.SHADES[2]);
      }
    });

    it('should draw 8x16 OBJs with odd CHAR codes', () => {
      const mmu = lcd.getMMU();
      mmu.areOBJDouble = () => true;
      mmu.areOBJOn = () => true;
      mmu.readOBJData = (tileNumber) => {
        if (tileNumber === 2) {
          return new Buffer('ff00', 'hex');
        }
        if (tileNumber === 3) {
          return new Buffer('00ff', 'hex'); /* with double objs, non even tile numbers are picked consequently */
        }
        return new Buffer('0000', 'hex');
      };
      mmu.getOBJ = function(obj_number) {
        if (obj_number === 0) {
          // Chrcode 0x03 not valid, LCD will assume 0x02
          return {y: 17, x: 16, chrCode: 0x03, attr: 0x00}; /* top: 1px, left: 8px */
        }
      };
      mmu.readBGData = (any) => new Buffer('0000', 'hex');
      mmu.getBgCharCode = (any) => 0x00;

      lcd.drawTiles();

      for(let l = 1; l < 17; l++){
        if (l < 9)
          lcd.assertLinePixels(l, 1, lcd.SHADES[1]);
        else
          lcd.assertLinePixels(l, 1, lcd.SHADES[2]);
      }
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
      mmu.getBgCharCode = (any) => { return 0x00; };

      lcd.drawTiles();

      for(let x = 0; x < lcd._H_TILES; x++){
        for(let y = 0; y < lcd._V_TILES; y++){
          if (x === 0 && y === 0){
            lcd.assertDarkestTile(x, y);
          } else {
            lcd.assertLightestTile(x, y);
          }
        }
      }
    });

    it('should detect transparency on OBJ', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = () => { return new Buffer('ffff', 'hex'); };
      mmu.readOBJData = () => { return new Buffer('0000', 'hex'); };
      mmu.getOBJ = () => { return {y: 16, x: 8, chrCode: 0x00, attr: 0x00}; };
      mmu.getBgCharCode = () => { return 0x00; };
      mmu.obg0 = () => { return 0b11100100; };

      lcd.drawTiles();

      // Everything must be darkest, as the OBJ is all transparent
      lcd.assertDarkestTile(0, 0);
    });

    it('should not paint pixels 00 from OBJ regardless of their palette', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = () => { return new Buffer('ffff', 'hex'); };
      mmu.readOBJData = () => { return new Buffer('0000', 'hex'); };
      mmu.getOBJ = () => { return {y: 16, x: 8, chrCode: 0x00, attr: 0x00}; };
      mmu.getBgCharCode = () => { return 0x00; };
      mmu.obg0 = () => { return 0b11111111; }; // force lightest level bit0,1 to darkest

      lcd.drawTiles();

      // Still, no OBJ is painted as the buffer is zero
      lcd.assertDarkestTile(0, 0);
    });

    it('should transform palettes to intensity array', () => {
      assert.deepEqual(LCD.paletteToArray(0b11100100), [0, 1, 2, 3]);
      assert.deepEqual(LCD.paletteToArray(0b00000000), [0, 0, 0, 0]);
      assert.deepEqual(LCD.paletteToArray(0b11111111), [3, 3, 3, 3]);
    });

    it('should detect palette on OBJ', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = () => new Buffer('0000', 'hex');
      mmu.readOBJData = () => new Buffer('ff00', 'hex');
      mmu.getBgCharCode = () => 0x00;
      mmu.getOBJ = () => { return {y: 16, x: 8, chrCode: 0x00, attr: 0x00}; };
      mmu.obg0 = () => 0b00000000;

      lcd.drawTiles();

      lcd.assertTile(0, 0, lcd.SHADES[0]);

      // Use OBG1
      mmu.getOBJ = () => { return {y: 16, x: 8, chrCode: 0x00, attr: 0b00010000/* obg1 */}; };
      mmu.obg1 = () => 0b00000100;

      lcd.drawTiles();

      lcd.assertTile(0, 0, lcd.SHADES[1]);

      mmu.obg1 = () => 0b00001000;

      lcd.drawTiles();

      lcd.assertTile(0, 0, lcd.SHADES[2]);

      mmu.obg1 = () => 0b00001100;

      lcd.drawTiles();

      lcd.assertTile(0, 0, lcd.SHADES[3]);
    });

    it('should flip OBJ horizontally', () => {
      const mmu = lcd.getMMU();
      mmu.getBgCharCode = (any) => { return 0; };
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
            assert.deepEqual(lcd.getPixelData(x, y), lcd.SHADES[0], 'Left half is transparent');
          } else {
            assert.deepEqual(lcd.getPixelData(x, y), lcd.SHADES[3], 'Right half is darkest');
          }
        }
      }

    });

    it('should flip OBJ vertically', () => {
      const mmu = lcd.getMMU();
      mmu.getBgCharCode = (any) => { return 0; };
      mmu.readBGData = (any) => { return new Buffer('0000', 'hex'); };
      mmu.getOBJ = (n) => {
        if ( n === 0 ){
          return {y: 16, x: 8, chrCode: 0x00, attr: 0b01000000 /* vertical flip */};
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
            assert.deepEqual(lcd.getPixelData(x, y), lcd.SHADES[0], 'Top half is transparent');
          } else {
            assert.deepEqual(lcd.getPixelData(x, y), lcd.SHADES[3], 'Bottom half is darkest');
          }
        }
      }
    });

    it('should flip OBJ horizontally and vertically', () => {
      const mmu = lcd.getMMU();
      mmu.getBgCharCode = (any) => { return 0; };
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
            assert.deepEqual(lcd.getPixelData(x, y), lcd.SHADES[3], 'Bottom-right most pixel is darkest');
          } else {
            assert.deepEqual(lcd.getPixelData(x, y), lcd.SHADES[0], `${x},${y} is transparent`);
          }
        }
      }

    });

    it('should flip double OBJ (8x16) vertically', () => {
      /* 0   1.......      .......1
         1   ........      ........
                      -->
         15  .......1      1.......
       */
      const mmu = lcd.getMMU();
      mmu.areOBJDouble = () => true;
      mmu.getBgCharCode = (any) => 0;
      mmu.readBGData = (any) => new Buffer('0000', 'hex');
      mmu.getOBJ = (n) => {
        if ( n === 0 ){
          return {y: 16, x: 8, chrCode: 0x02, attr: 0b01000000 /* vertical flip */};
        }
      };
      mmu.readOBJData = (tileNumber, tileLine) => {
        switch(tileNumber) {
          case 2:
            if (tileLine === 0) return new Buffer('8000', 'hex'); // top-left pixel
            return new Buffer('0000', 'hex');
          case 3:
            if (tileLine === 7) return new Buffer('0100', 'hex'); // bottom-right pixel
            return new Buffer('0000', 'hex');
        }
      };

      lcd.drawTiles();

      for(let x = 0; x < 8; x++){
        for(let y = 0; y < 8; y++){
          if ( (x === 7 && y === 0) || (x === 0 && y === 15)) {
            assert.deepEqual(lcd.getPixelData(x, y), lcd.SHADES[1]);
          } else {
            assert.deepEqual(lcd.getPixelData(x, y), lcd.SHADES[0]);
          }
        }
      }
    });

    it('should support OBJ priority flag', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = (any) => Buffer('ffff', 'hex');
      mmu.readOBJData = (any) => new Buffer('ff00', 'hex');
      mmu.getBgCharCode = (any) => 0;
      mmu.getOBJ = (any) => { return {y: 16, x: 8, chrCode: 0x00, attr: 0b00000000}; };
      mmu.obg0 = () => 0b11100100;

      lcd.drawTiles();

      lcd.assertTile(0, 0, lcd.SHADES[1]);

      // Priority flag: BG over OBJ
      mmu.getOBJ = (any) => { return {y: 16, x: 8, chrCode: 0x00, attr: 0b10000000/* bg priority */}; };

      lcd.drawTiles();

      lcd.assertDarkestTile(0, 0);
    });

    it('should support OBJ priority flag with different background palettes', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = (any) => new Buffer('5533', 'hex'); // 0,1,2,3,0,1,2,3
      mmu.readOBJData = (any) => new Buffer('ff00', 'hex'); // 1,1,1,1,1,1,1,1
      mmu.getBgCharCode = (any) => 0;
      mmu.getOBJ = (n) => { return {y: 16, x: 8, chrCode: 0x00, attr: 0b10000000 /* bg priority */}; };
      mmu.obp0 = () => 0b11100100;

      mmu.bgp = () => 0b00000000;

      mmu.areOBJOn = () => false;
      lcd.drawLine(0);

      assert.deepEqual(Array.from(lcd.getPixelData(0, 0)), lcd.SHADES[0]);
      assert.deepEqual(Array.from(lcd.getPixelData(1, 0)), lcd.SHADES[0]);
      assert.deepEqual(Array.from(lcd.getPixelData(2, 0)), lcd.SHADES[0]);
      assert.deepEqual(Array.from(lcd.getPixelData(3, 0)), lcd.SHADES[0]);

      mmu.areOBJOn = () => true;
      lcd.drawLine(0);

      assert.deepEqual(Array.from(lcd.getPixelData(0, 0)), lcd.SHADES[1]);
      assert.deepEqual(Array.from(lcd.getPixelData(1, 0)), lcd.SHADES[1]);
      assert.deepEqual(Array.from(lcd.getPixelData(2, 0)), lcd.SHADES[1]);
      assert.deepEqual(Array.from(lcd.getPixelData(3, 0)), lcd.SHADES[1]);

      mmu.bgp = () => 0b00000001;

      mmu.areOBJOn = () => false;
      lcd.drawLine(0);

      assert.deepEqual(Array.from(lcd.getPixelData(0, 0)), lcd.SHADES[1]);
      assert.deepEqual(Array.from(lcd.getPixelData(1, 0)), lcd.SHADES[0]);
      assert.deepEqual(Array.from(lcd.getPixelData(2, 0)), lcd.SHADES[0]);
      assert.deepEqual(Array.from(lcd.getPixelData(3, 0)), lcd.SHADES[0]);

      mmu.areOBJOn = () => true;
      lcd.drawLine(0);

      assert.deepEqual(Array.from(lcd.getPixelData(0, 0)), lcd.SHADES[1]);
      assert.deepEqual(Array.from(lcd.getPixelData(1, 0)), lcd.SHADES[0]);
      assert.deepEqual(Array.from(lcd.getPixelData(2, 0)), lcd.SHADES[0]);
      assert.deepEqual(Array.from(lcd.getPixelData(3, 0)), lcd.SHADES[0]);

      mmu.bgp = () => 0b00000010;

      mmu.areOBJOn = () => false;
      lcd.drawLine(0);

      assert.deepEqual(Array.from(lcd.getPixelData(0, 0)), lcd.SHADES[2]);
      assert.deepEqual(Array.from(lcd.getPixelData(1, 0)), lcd.SHADES[0]);
      assert.deepEqual(Array.from(lcd.getPixelData(2, 0)), lcd.SHADES[0]);
      assert.deepEqual(Array.from(lcd.getPixelData(3, 0)), lcd.SHADES[0]);

      mmu.areOBJOn = () => true;
      lcd.drawLine(0);

      assert.deepEqual(Array.from(lcd.getPixelData(0, 0)), lcd.SHADES[1]);
      assert.deepEqual(Array.from(lcd.getPixelData(1, 0)), lcd.SHADES[0]);
      assert.deepEqual(Array.from(lcd.getPixelData(2, 0)), lcd.SHADES[0]);
      assert.deepEqual(Array.from(lcd.getPixelData(3, 0)), lcd.SHADES[0]);

      mmu.bgp = () => 0b00000011;

      mmu.areOBJOn = () => false;
      lcd.drawLine(0);

      assert.deepEqual(Array.from(lcd.getPixelData(0, 0)), lcd.SHADES[3]);
      assert.deepEqual(Array.from(lcd.getPixelData(1, 0)), lcd.SHADES[0]);
      assert.deepEqual(Array.from(lcd.getPixelData(2, 0)), lcd.SHADES[0]);
      assert.deepEqual(Array.from(lcd.getPixelData(3, 0)), lcd.SHADES[0]);

      mmu.areOBJOn = () => true;
      lcd.drawLine(0);

      assert.deepEqual(Array.from(lcd.getPixelData(0, 0)), lcd.SHADES[1]);
      assert.deepEqual(Array.from(lcd.getPixelData(1, 0)), lcd.SHADES[0]);
      assert.deepEqual(Array.from(lcd.getPixelData(2, 0)), lcd.SHADES[0]);
      assert.deepEqual(Array.from(lcd.getPixelData(3, 0)), lcd.SHADES[0]);
    });

    it('should support OBJ priority flag when obj are in boundaries', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = (tileNumber, tileLine) => {
        if (tileLine === 0){
          return new Buffer('ff00', 'hex');
        } else {
          return new Buffer('0000', 'hex');
        }
      };
      mmu.readOBJData = (n) => {
        if (n === 0)
          return new Buffer('ff00', 'hex');
        else
          return new Buffer('0000', 'hex');
      };
      mmu.getBgCharCode = (gridX, gridY) => {
        if (gridX < 0 || gridX > 0x1f || gridY < 0 || gridY > 0x1f) {
          throw new Error();
        }
        return 0;
      };
      mmu.areOBJOn = () => true;
      /* only 2 last lines of obj will be shown, rest is out of screen */
      mmu.getOBJ = (any) => { return {y: 10, x: 8, chrCode: 0, attr: 0b10000000 /* bg priority */}; };

      lcd.drawLine(0);
      lcd.drawLine(1);

      lcd.assertLinePixels(0, 0, lcd.SHADES[1]);
      lcd.assertLinePixels(1, 0, lcd.SHADES[1]); // BG is lightest, paint OBJ
    });

    it('should display an OBJ with a priority flag only if the BG behind is lightest', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = (any) => new Buffer('0000', 'hex'); // lightest background
      mmu.readOBJData = (any) => new Buffer('ff00', 'hex');
      mmu.getBgCharCode = () => 0;
      mmu.getOBJ = (n) => {
        if (n === 0) {
          return {y: 16, x: 8, chrCode: 0x00, attr: 0b10000000 /* bg priority */};
        } else {
          return {y: 0, x: 0};
        }
      };
      mmu.obg0 = () => 0b11100100;

      lcd.drawTiles();

      lcd.assertTile(0, 0, lcd.SHADES[1]);

      // Test now if the background has been shifted with SCX, SCY
      // 1 dark pixel at x=0 y=0
      mmu.readBGData = (tileNumber, tileLine) => {
        switch(tileNumber){
          case 0:
            if (tileLine === 0){
              return new Buffer('8080', 'hex');
            } else {
              return new Buffer('0000', 'hex');
            }
          case 1:
            return new Buffer('0000', 'hex');
        }
      };
      mmu.getBgCharCode = (gridX, gridY) => {
        if (gridX === 0 && gridY === 0) return 0;
        return 1;
      };

      lcd.drawTiles();

      // OBJ pixels should not be painted when background is not the lightest
      for (let x = 0; x < 8; x++){
        let value = lcd.SHADES[1];
        if (x === 0) value = lcd.SHADES[3];
        assert.deepEqual(Array.from(lcd.getPixelData(x, 0)), value, `${x},0`);
      }
      lcd.assertLinePixels(1, 0, lcd.SHADES[1]);
      lcd.assertLinePixels(2, 0, lcd.SHADES[1]);
      lcd.assertLinePixels(3, 0, lcd.SHADES[1]);
      lcd.assertLinePixels(4, 0, lcd.SHADES[1]);
      lcd.assertLinePixels(5, 0, lcd.SHADES[1]);
      lcd.assertLinePixels(6, 0, lcd.SHADES[1]);
      lcd.assertLinePixels(7, 0, lcd.SHADES[1]);

      mmu.scx = () => 1;
      mmu.scy = () => 1;

      lcd.drawTiles();

      // OBJ should be painted
      lcd.assertTile(0, 0, lcd.SHADES[1]);
    });

    it('should display an OBJ with a priority flag only if the BG behind is lightest + SCX and SCX', () => {
      const mmu = lcd.getMMU();
      mmu.readOBJData = (any) => new Buffer('ff00', 'hex');
      mmu.getOBJ = (n) => {
        if (n === 0) {
          return {y: 16, x: 8, chrCode: 0x00, attr: 0b10000000 /* bg priority */};
        } else {
          return {y: 0, x: 0};
        }
      };
      mmu.obg0 = () => 0b11100100;
      mmu.readBGData = (tileNumber, tileLine) => {
        switch(tileNumber){
          case 0:
            if (tileLine === 0){
              return new Buffer('8080', 'hex');
            } else {
              return new Buffer('0000', 'hex'); // lightest background
            }
          case 1:
            return new Buffer('0000', 'hex');
        }
      };
      mmu.getBgCharCode = (gridX, gridY) => {
        if (gridX === 0 && gridY === 0) return 0;
        return 1;
      };

      // pixel should move from 0,0 to 1,1
      mmu.scx = () => 0xff;
      mmu.scy = () => 0xff;

      lcd.drawLine(0);
      lcd.drawLine(1);
      lcd.drawLine(2);

      lcd.assertLinePixels(0, 0, lcd.SHADES[1]);
      for (let x = 0; x < 8; x++){
        if (x === 1)
          assert.deepEqual(Array.from(lcd.getPixelData(x, 1)), lcd.SHADES[3], `${x},1`);
        else
          assert.deepEqual(Array.from(lcd.getPixelData(x, 1)), lcd.SHADES[1], `${x},1`);
      }
      lcd.assertLinePixels(2, 0, lcd.SHADES[1]);
    });
  });

  describe('Window', () => {
    it('should draw a Window line', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = (tileNumber) => {
        if (tileNumber === 0) {
          return new Buffer('ff00', 'hex'); // window
        } else {
          return new Buffer('0000', 'hex'); // bg
        }
      };
      mmu.getBgCharCode = () => 1;
      mmu.getWindowCharCode = () => 0;
      mmu.isWindowOn = () => true;
      mmu.wy = () => 0;
      mmu.wx = () => 7;

      lcd.drawLine(0);

      assert.deepEqual(Array.from(lcd.getLineData(0)), Array.from(lcd.generateLineData(1)));

      mmu.isWindowOn = () => false;
      lcd.drawLine(0);

      assert.deepEqual(Array.from(lcd.getLineData(0)), Array.from(lcd.generateLineData(0)));
    });

    it('should draw a Window line when WY > 0', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = (tileNumber) => {
        if (tileNumber === 0) {
          return new Buffer('ff00', 'hex');
        } else {
          return new Buffer('0000', 'hex');
        }
      };
      mmu.getBgCharCode = () => 1;
      mmu.getWindowCharCode = () => 0;
      mmu.isWindowOn = () => true;
      mmu.wy = () => 10; // Move window 10px down
      mmu.wx = () => 7;

      lcd.drawLine(0);
      lcd.drawLine(10);

      assert.deepEqual(Array.from(lcd.getLineData(0)), Array.from(lcd.generateLineData(0)));
      assert.deepEqual(Array.from(lcd.getLineData(10)), Array.from(lcd.generateLineData(1)));

      // Test that WX < 7 (prohibited values) as considered as WX = 7
      mmu.wx = () => 6;
      lcd.drawLine(10);

      assert.deepEqual(Array.from(lcd.getLineData(10)), Array.from(lcd.generateLineData(1)));

      mmu.wx = () => 0;
      lcd.drawLine(10);

      assert.deepEqual(Array.from(lcd.getLineData(10)), Array.from(lcd.generateLineData(1)));
    });

    it('should draw a Window line when WX > 7', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = (tileNumber) => {
        if (tileNumber === 0) {
          return new Buffer('ff00', 'hex');
        } else {
          return new Buffer('0000', 'hex');
        }
      };
      mmu.getBgCharCode = () => 1;
      mmu.getWindowCharCode = () => 0;
      mmu.isWindowOn = () => true;
      mmu.wy = () => 0;
      mmu.wx = () => 17; // move right 10px

      const expectedData = new Uint8ClampedArray(lineRgbaLength);
      for(let p = 0; p < expectedData.length; p++) {
        if (p >= 10*4) {
          expectedData[p] = lcd._bgp[1][p % 4];
        } else {
          expectedData[p] = lcd._bgp[0][p % 4];
        }
      }

      lcd.drawLine(0);

      assert.deepEqual(Array.from(lcd.getLineData(0)), Array.from(expectedData));
    });

    it('should draw a Window line as long as WX < 167', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = (tileNumber) => {
        if (tileNumber === 0) {
          return new Buffer('ff00', 'hex');
        } else {
          return new Buffer('0000', 'hex');
        }
      };
      mmu.getBgCharCode = () => 1;
      mmu.getWindowCharCode = () => 0;
      mmu.isWindowOn = () => true;
      mmu.wy = () => 0;
      mmu.wx = () => 166; // move right 159px, only one visible pixel

      const expectedData = lcd.generateLineData(0);
      expectedData[lineRgbaLength-4] = lcd._bgp[1][0];
      expectedData[lineRgbaLength-3] = lcd._bgp[1][1];
      expectedData[lineRgbaLength-2] = lcd._bgp[1][2];
      expectedData[lineRgbaLength-1] = lcd._bgp[1][3];

      lcd.drawLine(0);

      assert.deepEqual(Array.from(lcd.getLineData(0)), Array.from(expectedData));
    });

    it('should not draw a Window line when WX > 166', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = (tileNumber) => new Buffer('0000', 'hex');
      mmu.getWindowCharCode = () => 0;
      mmu.isWindowOn = () => true;
      mmu.wy = () => 0;
      mmu.wx = () => 167; // move right 160px, invisible window

      lcd.drawLine(0);

      assert.deepEqual(Array.from(lcd.getLineData(0)), Array.from(lcd.generateLineData(0)));
    });

    it('should draw objects on top of window, window on top of background', () => {
      const mmu = lcd.getMMU();
      mmu.readBGData = (tileNumber) => {
        if (tileNumber === 0) {
          return new Buffer('00ff', 'hex'); // window
        } else {
          return new Buffer('ff00', 'hex'); // background
        }
      };
      mmu.readOBJData = (any) => new Buffer('ffff', 'hex'); // obj
      mmu.getOBJ = (any) => { return {y: 16, x: 8, chrCode: 1, attr: 0}; };
      mmu.getBgCharCode = () => 1;
      mmu.getWindowCharCode = () => 0;
      mmu.wy = () => 0;
      mmu.wx = () => 7;

      mmu.isWindowOn = () => false;
      mmu.areOBJOn = () => false;

      lcd.drawTiles();

      lcd.assertTile(0, 0, lcd.SHADES[1]); // background

      mmu.isWindowOn = () => true;
      lcd.drawTiles();

      lcd.assertTile(0, 0, lcd.SHADES[2]); // window

      mmu.areOBJOn = () => true;
      lcd.drawTiles();

      lcd.assertTile(0, 0, lcd.SHADES[3]); // objects
    });
  });

  describe('CGB palettes', () => {
    it('should convert 15-bit RGB to 32-bit RGBA', () => {
      assert.deepEqual(LCD.RGB15toRGBA32([0, 0, 0]), [0, 0, 0, 255]);
      assert.deepEqual(LCD.RGB15toRGBA32([0x0f, 0x0f, 0x0f]), [120, 120, 120, 255]);
      assert.deepEqual(LCD.RGB15toRGBA32([0x1f, 0x1f, 0x1f]), [248, 248, 248, 255]);
    });

    it('should paint coloured pixels on a line', () => {
      lcd._IS_COLOUR = true;
      const mmu = lcd.getMMU();
      mmu.getBgCharCode = () => 0;
      mmu.readBGData = () => new Buffer('5533', 'hex'); // 0,1,2,3,0,1,2,3
      mmu.getBgPaletteNb = () => 0;
      mmu.getBgPalette = (paletteNb) => { return [[0x1f,0,0], [0,0x1f,0], [0,0,0x1f], [0,0,0]]; };

      lcd.drawLine(0);

      assert.deepEqual(Array.from(lcd.getPixelData(0, 0)), [248, 0, 0, 255]); // 0 is red
      assert.deepEqual(Array.from(lcd.getPixelData(1, 0)), [0, 248, 0, 255]); // 1 is green
      assert.deepEqual(Array.from(lcd.getPixelData(2, 0)), [0, 0, 248, 255]); // 2 is blue
      assert.deepEqual(Array.from(lcd.getPixelData(3, 0)), [0, 0, 0, 255]); // 3 is black
    });
  });

});
