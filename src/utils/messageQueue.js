const { botLogger } = require('./logger');

/**
 * Kelas untuk mengelola antrian pesan dengan kapasitas tinggi
 * Menggunakan kombinasi dari in-memory queue dan worker yang efisien
 */
class MessageQueue {
  constructor(options = {}) {
    this.queue = [];
    this.processingQueue = new Map(); // Untuk pelacakan pesan yang sedang diproses
    this.maxConcurrentProcessing = options.maxConcurrent || 50; // Jumlah pesan yang diproses secara bersamaan
    this.maxQueueSize = options.maxQueueSize || 99999999; // Batas maksimum antrian
    this.processingDelay = options.processingDelay || 5; // Delay dalam ms antar pemrosesan pesan
    this.priorityLevels = {
      OWNER: 0,      // Prioritas tertinggi (pemilik bot)
      ADMIN: 1,      // Admin grup
      PREMIUM: 2,    // Pengguna premium
      NORMAL: 3,     // Pengguna biasa
      LOW: 4         // Prioritas rendah
    };
    this.isProcessing = false;
    this.messageHandlers = new Map();
    this.statistics = {
      totalReceived: 0,
      totalProcessed: 0,
      totalErrors: 0,
      startTime: Date.now(),
      highestQueueLength: 0
    };
    this.defaultHandler = null;
    
    // Interval untuk memantau status antrian
    this.monitorInterval = setInterval(() => this.monitorQueueStatus(), 30000);
  }
  
