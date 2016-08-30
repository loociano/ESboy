import CPU from './cpu';
import ContextMock from '../lib/mock/contextMock';
import config from './config';

// Options
for(let i = 0; i < process.argv.length; i++){
    const option = process.argv[i];
    if (option === '--debug'){
        config.DEBUG = true;
    }
}

const date = new Date();
new CPU(process.argv[2], new ContextMock()).start();

console.log(`Took: ${new Date() - date} millis`);