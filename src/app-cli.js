import CPU from './cpu';
import MMU from './mmu';
import IPCMock from '../lib/mock/ipcMock';
import config from './config';
import Logger from './logger';
import commandLineArgs from 'command-line-args';

const optionDefinitions = [
  { name: 'input-rom', alias: 'i', type: String },
  { name: 'debug', alias: 'D', type: Boolean },
  { name: 'log-bios', type: Boolean }
];

const options = commandLineArgs(optionDefinitions);

config.DEBUG = options.debug;
config.LOG_BIOS = options['log-bios'];

function init(filename){

  if (!filename) throw new Error('Missing filename');

  const date = new Date();

  const mmu = new MMU(filename);
  const ipc = new IPCMock();
  const cpu = new CPU(mmu, ipc);
  ipc.setCpu(cpu);

  try {
    while(true) {
      cpu.start();
    }
  } catch(e){
    Logger.error(e);
  }

  console.log(`Took: ${new Date() - date} millis`);
}

init(options['input-rom']);