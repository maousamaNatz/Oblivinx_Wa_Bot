const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { botLogger } = require('../utils/logger');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('../lib/exec');
const fileManager = require('../../config/memoryAsync/readfile');

// Export command menggunakan format Oblixn.cmd
global.Oblixn.cmd({
    name: "sticker",
    alias: ["s", "stiker"],
    desc: "Membuat sticker dari gambar/video/GIF/WebP",
    category: "tools", 
    async exec(msg, { args }) {
        try {
            // Debug log
            console.log('Message type:', msg.mtype);

            // Cek direct media
            const isDirectImage = msg.message?.imageMessage;
            const isDirectVideo = msg.message?.videoMessage;
            const isDirectGif = msg.message?.gifPlayback;
            const isDirectWebP = msg.message?.document?.mimetype === 'image/webp';

            // Cek quoted media dari struktur extendedTextMessage.contextInfo
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const isQuotedImage = quotedMsg?.imageMessage;
            const isQuotedVideo = quotedMsg?.videoMessage;
            const isQuotedGif = quotedMsg?.gifPlayback;
            const isQuotedWebP = quotedMsg?.document?.mimetype === 'image/webp';
            const isQuotedSticker = quotedMsg?.stickerMessage;

            // Gabungkan pengecekan
            const hasValidMedia = isDirectImage || isDirectVideo || isDirectGif || isDirectWebP || isQuotedImage || isQuotedVideo || isQuotedGif || isQuotedWebP || isQuotedSticker;

            if (!hasValidMedia) {
                console.log('Invalid media detected:', JSON.stringify(msg, null, 2));
                return msg.reply('❌ Kirim/reply gambar/video/GIF/WebP dengan caption !sticker');
            }

            await msg.reply('⏳ Sedang membuat sticker...');

            // Tentukan message yang berisi media
            const mediaMsg = (isDirectImage || isDirectVideo || isDirectGif || isDirectWebP || isQuotedSticker) ? msg : { message: quotedMsg };
            const isImage = isDirectImage || isQuotedImage || isDirectWebP || isQuotedWebP;
            const isGif = isDirectGif || isQuotedGif;
            const isWebP = isDirectWebP || isQuotedWebP;

            // Jika sudah dalam format WebP, langsung buat sticker
            if (isWebP) {
                const buffer = await downloadMediaMessage(mediaMsg, 'buffer', {}, { logger: botLogger });
                const metadata = {
                    packname: "NatzsixnPacks",
                    author: "OrbitStudio",
                    categories: ["🤖"]
                };
                const stickerBuffer = await writeExifVid(buffer, metadata);
                await msg.reply({ sticker: stickerBuffer });
                return;
            }

            // Download media
            const buffer = await downloadMediaMessage(
                mediaMsg,
                'buffer',
                {},
                { logger: botLogger }
            );

            // Log buffer size
            console.log('Downloaded media buffer size:', buffer.length);

            // Simpan file menggunakan FileManager
            const originalName = `sticker_${Date.now()}.${isImage ? 'jpg' : isGif ? 'gif' : 'mp4'}`;
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
            } else if (isGif) {
                stickerBuffer = await writeExifVid(buffer, metadata); // Assuming GIFs are treated similarly to videos
            } else {
                stickerBuffer = await writeExifVid(buffer, metadata);
            }

            // Log sticker buffer size before sending
            console.log('Sticker buffer size:', stickerBuffer.length);

            // Kirim sticker
            await msg.reply({ sticker: stickerBuffer });

            // Hapus file temporary setelah selesai
            await fileManager.deleteFile(savedFile.path);

        } catch (error) {
            botLogger.error('Error membuat sticker:', error);
            await msg.reply('❌ Gagal membuat sticker: ' + error.message);
        }
    }
});