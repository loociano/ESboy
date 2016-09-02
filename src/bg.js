import {ipcRenderer} from 'electron';

// In renderer process (web page).
ipcRenderer.on('asynchronous-reply', (event, arg) => {
  alert(arg); // prints "pong"
});
ipcRenderer.send('asynchronous-message', 'ping');