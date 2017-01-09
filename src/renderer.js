import CPU from './cpu';
import MMU from './mmu';
import LCD from './lcd';
import InputHandler from './inputHandler';

// Cache DOM references
const $cartridge = document.getElementById('cartridge');
const $body = document.querySelector('body');
const ctxBG = document.getElementById('bg').getContext('2d');
const ctxOBJ = document.getElementById('obj').getContext('2d');
let cpu;

const MAX_FPS = 60;
let now;
let then = Date.now();
let interval = 1000/MAX_FPS;
let delta;

/**
 * Handles file selection
 * @param evt
 */
function handleFileSelect(evt) {

  ga('send', 'event', 'UI', 'click', 'load game');

  const file = evt.target.files[0]; // FileList object

  const reader = new FileReader();

  reader.onload = function(event){

    $cartridge.blur();

    const readOnlyBuffer = event.target.result;
    const rom = new Uint8Array(readOnlyBuffer);
    init(rom);
  };

  if (file) {
    reader.readAsArrayBuffer(file);
    ga('send', 'event', 'Emulator', 'load', file.name);
  }
}

/**
 * @param {Uint8Array} rom
 */
function init(rom){
  const mmu = new MMU(rom);
  const lcd = new LCD(mmu, ctxBG, ctxOBJ);

  cpu = new CPU(mmu, lcd);
  new InputHandler(cpu, $body);

  frame();
}

/**
 * Main loop
 */
function frame(){
  window.requestAnimationFrame(frame);
  now = Date.now();
  delta = now - then;

  if (delta > interval) {
    // fps limitation logic, Kindly borrowed from Rishabh
    // http://codetheory.in/controlling-the-frame-rate-with-requestanimationframe
    then = now - (delta % interval);
    cpu.start();
    cpu.paint();
  }
}

$cartridge.addEventListener('change', handleFileSelect, false);
$cartridge.addEventListener('click', function(evt){
  this.value = null;
}, false);