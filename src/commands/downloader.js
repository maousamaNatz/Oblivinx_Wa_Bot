const { downloadFbVideo, getFbVideoInfo } = require("../lib/fbDownloader");
const { formatBytes } = require("../utils/helper");

// src/commands/downloader.js
const { botLogger } = require("../utils/logger");
const {
  cekKhodam,
  tiktokDl,
  tiktokDlV2,
  igDl,
  ytv,
  yta,
} = require("../lib/scrapperV2");
const fileManager = require("../../config/memoryAsync/readfile"); // Impor instance langsung dari filemanager.js
const { exec: youtubeDlExec } = require("youtube-dl-exec");
const fs = require("fs");
const fetch = require("node-fetch");
function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs > 0 ? hrs + ":" : ""}${mins < 10 ? "0" + mins : mins}:${
    secs < 10 ? "0" + secs : secs
  }`;
}
// Command: cekKhodam
global.Oblixn.cmd({
  name: "cekkhodam",
  alias: ["khodam"],
  desc: "Cek khodam berdasarkan nama",
  category: "fun",
  async exec(msg, { args }) {
    try {
      if (!args[0]) {
        return await msg.reply("Masukkan nama! Contoh: !cekkhodam Budi");
      }
      const nama = args.join(" ");
      const result = await cekKhodam(nama);
      const response = `Nama: ${result.nama}\nKhodam: ${result.khodam}\nLink: ${result.share}`;
      await msg.reply(response);
    } catch (error) {
      botLogger.error("Error di command cekkhodam:", error);
      await msg.reply(`Terjadi kesalahan: ${error.message || "Unknown error"}`);
    }
  },
});

// Command: tiktokDl
global.Oblixn.cmd({
  name: "tiktokdl",
  alias: ["ttdl", "tiktok"],
  desc: "Download video TikTok (metode 1)",
  category: "downloader",
  async exec(msg, { args }) {
    try {
      if (!args[0]) {
        return await msg.reply("Masukkan URL TikTok! Contoh: !tiktokdl <url>");
      }
      const url = args[0];
      const result = await tiktokDl(url);
      if (result.code !== 0) {
        return await msg.reply(
          `Gagal mendownload: ${result.msg || "Unknown error"}`
        );
      }
      const videoUrl = result.data.play || result.data.hdplay;
      await msg.sock.sendMessage(
        msg.chat,
        {
          video: { url: videoUrl },
          caption: `Judul: ${result.data.title}\nAuthor: ${result.data.author.nickname}`,
        },
        { quoted: msg }
      );
    } catch (error) {
      botLogger.error("Error di command tiktokdl:", error);
      await msg.reply(`Terjadi kesalahan: ${error.message || "Unknown error"}`);
    }
  },
});

// Command: tiktokDlV2
global.Oblixn.cmd({
  name: "tiktokdl2",
  alias: ["ttdl2", "tiktok2"],
  desc: "Download video TikTok (metode 2)",
  category: "downloader",
  async exec(msg, { args }) {
    try {
      if (!args[0]) {
        return await msg.reply("Masukkan URL TikTok! Contoh: !tiktokdl2 <url>");
      }
      const url = args[0];
      const result = await tiktokDlV2(url);
      if (result.status !== 200) {
        return await msg.reply(
          `Gagal mendownload: ${result.msg || "Unknown error"}`
        );
      }
      if (result.isSlide) {
        for (const slideUrl of result.media) {
          await msg.sock.sendMessage(
            msg.chat,
            {
              image: { url: slideUrl },
              caption: `Judul: ${result.title}`,
            },
            { quoted: msg }
          );
        }
      } else {
        const videoUrl =
          result.media.hd || result.media.no_wm || result.media.watermark;
        await msg.sock.sendMessage(
          msg.chat,
          {
            video: { url: videoUrl },
            caption: `Judul: ${result.title}`,
          },
          { quoted: msg }
        );
      }
    } catch (error) {
      botLogger.error("Error di command tiktokdl2:", error);
      await msg.reply(`Terjadi kesalahan: ${error.message || "Unknown error"}`);
    }
  },
});

// Command: igDl
global.Oblixn.cmd({
  name: "igdl",
  alias: ["instagramdl", "ig"],
  desc: "Download konten dari Instagram",
  category: "downloader",
  async exec(msg, { args }) {
    try {
      if (!args[0]) {
        return await msg.reply("Masukkan URL Instagram! Contoh: !igdl <url>");
      }
      const url = args[0];
      const result = await igDl(url);
      if (!result.status) {
        return await msg.reply(`Gagal mendownload: ${result.msg}`);
      }
      const media = result.data[0];
      await msg.sock.sendMessage(
        msg.chat,
        {
          video: { url: media.url },
          caption: `Resolusi: ${media.resolution || "Unknown"}`,
        },
        { quoted: msg }
      );
    } catch (error) {
      botLogger.error("Error di command igdl:", error);
      await msg.reply(`Terjadi kesalahan: ${error.message || "Unknown error"}`);
    }
  },
});

// Command: ytv (Menggunakan youtube-dl-exec dan FileManager)
global.Oblixn.cmd({
  name: "ytv",
  alias: ["youtubevideo", "ytvideo"],
  desc: "Download video YouTube",
  category: "downloader",
  async exec(msg, { args }) {
    try {
      if (!args[0]) {
        return await msg.reply("Masukkan URL YouTube! Contoh: !ytv <url>");
      }
      const url = args[0];
      const outputFileName = "youtube_video.mp4";
      const outputPath = fileManager.getFilePath(
        "video",
        fileManager.generateFileName(outputFileName, "video")
      );

      // Download video menggunakan youtube-dl-exec
      await youtubeDlExec(url, {
        format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        output: outputPath,
        mergeOutputFormat: "mp4",
      });

      // Dapatkan info video
      const videoInfo = await youtubeDlExec(url, { dumpSingleJson: true });

      // Verifikasi file exists
      if (!fs.existsSync(outputPath)) {
        botLogger.error(`File not found: ${outputPath}`);
        throw new Error("File not found after download");
      }

      // Format durasi untuk caption
      const duration = videoInfo.duration || 0;
      const formattedDuration = formatDuration(duration);

      // Kirim video
      await msg.sock.sendMessage(
        msg.chat,
        {
          video: { url: outputPath }, // Pass the path directly
          caption: `Judul: ${videoInfo.title || "Untitled"}\nKualitas: ${
            videoInfo.format_note || "Unknown"
          }\nDurasi: ${formattedDuration}`,
        },
        { quoted: msg }
      );

      // Hapus file sementara
      await fileManager.deleteFile(outputPath);
    } catch (error) {
      botLogger.error("Error di command ytv:", error);
      await msg.reply(`Terjadi kesalahan: ${error.message || "Unknown error"}`);
    }
  },
});

// Command: yta (Menggunakan youtube-dl-exec dan FileManager)
global.Oblixn.cmd({
  name: "yta",
  alias: ["youtubeaudio", "ytaudio"],
  desc: "Download audio dari YouTube",
  category: "downloader",
  async exec(msg, { args }) {
    try {
      if (!args[0]) {
        return await msg.reply("Masukkan URL YouTube! Contoh: !yta <url>");
      }
      const url = args[0];
      const outputFileName = "youtube_audio.mp3";
      const outputPath = fileManager.getFilePath(
        "audio",
        fileManager.generateFileName(outputFileName, "audio")
      );

      // Download audio menggunakan youtube-dl-exec
      await youtubeDlExec(url, {
        extractAudio: true,
        audioFormat: "mp3",
        output: outputPath,
      });

      // Dapatkan info video
      const videoInfo = await youtubeDlExec(url, { dumpSingleJson: true });

      // Verifikasi file exists
      if (!fs.existsSync(outputPath)) {
        botLogger.error(`File not found: ${outputPath}`);
        throw new Error("File not found after download");
      }

      // Kirim audio
      await msg.sock.sendMessage(
        msg.chat,
        {
          audio: { url: outputPath }, // Pass the path directly
          mimetype: "audio/mp4",
          caption: `Judul: ${videoInfo.title || "Untitled"}`,
        },
        { quoted: msg }
      );

      // Hapus file sementara
      await fileManager.deleteFile(outputPath);
    } catch (error) {
      botLogger.error("Error di command yta:", error);
      await msg.reply(`Terjadi kesalahan: ${error.message || "Unknown error"}`);
    }
  },
});
global.Oblixn.cmd({
  name: "fb",
  alias: ["fbdownloader"],
  desc: "Download video dari Facebook",
  category: "tools",
  async exec({ msg, args }) {
    try {
      const { isBanned } = await Oblixn.db.checkBanStatus(msg.sender);
      if (isBanned) return;

      const url =
        args[0] || msg.quoted?.text?.match(/(https?:\/\/[^\s]+)/gi)?.[0];
      if (!url) return msg.reply("Silakan berikan URL Facebook");

      await Oblixn.sock.sendPresenceUpdate("composing", msg.chat);

      const quality =
        args.includes("--hd") || args.includes("-h") ? "hd" : "sd";
      const audioOnly = args.includes("--mp3") || args.includes("-a");
      const format = audioOnly ? "mp3" : "mp4";
      const filename = `fb_${Date.now()}_${quality}`;

      const info = await getFbVideoInfo(url);
      const caption = `📌 *Judul:* ${info.title || "-"}
