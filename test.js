const { getBlackboxAI, scrapeBlackboxAI, getBlackboxResponse } = require('./src/lib/Ai');
const { botLogger } = require('./src/utils/logger');

// Fungsi untuk menjalankan test
async function runTest() {
  try {
    console.log('🧪 Memulai pengujian modul AI...');
    
    // Test prompt
    const testPrompt = 'Apa itu JavaScript?';
    
    console.log(`📝 Prompt pengujian: "${testPrompt}"`);
    console.log('⏳ Menjalankan pengujian, mohon tunggu...');
    
    // Test fungsi utama
    console.log('\n🔍 Menguji fungsi getBlackboxAI:');
    try {
      const mainResponse = await getBlackboxAI(testPrompt);
      console.log('✅ Berhasil mendapatkan respons dari getBlackboxAI');
      console.log('📊 Hasil respons:');
      console.log('-------------------');
      console.log(mainResponse);
      console.log('-------------------');
    } catch (error) {
      console.error('❌ Gagal menjalankan getBlackboxAI:', error.message);
    }
    
    // Test fungsi API
    console.log('\n🔍 Menguji fungsi getBlackboxResponse (API):');
    try {
      const apiResponse = await getBlackboxResponse(testPrompt);
      console.log('✅ Berhasil mendapatkan respons dari API');
      console.log('📊 Hasil respons API:');
      console.log('-------------------');
      console.log(apiResponse);
      console.log('-------------------');
    } catch (error) {
      console.error('❌ Gagal menjalankan API:', error.message);
    }
    
    // Test fungsi scraping
    console.log('\n🔍 Menguji fungsi scrapeBlackboxAI (Scraping):');
    try {
      const scrapingResponse = await scrapeBlackboxAI(testPrompt);
      console.log('✅ Berhasil mendapatkan respons dari scraping');
      console.log('📊 Hasil respons scraping:');
      console.log('-------------------');
      console.log(scrapingResponse);
      console.log('-------------------');
    } catch (error) {
      console.error('❌ Gagal menjalankan scraping:', error.message);
    }
    
    console.log('\n🏁 Pengujian selesai!');
  } catch (error) {
    console.error('❌ Terjadi kesalahan dalam pengujian:', error);
  }
}

// Jalankan test
runTest().catch(error => {
  console.error('❌ Error tidak tertangani:', error);
  process.exit(1);
});
