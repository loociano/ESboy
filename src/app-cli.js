import CPU from './cpu';
import ContextMock from '../lib/mock/contextMock';
import config from './config';

config.DEBUG = false;

const date = new Date();
new CPU(process.argv[2], new ContextMock()).start();

console.log(`Took: ${new Date() - date} millis`);