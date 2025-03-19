const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');
const fileManager = require('../../config/memoryAsync/readfile');

// Daftarkan font kustom dengan penanganan error
try {
  registerFont(path.join(__dirname, '../assets/fonts/Montserrat-Black.ttf'), {
    family: 'Montserrat'
  });
} catch (error) {
  console.error('Error registering font:', error);
  // Gunakan font default jika gagal mendaftarkan font kustom
}

async function createWelcomeText(backgroundPath) {
  try {
    // Load background image dengan penanganan error
    let backgroundImage;
    try {
      backgroundImage = await loadImage(backgroundPath);
    } catch (error) {
      console.error('Error loading background image:', error);
      throw new Error('Gagal memuat gambar background');
    }
    
    // Buat canvas dengan ukuran yang sama dengan background
    const canvas = createCanvas(1920, 480);
    const ctx = canvas.getContext('2d');
    
    // Gambar background
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    
    // Atur style untuk teks "WELCOME"
    ctx.font = '72px "Montserrat"'; // Gunakan font yang sudah didaftarkan
    ctx.fillStyle = '#FFD700'; // Warna kuning untuk "WELCOME"
    const welcomeText = 'WELCOME';
    const welcomeTextWidth = ctx.measureText(welcomeText).width;
    
    // Posisikan teks "WELCOME" di tengah
    ctx.fillText(welcomeText, (canvas.width - welcomeTextWidth) / 2, 200);
    
    // Atur style untuk teks "Spring"
    ctx.font = '120px "Montserrat"'; // Gunakan font yang sudah didaftarkan
    ctx.fillStyle = '#1E90FF'; // Warna biru untuk "Spring"
    const springText = 'Spring';
    const springTextWidth = ctx.measureText(springText).width;
    
    // Posisikan teks "Spring" di tengah
    ctx.fillText(springText, (canvas.width - springTextWidth) / 2, 300);
    
    // Simpan hasil menggunakan FileManager
    const buffer = canvas.toBuffer('image/png');
    const result = await fileManager.saveFile(buffer, 'welcome.png', 'temp');
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return result.path;
  } catch (error) {
    console.error('Error creating welcome text:', error);
    throw error;
  }
}

async function createGoodbyeText(backgroundPath) {
  try {
    // Load background image dengan penanganan error
    let backgroundImage;
    try {
      backgroundImage = await loadImage(backgroundPath);
    } catch (error) {
      console.error('Error loading background image:', error);
      throw new Error('Gagal memuat gambar background');
    }
    
    // Buat canvas dengan ukuran yang sama dengan background
    const canvas = createCanvas(1920, 480);
    const ctx = canvas.getContext('2d');
    
    // Gambar background
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    
    // Atur style untuk teks "GOODBYE"
    ctx.font = '72px "Montserrat"'; // Gunakan font yang sudah didaftarkan
    ctx.fillStyle = '#FFD700'; // Warna kuning untuk "GOODBYE"
    const goodbyeText = 'GOODBYE';
    const goodbyeTextWidth = ctx.measureText(goodbyeText).width;
    
    // Posisikan teks "GOODBYE" di tengah
    ctx.fillText(goodbyeText, (canvas.width - goodbyeTextWidth) / 2, 200);
    
    // Atur style untuk teks "Spring"
    ctx.font = '120px "Montserrat"'; // Gunakan font yang sudah didaftarkan
    ctx.fillStyle = '#1E90FF'; // Warna biru untuk "Spring"
    const springText = 'Spring';
    const springTextWidth = ctx.measureText(springText).width;
    
    // Posisikan teks "Spring" di tengah
    ctx.fillText(springText, (canvas.width - springTextWidth) / 2, 300);
    
    // Simpan hasil menggunakan FileManager
    const buffer = canvas.toBuffer('image/png');
    const result = await fileManager.saveFile(buffer, 'goodbye.png', 'temp');
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return result.path;
  } catch (error) {
    console.error('Error creating goodbye text:', error);
    throw error;
  }
}

module.exports = {
  createWelcomeText,
  createGoodbyeText
};

