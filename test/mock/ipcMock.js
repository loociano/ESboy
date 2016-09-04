export default class IPCMock {

  send(message){
    switch(message){
      case 'paint-frame':
        this.mockPaint();
        break;
      case 'end':
        break;
    }
  }

  setCpu(cpu){
    this.cpu = cpu;
  }

  mockPaint(){
    if (this.cpu) {
      this.cpu.isPainting = false;
    }
  }

}