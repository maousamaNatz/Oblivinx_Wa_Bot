const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { botLogger } = require('../utils/logger');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('../lib/exec');
const fileManager = require('../../config/memoryAsync/readfile');

// Export command menggunakan format Oblixn.cmd
global.Oblixn.cmd({
    name: "sticker",
    alias: ["s", "stiker"],
    desc: "Membuat sticker dari gambar/video",
    category: "tools", 
    async exec(msg, { args }) {
        try {
            // Debug log
            console.log('Message type:', msg.mtype);
            console.log('Message structure:', JSON.stringify(msg.message, null, 2));

            // Cek direct media
            const isDirectImage = msg.message?.imageMessage;
            const isDirectVideo = msg.message?.videoMessage;

            // Cek quoted media dari struktur extendedTextMessage.contextInfo
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const isQuotedImage = quotedMsg?.imageMessage;
            const isQuotedVideo = quotedMsg?.videoMessage;

            // Gabungkan pengecekan
            const hasValidMedia = isDirectImage || isDirectVideo || isQuotedImage || isQuotedVideo;

            if (!hasValidMedia) {
                return msg.reply('❌ Kirim/reply gambar/video dengan caption !sticker');
            }

            await msg.reply('⏳ Sedang membuat sticker...');

            // Tentukan message yang berisi media
            const mediaMsg = (isDirectImage || isDirectVideo) ? msg : { message: quotedMsg };
            const isImage = isDirectImage || isQuotedImage;

            // Download media
            const buffer = await downloadMediaMessage(
                mediaMsg,
                'buffer',
                {},
                { logger: botLogger }
            );

            // Simpan file menggunakan FileManager
            const originalName = `sticker_${Date.now()}.${isImage ? 'jpg' : 'mp4'}`;
            const savedFile = await fileManager.saveFile(buffer, originalName, 'stickers');

            if (!savedFile.success) {
                throw new Error('Gagal menyimpan file');
            }

            // Metadata untuk sticker
            const metadata = {
                packname: "NatzsixnPacks",
                author: "OrbitStudio",
                categories: ["🤖"]
            };

            let stickerBuffer;
            if (isImage) {
                stickerBuffer = await writeExifImg(buffer, metadata);
            } else {
                stickerBuffer = await writeExifVid(buffer, metadata);
            }

            // Kirim sticker
            await msg.reply({ sticker: stickerBuffer });

            // Hapus file temporary setelah selesai
            await fileManager.deleteFile(savedFile.path);

        } catch (error) {
            botLogger.error('Error membuat sticker:', error);
            await msg.reply('❌ Gagal membuat sticker');
        }
    }
});