import {ipcRenderer} from 'electron';
import CPU from './cpu';

let cpu;

ipcRenderer.on('start-cpu', (event, {filename, imageData}) => {
  cpu = new CPU(filename, ipcRenderer, imageData).start(0x100);
});

ipcRenderer.send('bg-ready');