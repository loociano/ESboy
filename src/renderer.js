import CPU from './cpu';
import MMU from './mmu';
import LCD from './lcd';
import InputHandler from './inputHandler';
import GameRequester from './gameRequester';
import BrowserStorage from './storage';

// Cache DOM references
const $cartridge = document.getElementById('cartridge');
const $body = document.querySelector('body');
const $ctxBG = document.getElementById('bg').getContext('2d');
const $ctxOBJ = document.getElementById('obj').getContext('2d');
const $ctxWindow = document.getElementById('window').getContext('2d');
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
let cpu;
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
  const mmu = new MMU(new Uint8Array(arrayBuffer), new BrowserStorage());
  const lcd = new LCD(mmu, $ctxBG, $ctxOBJ, $ctxWindow);

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

  if (delta > INTERVAL) {
    // fps limitation logic, Kindly borrowed from Rishabh
    // http://codetheory.in/controlling-the-frame-rate-with-requestanimationframe
    then = now - (delta % INTERVAL);
    if (++frames > MAX_FPS){
      updateTitle(Math.floor(frames*1000/(new Date() - ref)/60*100));
      frames = 0;
      ref = new Date();
    }
    cpu.start();
    cpu.paint();
  }
}

function updateTitle(speed){
  $title.innerText = `gb-ES6 ${speed}%`;
}

function attachListeners() {
  for (let $game of $games) {
    $game.addEventListener('click', function (evt) {
      gameRequester.request($game.innerText, init);
    });
  }

  $cartridge.addEventListener('change', handleFileSelect, false);
  $cartridge.addEventListener('click', function(evt){
    this.value = null;
  }, false);
}

attachListeners();

gameRequester.request('load-game', init);