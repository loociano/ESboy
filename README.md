# ESboy – GAME BOY&trade; emulator [![Build Status](https://travis-ci.org/loociano/ESboy.svg?branch=master)](https://travis-ci.org/loociano/gb-ES6)

![Tetris DX running on Chrome](https://github.com/loociano/ESboy/blob/master/screenshots/2017-02-09%2020_06_20-ESboy.png?raw=true)

GAME BOY&trade; running in your browser. [Compatibility List](https://docs.google.com/spreadsheets/d/1CgXEuxLsH0WPpqzlgMZeTv59cBfNzp4G4MW6Z1QpTD0)

Goal of this project is to write the GAME BOY&trade; CPU and rest of controllers (memory, gpu, timers, i/o etc) from scratch using ECMAScript 6, [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) and [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API).

## Play 

* [Try it online!](http://esboy.loociano.com) 
* Offline: clone/download this repository and open `index.html` in your browser.

### Hardware accuracy 

#### Blargg's CPU instructions tests:

| Test          | Result|  
| ------------- |--------------|
| Blargg test 1 | ✓|
| Blargg test 2 | ✓     |
| Blargg test 3 | ✓     |
| Blargg test 4 | ✓     |
| Blargg test 5 | ✓     |
| Blargg test 6 | ✓     |
| Blargg test 7 | ✓    |
| Blargg test 8 | ✓     |
| Blargg test 9 | ✓     |
| Blargg test 10| ✓     |
| Blargg test 11| ✓     |

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

## License

GNU GPLv3 License.

## References

* [Game Boy Programming Manual](http://www.romhacking.net/documents/544/)
* [Gameboy LR35902 opcodes](http://www.pastraiser.com/cpu/gameboy/gameboy_opcodes.html)
* [Gameboy CPU Manual](http://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf)
* [Pan docs](http://bgb.bircd.org/pandocs.htm)
* [awesome-gbdev repository](https://github.com/avivace/awesome-gbdev)
* [Imran Nazar's Gameboy Emulation in JavaScript](http://imrannazar.com/GameBoy-Emulation-in-JavaScript)
* [gbdev.gg8.se](http://gbdev.gg8.se/)
