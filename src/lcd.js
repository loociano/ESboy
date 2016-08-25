export default class LCD {

  constructor(ctx, width, height){
    this.ctx = ctx;
    this.width = width;
    this.height = height;

    this.imageData = ctx.createImageData(width, height);
  }

  drawPixel (x, y, r, g, b, a) {
    var index = (x + y * this.width) * 4;
    this.imageData.data[index + 0] = r;
    this.imageData.data[index + 1] = g;
    this.imageData.data[index + 2] = b;
    this.imageData.data[index + 3] = a;
    ctx.putImageData(this.imageData, 0, 0);
  }
}