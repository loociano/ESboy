import CPU from './cpu';
import ContextMock from '../lib/contextMock';
import config from './config';

config.DEBUG = true;

new CPU(process.argv[2], new ContextMock()).start(0x100);