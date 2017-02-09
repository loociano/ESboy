import CPU from './cpu';
import MMU from './mmu';
import Loader from './loader';
import LCDMock from '../lib/mock/lcdMock';
import config from './config';
import Logger from './logger';
import commandLineArgs from 'command-line-args';

const optionDefinitions = [
  { name: 'input-rom', alias: 'i', type: String },
  { name: 'debug', alias: 'D', type: Boolean },
  { name: 'stop-at', type: Number }
];

const options = commandLineArgs(optionDefinitions);

config.DEBUG = options.debug;

function init(filename, stop_at=-1){

  if (!filename) throw new Error('Missing filename');

  const date = new Date();

  const loader = new Loader(filename);
  const mmu = new MMU(loader.asUint8Array());
  const cpu = new CPU(mmu, new LCDMock());

  try {
    if (stop_at === -1){
      while(true){
        cpu.frame();
      }
    } else {
      cpu.runUntil(stop_at);
    }
  } catch(e){
    Logger.error(e);
  }
  console.log(`Took: ${new Date() - date} millis`);
}

init(options['input-rom'], options['stop-at']);