👤 *Uploader:* ${info.uploader}
⏳ *Durasi:* ${formatDuration(info.duration_ms)}
👀 *Views:* ${info.statistics.views.toLocaleString()}
❤️ *Likes:* ${info.statistics.likes.toLocaleString()}
🔄 *Shares:* ${info.statistics.shares.toLocaleString()}
📅 *Upload Date:* ${new Date(info.uploadDate).toLocaleDateString("id-ID")}
🔗 *Kualitas:* ${quality.toUpperCase()}
🎚 *Format:* ${format.toUpperCase()}`;

      await msg.reply(caption);
      if (info.thumbnail) await msg.reply({ image: { url: info.thumbnail } });

      const progressMsg = await msg.reply("⏳ _Mengunduh video..._");
      const { path: filePath } = await downloadFbVideo(url, {
        quality,
        format,
        filename,
        metadata: true,
        thumbnail: true,
        audioOnly,
      });

      await progressMsg.edit("📤 _Mengunggah video..._");

      const fileSize = fs.statSync(filePath).size;
      const fileExt = path.extname(filePath);
      const sendAsDocument = fileExt !== ".mp4" || audioOnly;

      await msg.reply({
        [sendAsDocument ? "document" : "video"]: {
          url: `file://${filePath}`,
          mimetype: sendAsDocument ? undefined : "video/mp4",
        },
        fileName: `${info.title.substring(0, 50)}${fileExt}`,
        caption: `📁 *File Info*\nUkuran: ${formatBytes(
          fileSize
        )}\nFormat: ${format.toUpperCase()}`,
      });

      fs.unlinkSync(filePath);
      await progressMsg.delete();
    } catch (error) {
      console.error(error);
      msg.reply(
        `❌ Gagal mengunduh: ${
          error.message.includes("melebihi batas")
            ? "Ukuran video terlalu besar"
            : error.message
        }`
      );
    }
  },
});
