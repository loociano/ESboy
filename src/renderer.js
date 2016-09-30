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

/**
 * Handles file selection
 * @param evt
 */
function handleFileSelect(evt) {

  const file = evt.target.files[0]; // FileList object

  const reader = new FileReader();

  reader.onload = function(event){

    $cartridge.blur();

    const readOnlyBuffer = event.target.result;
    const rom = new Uint8Array(readOnlyBuffer);
    init(rom);
  };

  if (file) reader.readAsArrayBuffer(file);
}

/**
 * @param {Uint8Array} rom
 */
function init(rom){
  const mmu = new MMU(rom);

  new InputHandler(mmu, $body);
  const lcd = new LCD(mmu, ctxBG, ctxOBJ, 160, 144);

  cpu = new CPU(mmu, lcd);

  window.requestAnimationFrame(frame);
}

/**
 * Main loop
 */
function frame(){
  cpu.start();
  window.requestAnimationFrame(frame);
}

$cartridge.addEventListener('change', handleFileSelect, false);
$cartridge.addEventListener('click', function(evt){
  this.value = null;
}, false);