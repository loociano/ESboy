# gb-ES6 – GAME BOY&trade; emulator [![Build Status](https://travis-ci.org/loociano/gb-ES6.svg?branch=master)](https://travis-ci.org/loociano/gb-ES6)

![Pokemon Blue running on Chrome](https://raw.githubusercontent.com/loociano/gb-ES6/master/screenshots/2017-01-28%2021_17_03-gb-ES6.png)

GAME BOY&trade; running in your browser. [Compatibility List](https://docs.google.com/spreadsheets/d/1CgXEuxLsH0WPpqzlgMZeTv59cBfNzp4G4MW6Z1QpTD0)

Goal of this project is to write the GAME BOY&trade; CPU and rest of controllers (memory, gpu, timers, i/o etc) from scratch using ECMAScript 6, [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) and [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API).

## Play 

* Online: Try it on http://loociano.github.io/gb-ES6
* Offline: clone/download this repository and open `index.html` in your browser.

### Hardware tests

| Test          | Result|  
| ------------- |--------------|
| Blargg test 1 | ✗ Test 6 DAA fails|
| Blargg test 2 | ✗ Fails     |
| Blargg test 3 | ✓     |
| Blargg test 4 | ✓     |
| Blargg test 5 | ✓     |
| Blargg test 6 | ✓     |
| Blargg test 7 | ✓    |
| Blargg test 8 | ✓     |
| Blargg test 9 | ✓     |
| Blargg test 10| ✓     |
| Blargg test 11| ✗ Fails 34 27     |

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
