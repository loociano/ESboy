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
}

const filename = process.argv[2];
const mmu = new MMU(filename);
const ipc = new IPCMock();

const date = new Date();
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