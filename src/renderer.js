import CPU from './cpu';
import MMU from './mmu';
import LCD from './lcd';
import InputHandler from './inputHandler';
import GameRequester from './gameRequester';
import BrowserStorage from './browserStorage';

// Cache DOM references
const $cartridge = document.getElementById('cartridge');
const $body = document.querySelector('body');
const $ctx = document.getElementById('screen').getContext('2d');
const $title = document.querySelector('title');
const $games = document.querySelectorAll('#games > li');

// Constants
const MAX_FPS = 60;
const INTERVAL = 1000/MAX_FPS;

let now;
let then = Date.now();
let delta;
let frames = 0;
let ref = then;
let cpu, mmu;
const gameRequester = new GameRequester();

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
    init(event.target.result);
  };

  if (file) {
    reader.readAsArrayBuffer(file);
    ga('send', 'event', 'Emulator', 'load', file.name);
  }
}

/**
 * @param {ArrayBuffer} arrayBuffer
 */
function init(arrayBuffer){
  mmu = new MMU(new Uint8Array(arrayBuffer), new BrowserStorage(window.localStorage));
  let bootstrap = true;
  if (!mmu.isCartridgeSupported()){
    bootstrap = window.confirm('This game is not supported. Do you want to continue? Your browser may crash.');
  }
  if (bootstrap) {
    const lcd = new LCD(mmu, $ctx);
    cpu = new CPU(mmu, lcd);
    new InputHandler(cpu, $body);
    frame();
  }
}

/**
 * Main loop
 */
function frame(){
  try {
    window.requestAnimationFrame(frame);
    now = Date.now();
    delta = now - then;

    if (delta > INTERVAL) {
      // fps limitation logic, Kindly borrowed from Rishabh
      // http://codetheory.in/controlling-the-frame-rate-with-requestanimationframe
      then = now - (delta % INTERVAL);
      if (++frames > MAX_FPS) {
        updateTitle(Math.floor(frames * 1000 / (new Date() - ref) / 60 * 100));
        frames = 0;
        ref = new Date();
      }
      cpu.frame();
      cpu.paint();
    }
  } catch(e){
    console.error(e.stack);
  }
}

function updateTitle(speed){
  $title.innerText = `gb-ES6 ${speed}%`;
}

function saveGame(){
  if (mmu) mmu.flushExtRamToStorage();
}

function attachListeners() {
  for (let $game of $games) {
    $game.addEventListener('click', function (evt) {
      gameRequester.request($game.innerText, init);
    });
  }

  $cartridge.addEventListener('change', handleFileSelect, false);
  $cartridge.addEventListener('click', function(evt){
    this.value = null; // reset chosen file
    saveGame();
  }, false);

  window.addEventListener('unload', saveGame); // user closes tab or window
}

attachListeners();

gameRequester.request('load-game', init);