const fs = require("fs");
const { tmpdir } = require("os");
const Crypto = require("crypto");
const ff = require("fluent-ffmpeg");
const webp = require("node-webpmux");
const path = require("path");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
ff.setFfmpegPath(ffmpegPath);

function generateRandomName(ext) {
  return `${Crypto.randomBytes(10).toString("hex")}${ext}`;
}

async function imageToWebp(image) {
  const tempFile = path.join(tmpdir(), generateRandomName(".webp"));
  const tempInput = path.join(tmpdir(), generateRandomName(".jpg"));
  
  try {
    fs.writeFileSync(tempInput, image);
    
    await new Promise((resolve, reject) => {
      ff(tempInput)
        .outputOptions([
          "-vf",
          "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse"
        ])
        .toFormat("webp")
        .save(tempFile)
        .on("end", () => resolve())
        .on("error", reject);
    });

    const buffer = fs.readFileSync(tempFile);
    fs.unlinkSync(tempFile);
    fs.unlinkSync(tempInput);
    return buffer;
  } catch (error) {
    try {
      fs.unlinkSync(tempFile);
      fs.unlinkSync(tempInput);
    } catch {}
    throw error;
  }
}

async function videoToWebp(video) {
  const tempFile = path.join(tmpdir(), generateRandomName(".webp"));
  const tempInput = path.join(tmpdir(), generateRandomName(".mp4"));
  
  try {
    fs.writeFileSync(tempInput, video);
    
    await new Promise((resolve, reject) => {
      ff(tempInput)
        .inputOptions(["-y", "-t", "20"])
        .outputOptions([
          "-vcodec",
          "libwebp",
          "-vf",
          "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
          "-loop",
          "0",
          "-ss",
          "00:00:00",
          "-t",
          "20",
          "-preset",
          "default",
          "-an",
          "-vsync",
          "0"
        ])
        .toFormat("webp")
        .save(tempFile)
        .on("end", () => resolve())
        .on("error", reject);
    });

    const buffer = fs.readFileSync(tempFile);
    fs.unlinkSync(tempFile);
    fs.unlinkSync(tempInput);
    return buffer;
  } catch (error) {
    try {
      fs.unlinkSync(tempFile);
      fs.unlinkSync(tempInput);
    } catch {}
    throw error;
  }
}

async function writeExifImg(image, metadata) {
  const img = new webp.Image();
  const json = { "sticker-pack-id": "OrbitStudio", "sticker-pack-name": metadata.packname, "sticker-pack-publisher": metadata.author, "emojis": metadata.categories };
  const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
  const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
  const exif = Buffer.concat([exifAttr, jsonBuff]);
  exif.writeUIntLE(jsonBuff.length, 14, 4);
  
  await img.load(await imageToWebp(image));
  img.exif = exif;
  return await img.save(null);
}

async function writeExifVid(video, metadata) {
  const img = new webp.Image();
  const json = { "sticker-pack-id": "OrbitStudio", "sticker-pack-name": metadata.packname, "sticker-pack-publisher": metadata.author, "emojis": metadata.categories };
  const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
  const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
  const exif = Buffer.concat([exifAttr, jsonBuff]);
  exif.writeUIntLE(jsonBuff.length, 14, 4);
  
  await img.load(await videoToWebp(video));
  img.exif = exif;
  return await img.save(null);
}

async function writeExifWebp(media, metadata) {
  const tmpFileIn = path.join(
    tmpdir(),
    `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`
  );
  const tmpFileOut = path.join(
    tmpdir(),
    `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`
  );
  fs.writeFileSync(tmpFileIn, media);

  if (metadata.packname || metadata.author) {
    const img = new webp.Image();
    const json = {
      "sticker-pack-id": `NatzsixnPacks`,
      "sticker-pack-name": `NatzsixnPacks`,
      "sticker-pack-publisher": `OrbitStudio`,
      emojis: metadata.categories ? metadata.categories : [""],
    };
    const exifAttr = await Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
      0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    const jsonBuff = await Buffer.from(JSON.stringify(json), "utf-8");
    const exif = await Buffer.concat([exifAttr, jsonBuff]);
    await exif.writeUIntLE(jsonBuff.length, 14, 4);
    await img.load(tmpFileIn);
    fs.unlinkSync(tmpFileIn);
    img.exif = exif;
    await img.save(tmpFileOut);
    return tmpFileOut;
  }
}

module.exports = {
  imageToWebp,
  videoToWebp,
  writeExifImg,
  writeExifVid,
  writeExifWebp,
};