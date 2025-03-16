const inference = require('./src/lib/Waifu2x');

// Inisialisasi
inference.initializeInference(progress => console.log(`Progress: ${progress}`), {
  taggerModelPath: './custom/tagger.onnx',
  chunkSize: 512,
}).then(async () => {
  // Proses gambar biasa
  const imageURI = 'test.jpg';
  const result = await inference.upscaleFromURI('jpg', tags => console.log(tags), imageURI, 2);
  console.log(result);

  // Proses GIF
//   const gifURI = 'path/to/image.gif';
//   const gifResult = await inference.upscaleFromURI('gif', tags => console.log(tags), gifURI, 1);
//   console.log(gifResult);
});