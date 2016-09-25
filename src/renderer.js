import CPU from './cpu';
import MMU from './mmu';
import LCD from './lcd';
import InputHandler from './inputHandler';

function handleFileSelect(evt) {

  const file = evt.target.files[0]; // FileList object

  const reader = new FileReader();

  reader.onload = function(event){

    const readOnlyBuffer = event.target.result;
    const rom = new Uint8Array(readOnlyBuffer);
    start(rom);
  };

  reader.readAsArrayBuffer(file);
}

function start(rom){
  const mmu = new MMU(rom);

  const input = new InputHandler(mmu, document.querySelector('body'));
  const ctxBG = document.getElementById('bg').getContext('2d');
  const ctxOBJ = document.getElementById('obj').getContext('2d');

  const lcd = new LCD(mmu, ctxBG, ctxOBJ, 160, 144);

  const cpu = new CPU(mmu, lcd);
  cpu.start();
}

document.getElementById('files').addEventListener('change', handleFileSelect, false);