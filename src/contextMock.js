export default class ContextMock {

  createImageData(width, height){
    return { data: new Array(width * height * 4) };
  }

  putImageData(){
    // Do nothing
  }

}