  /**
   * Mendaftarkan handler untuk tipe pesan tertentu
   * @param {string} type - Tipe pesan (misalnya: 'text', 'image', 'command', dll)
   * @param {Function} handler - Fungsi penanganan pesan
   */
  registerHandler(type, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler harus berupa fungsi');
    }
    this.messageHandlers.set(type, handler);
    botLogger.info(`Registered handler for message type: ${type}`);
  }
  
  /**
   * Mendaftarkan handler default untuk pesan yang tidak memiliki handler khusus
   * @param {Function} handler - Fungsi penanganan pesan default
   */
  setDefaultHandler(handler) {
    if (typeof handler !== 'function') {
      throw new Error('Default handler harus berupa fungsi');
    }
    this.defaultHandler = handler;
    botLogger.info('Default message handler has been set');
  }
  
  /**
   * Menambahkan pesan ke antrian
   * @param {Object} message - Objek pesan WhatsApp yang telah diproses
   * @param {Object} metadata - Metadata tambahan (termasuk prioritas)
   * @returns {string} ID pesan dalam antrian
   */
  enqueue(message, metadata = {}) {
    // Buat ID unik untuk pesan
    const messageId = metadata.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Tentukan prioritas pesan
    const priority = this.determineMessagePriority(message, metadata);
    
    // Tentukan tipe pesan
    const messageType = this.determineMessageType(message);
    
    // Buat objek pesan yang akan dimasukkan ke antrian
    const queuedMessage = {
      id: messageId,
      message,
      metadata: {
        ...metadata,
        receivedAt: Date.now(),
        priority,
        messageType,
        attempts: 0 // Untuk retry jika gagal
      }
    };
    
    // Periksa kapasitas antrian
    if (this.queue.length >= this.maxQueueSize) {
      botLogger.warn(`Queue is full (${this.queue.length} messages). Dropping message with lowest priority.`);
      // Cari pesan dengan prioritas terendah untuk dihapus
      const lowestPriorityIndex = this.findLowestPriorityMessageIndex();
      if (lowestPriorityIndex !== -1 && this.queue[lowestPriorityIndex].metadata.priority > priority) {
        // Hapus pesan dengan prioritas lebih rendah
        this.queue.splice(lowestPriorityIndex, 1);
      } else {
        // Jika tidak ada pesan dengan prioritas lebih rendah, tolak pesan baru
        botLogger.error(`Cannot enqueue message: ${messageId}. Queue is full and message priority is not high enough.`);
        return null;
      }
    }
    
    // Masukkan pesan ke antrian
    this.queue.push(queuedMessage);
    
    // Update statistik
    this.statistics.totalReceived++;
    this.statistics.highestQueueLength = Math.max(this.statistics.highestQueueLength, this.queue.length);
    
    // Mulai pemrosesan jika belum dimulai
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    return messageId;
  }
  
  /**
   * Menentukan prioritas pesan berdasarkan pengirim dan tipe
   * @private
   */
  determineMessagePriority(message, metadata) {
    // Cek apakah pesan berasal dari owner
    if (message.sender && global.Oblixn && global.Oblixn.isOwner && global.Oblixn.isOwner(message.sender)) {
      return this.priorityLevels.OWNER;
    }
    
    // Cek apakah pengirim adalah admin grup
    if (message.isGroup && message.isAdmin) {
      return this.priorityLevels.ADMIN;
    }
    
    // Cek apakah pengirim adalah user premium (bisa disesuaikan dengan implementasi user premium)
    if (metadata.isPremium) {
      return this.priorityLevels.PREMIUM;
    }
    
    // Cek apakah ini adalah pesan command
    if (message.messageText && message.messageText.startsWith('!')) {
      return this.priorityLevels.NORMAL;
    }
    
    // Pesan biasa
    return this.priorityLevels.LOW;
  }
  
  /**
   * Menentukan tipe pesan
   * @private
   */
  determineMessageType(message) {
    if (!message || !message.message) return 'unknown';
    
    const m = message.message;
    
    if (m.conversation) return 'text';
    if (m.imageMessage) return 'image';
    if (m.videoMessage) return 'video';
    if (m.audioMessage) return 'audio';
    if (m.stickerMessage) return 'sticker';
    if (m.documentMessage) return 'document';
    if (m.contactMessage) return 'contact';
    if (m.locationMessage) return 'location';
    if (m.liveLocationMessage) return 'liveLocation';
    if (m.buttonsResponseMessage) return 'buttonsResponse';
    if (m.listResponseMessage) return 'listResponse';
    if (m.templateButtonReplyMessage) return 'templateButtonReply';
    
    return 'unknown';
  }
  
  /**
   * Menemukan index pesan dengan prioritas terendah
   * @private
   */
  findLowestPriorityMessageIndex() {
    if (this.queue.length === 0) return -1;
    
    let lowestPriorityIndex = 0;
    let lowestPriority = this.queue[0].metadata.priority;
    
    for (let i = 1; i < this.queue.length; i++) {
      const currentPriority = this.queue[i].metadata.priority;
      if (currentPriority > lowestPriority) {
        lowestPriority = currentPriority;
        lowestPriorityIndex = i;
      }
    }
    
    return lowestPriorityIndex;
  }
  
  /**
   * Memulai pemrosesan antrian pesan
   */
  async processQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      // Jika sudah mencapai batas pemrosesan bersamaan, tunggu sampai ada slot kosong
      if (this.processingQueue.size >= this.maxConcurrentProcessing) {
        await new Promise(resolve => setTimeout(resolve, this.processingDelay));
        continue;
      }
      
      // Urutkan antrian berdasarkan prioritas
      this.queue.sort((a, b) => a.metadata.priority - b.metadata.priority);
      
      // Ambil pesan dari antrian
      const queuedMessage = this.queue.shift();
      
      // Tambahkan ke daftar pesan yang sedang diproses
      this.processingQueue.set(queuedMessage.id, queuedMessage);
      
      // Proses pesan secara asynchronous
      this.processMessage(queuedMessage)
        .catch(error => {
          botLogger.error(`Error processing message ${queuedMessage.id}: ${error.message}`);
          this.statistics.totalErrors++;
        })
        .finally(() => {
          // Hapus dari daftar pesan yang sedang diproses
          this.processingQueue.delete(queuedMessage.id);
        });
      
      // Berikan sedikit delay untuk menghindari throttling
      await new Promise(resolve => setTimeout(resolve, this.processingDelay));
    }
    
    this.isProcessing = false;
  }
  
  /**
   * Memproses pesan individual
   * @private
   */
  async processMessage(queuedMessage) {
    try {
      const { message, metadata } = queuedMessage;
      const { messageType } = metadata;
      
      // Cari handler untuk tipe pesan ini
      const handler = this.messageHandlers.get(messageType) || this.defaultHandler;
      
      if (!handler) {
        botLogger.warn(`No handler for message type: ${messageType}`);
        return;
      }
      
      // Jalankan handler
      await handler(message, metadata);
      
      // Update statistik
      this.statistics.totalProcessed++;
      
    } catch (error) {
      // Increment retry count
      queuedMessage.metadata.attempts++;
      
      // Mencoba ulang jika belum mencapai batas maksimum
      if (queuedMessage.metadata.attempts < 3) {
        botLogger.warn(`Retrying message ${queuedMessage.id} (Attempt: ${queuedMessage.metadata.attempts})`);
        this.queue.push(queuedMessage);
      } else {
        botLogger.error(`Failed to process message ${queuedMessage.id} after ${queuedMessage.metadata.attempts} attempts: ${error.message}`);
        this.statistics.totalErrors++;
      }
      
      throw error;
    }
  }
  
  /**
   * Memantau status antrian dan mencatat statistik
   * @private
   */
  monitorQueueStatus() {
    const uptime = (Date.now() - this.statistics.startTime) / 1000; // dalam detik
    const messagesPerSecond = this.statistics.totalProcessed / uptime;
    
    botLogger.info(`
Queue Status:
- Queue Size: ${this.queue.length}
- Currently Processing: ${this.processingQueue.size}
- Total Received: ${this.statistics.totalReceived}
- Total Processed: ${this.statistics.totalProcessed}
- Total Errors: ${this.statistics.totalErrors}
- Processing Rate: ${messagesPerSecond.toFixed(2)} msg/s
- Highest Queue Length: ${this.statistics.highestQueueLength}
    `);
  }
  
  /**
   * Mendapatkan statistik antrian
   * @returns {Object} Statistik antrian
   */
  getStatistics() {
    const now = Date.now();
    const uptime = (now - this.statistics.startTime) / 1000; // dalam detik
    
    return {
      uptime,
      totalReceived: this.statistics.totalReceived,
      totalProcessed: this.statistics.totalProcessed,
      totalErrors: this.statistics.totalErrors,
      currentQueueLength: this.queue.length,
      currentlyProcessing: this.processingQueue.size,
      highestQueueLength: this.statistics.highestQueueLength
    };
  }
  
  /**
   * Membersihkan resource ketika tidak digunakan
   */
  cleanup() {
    clearInterval(this.monitorInterval);
  }
}

// Membuat instance tunggal untuk digunakan di seluruh aplikasi
const messageQueue = new MessageQueue();

module.exports = {
  messageQueue,
  MessageQueue // Export kelas untuk pengujian atau instance khusus
}; 