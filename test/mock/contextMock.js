export default class ContextMock {

  createImageData(width, height){
    return {
      data: new Uint8ClampedArray(width * height * 4)
    };
  }

  putImageData(){
    // Do nothing
  }

}