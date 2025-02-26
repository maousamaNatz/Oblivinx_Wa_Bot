// Menggunakan Puter.js untuk AI chat
// Dokumentasi: https://docs.puter.com/getting-started/

// Fungsi untuk menangani pesan dan mendapatkan respons dari AI
const handleMessage = async (message) => {
  try {
    // Periksa apakah pesan kosong
    if (!message || message.trim() === '') {
      return "Silakan masukkan pertanyaan atau pesan yang ingin Anda tanyakan.";
    }

    // Buat script element untuk memuat Puter.js jika belum dimuat
    if (typeof puter === 'undefined') {
      // Karena kita berada di lingkungan Node.js, kita perlu menggunakan pendekatan berbeda
      // Gunakan fetch untuk memanggil API Puter
      const fetch = require('node-fetch');
      
      const response = await fetch('https://api.puter.com/v2/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          // Opsional: tambahkan parameter lain sesuai kebutuhan
          system_message: "Saya adalah Model dari Natz AI yang berfungsi sebagai seorang asisten pembantu yang dapat menjawab pertanyaan dan membantu dalam menyelesaikan tugas. Saya akan menjawab pertanyaan dengan bahasa Indonesia yang singkat dan padat."
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.response || "Maaf, tidak ada respons yang diterima dari AI.";
    } else {
      // Jika puter.js sudah dimuat (dalam lingkungan browser)
      const response = await puter.ai.chat(message, {
        system_message: "Saya adalah Model dari Natz AI yang berfungsi sebagai seorang asisten pembantu yang dapat menjawab pertanyaan dan membantu dalam menyelesaikan tugas. Saya akan menjawab pertanyaan dengan bahasa Indonesia yang singkat dan padat."
      });
      
      return response;
    }
  } catch (error) {
    console.error("Error saat menghasilkan respons dari AI:", error);
    return "Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.";
  }
};

// Fungsi alternatif jika Puter.js tidak tersedia
const fallbackAI = async (message) => {
  return `Saya adalah asisten AI sederhana. Anda bertanya: "${message}". Maaf, saat ini saya hanya dapat memberikan respons sederhana karena layanan AI utama sedang tidak tersedia.`;
};

module.exports = { handleMessage, fallbackAI };



