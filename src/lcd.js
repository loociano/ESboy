export default class LCD {

  constructor(ctx, width, height){
    this.ctx = ctx;
    this.width = width;
    this.height = height;

    this.imageData = ctx.createImageData(width, height);
  }

  drawPixel(x, y, level) {
    var index = (x + y * this.width) * 4;
    let intensity = 255;
    if (level === 1){
      intensity = 0;
    }
    this.imageData.data[index + 0] = intensity;
    this.imageData.data[index + 1] = intensity;
    this.imageData.data[index + 2] = intensity;
    this.imageData.data[index + 3] = 255;
    ctx.putImageData(this.imageData, 0, 0);
  }
}