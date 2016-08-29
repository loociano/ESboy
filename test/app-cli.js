import CPU from '../lib/cpu';
import ContextMock from '../lib/mock/contextMock';
import config from '../lib/config';

config.DEBUG = true;

new CPU(process.argv[2], new ContextMock()).start();