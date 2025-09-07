// Minimal stub for 'canvas' to satisfy pdfjs optional require in server build
module.exports = {
  createCanvas: () => ({ getContext: () => null }),
  Image: function StubImage() {},
};
