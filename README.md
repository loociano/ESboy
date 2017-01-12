# Game Boy emulator in ECMAScript 6 [![Build Status](https://travis-ci.org/loociano/gb-ES6.svg?branch=master)](https://travis-ci.org/loociano/gb-ES6)

GAME BOY&trade; running in your browser. [Compatibility List](https://github.com/loociano/gb-ES6/wiki/Compatibility-List)

Goal of this project is to write the GAME BOY&trade; CPU and rest of controllers (memory, gpu, timers, i/o etc) from scratch using ECMAScript 6, [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) and [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API).

### Progress

* CPU: all instructions are implemented. To test more HALT and STOP.
* MMU: basic RAM usage and Memory Bank Controller 1 (MBC1) implemented. To work on MBC3, MBC5 and additional RAM.
* PPU: background and sprites are drawn. Vertical/horizontal background scrolling.
* I/O: buttons implemented.
* Sound: to work on.

## Play 

* Online: Try it on http://loociano.github.io/gb-ES6
* Offline: clone/download this repository and open `index.html` in your browser.

## Develop

### Build

* ``npm install``
* ``npm run build``

### Run all tests

``npm test``

### Run 

Open `index.html`.

### Run in console without a browser:

`npm run cli -- -i <rom file> --debug`

### License

GNU GPLv3 License.

### References

* [Game Boy Programming Manual](http://www.romhacking.net/documents/544/)
* [Gameboy LR35902 opcodes](http://www.pastraiser.com/cpu/gameboy/gameboy_opcodes.html)
* [Gameboy CPU Manual](http://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf)
* [Pan docs](http://bgb.bircd.org/pandocs.htm)
* [awesome-gbdev repository](https://github.com/avivace/awesome-gbdev)
* [Imran Nazar's Gameboy Emulation in JavaScript](http://imrannazar.com/GameBoy-Emulation-in-JavaScript)
* [gbdev.gg8.se](http://gbdev.gg8.se/)
