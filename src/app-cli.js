import CPU from './cpu';
import MMU from './mmu';
import IPCMock from '../lib/mock/ipcMock';
import config from './config';
import Logger from './logger';

// Options
for(let i = 0; i < process.argv.length; i++){
    const option = process.argv[i];
    if (option === '--debug'){
      config.DEBUG = true;
    }
    if (option === '--log-bios'){
      config.LOG_BIOS = true;
    }
}

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

init(process.argv[2]);