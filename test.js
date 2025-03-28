const axios = require('axios');
const fs = require('fs');
const cheerio = require('cheerio');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');
const { promisify } = require('util');
const sleep = promisify(setTimeout);
const chalk = require('chalk');

class PinterestScraper {
  constructor(options = {}) {
    this.cookiePath = options.cookiePath || 'cookie.json';
    this.outputDir = options.outputDir || 'pinterest_output';
    this.downloadImages = options.downloadImages || false;
    this.outputFormat = options.outputFormat || 'json';
    this.rateLimitDelay = options.rateLimitDelay || 500;
    this.maxRetries = options.maxRetries || 3;
    this.proxyList = options.proxyList || [];
    this.currentProxyIndex = 0;
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'
    ];
    this.logLevel = options.logLevel || 'info';
    this.headless = options.headless !== undefined ? options.headless : true;

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    if (this.downloadImages && !fs.existsSync(path.join(this.outputDir, 'images'))) {
      fs.mkdirSync(path.join(this.outputDir, 'images'), { recursive: true });
    }

    this.sessionId = uuidv4();
    this.logger = this.setupLogger();
  }

  setupLogger() {
    const logLevels = { error: 0, warn: 1, info: 2, debug: 3 };
    const currentLevel = logLevels[this.logLevel] || 2;

    return {
      error: (...args) => { if (currentLevel >= 0) console.error(chalk.red('[ERROR]'), ...args); },
      warn: (...args) => { if (currentLevel >= 1) console.warn(chalk.yellow('[WARNING]'), ...args); },
      info: (...args) => { if (currentLevel >= 2) console.info(chalk.blue('[INFO]'), ...args); },
      debug: (...args) => { if (currentLevel >= 3) console.debug(chalk.gray('[DEBUG]'), ...args); }
    };
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  async loadCookies() {
    try {
      if (!fs.existsSync(this.cookiePath)) {
        throw new Error('Cookie file does not exist');
      }
      const cookieData = JSON.parse(fs.readFileSync(this.cookiePath, 'utf8'));
      this.logger.debug('Raw cookie data:', cookieData);
      let cookieArray;
  
      if (Array.isArray(cookieData)) {
        cookieArray = cookieData.filter(cookie =>
          cookie.name && cookie.value && typeof cookie.name === 'string' && typeof cookie.value === 'string'
        );
      } else if (typeof cookieData === 'object') {
        cookieArray = Object.entries(cookieData)
          .filter(([name, value]) => name && value && typeof name === 'string' && typeof value === 'string')
          .map(([name, value]) => ({ name, value }));
      } else {
        throw new Error('Invalid cookie format: must be an array or object');
      }
  
      if (cookieArray.length === 0) {
        throw new Error('No valid cookies found in cookie.json');
      }
  
      this.logger.debug('Filtered cookies:', cookieArray);
      return {
        cookieHeader: cookieArray.map(cookie => `${cookie.name}=${cookie.value}`).join('; '),
        cookieArray
      };
    } catch (error) {
      this.logger.error(`Failed to load cookies from ${this.cookiePath}:`, error.message);
      throw error;
    }
  }

  async getNextProxy() {
    if (this.proxyList.length === 0) return null;
    const proxy = this.proxyList[this.currentProxyIndex];
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxyList.length;
    return proxy;
  }

  async makeRequest(url, options = {}) {
    let lastError;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const proxy = await this.getNextProxy();
        const requestOptions = {
          headers: {
            'User-Agent': this.getRandomUserAgent(),
            'Cookie': options.cookieHeader || '',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.pinterest.com/',
            'DNT': '1'
          },
          timeout: 30000,
          ...options
        };

        if (proxy) requestOptions.proxy = proxy;

        this.logger.debug(`Request to ${url} (Attempt ${attempt + 1}/${this.maxRetries})`);
        const response = await axios.get(url, requestOptions);
        await sleep(this.rateLimitDelay);
        return response;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Attempt ${attempt + 1}/${this.maxRetries} failed:`, error.message);
        const delay = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 1000);
        this.logger.debug(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }

    throw new Error(`Request failed after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  async scrapePinterestWithBrowser(keyword, limit = 10) {
    const browser = await puppeteer.launch({
      headless: this.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  
    try {
      const page = await browser.newPage();
      let cookieArray = [];
  
      try {
        const cookies = await this.loadCookies();
        cookieArray = cookies.cookieArray;
        const cookiesToSet = cookieArray.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: '.pinterest.com',
          path: '/'
        }));
        this.logger.debug('Setting cookies:', JSON.stringify(cookiesToSet, null, 2));
        await page.setCookie(...cookiesToSet);
      } catch (error) {
        this.logger.warn('Proceeding without cookies due to loading error:', error.message);
      }
  
      const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(keyword)}`;
      this.logger.info(`Navigating to ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
  
      // Tunggu elemen pin muncul atau tambahkan timeout
      try {
        await page.waitForSelector('[data-test-id="pin"]', { timeout: 10000 });
      } catch (e) {
        this.logger.warn('Pin elements not found within timeout, saving HTML for debugging');
        const html = await page.content();
        fs.writeFileSync('debug.html', html);
      }
  
      this.logger.info(`Scrolling to load more pins...`);
      const maxScrolls = Math.ceil(limit / 25) + 2;
  
      for (let i = 0; i < maxScrolls; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
        await sleep(2000); // Tambah delay untuk memastikan konten dimuat
        this.logger.debug(`Scroll ${i + 1}/${maxScrolls}`);
      }
  
      this.logger.info(`Extracting pin data...`);
      const pinData = await page.evaluate(() => {
        const pins = [];
        // Coba beberapa selektor alternatif
        const pinElements = document.querySelectorAll('[data-test-id="pin"], .pinWrapper, div[data-grid-item]');
  
        pinElements.forEach(pin => {
          try {
            const pinId = pin.getAttribute('data-pin-id') || pin.querySelector('a')?.href?.match(/pin\/(\d+)/)?.[1];
            if (!pinId) return;
  
            const imageElement = pin.querySelector('img');
            const linkElement = pin.querySelector('a');
            const descElement = pin.querySelector('[data-test-id="pin-description"], .description');
            const boardElement = pin.querySelector('[data-test-id="board-name"], .boardName');
  
            pins.push({
              id: pinId,
              description: descElement ? descElement.textContent.trim() : '',
              imageUrl: imageElement ? imageElement.src.replace(/\/236x\//, '/originals/') : null,
              pinUrl: linkElement ? linkElement.href : null,
              board: boardElement ? boardElement.textContent.trim() : '',
              timestamp: new Date().toISOString()
            });
          } catch (e) {
            console.error('Error parsing pin:', e);
          }
        });
  
        return pins;
      });
  
      this.logger.info(`Found ${pinData.length} pins`);
      const limitedResults = pinData.slice(0, limit);
      await this.saveResults(limitedResults, keyword);
      return limitedResults;
    } catch (error) {
      this.logger.error('Browser scraping error:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  async scrapeAdditionalPinDetails(pinData) {
    this.logger.info(`Fetching additional details for ${pinData.length} pins...`);
    const enhancedPins = [];

    for (let i = 0; i < pinData.length; i++) {
      const pin = pinData[i];
      if (!pin.pinUrl) {
        enhancedPins.push(pin);
        continue;
      }

      try {
        this.logger.debug(`Processing pin ${i + 1}/${pinData.length}: ${pin.id}`);
        const { cookieHeader } = await this.loadCookies();
        const response = await this.makeRequest(pin.pinUrl, { cookieHeader });
        const $ = cheerio.load(response.data);

        const userProfile = $('[data-test-id="pinner-name"]').first().text().trim();
        const likeCount = $('[data-test-id="like-count"]').first().text().trim();
        const saveCount = $('[data-test-id="save-count"]').first().text().trim();
        const hashtags = [];
        $('[data-test-id="pin-description"] a').each((_, el) => {
          const text = $(el).text().trim();
          if (text.startsWith('#')) hashtags.push(text.substring(1));
        });

        let highResImageUrl = pin.imageUrl;
        const ogImage = $('meta[property="og:image"]').attr('content');
        if (ogImage) highResImageUrl = ogImage;

        enhancedPins.push({
          ...pin,
          imageUrl: highResImageUrl,
          user: userProfile,
          likes: likeCount,
          saves: saveCount,
          hashtags,
          fetchedAt: new Date().toISOString()
        });

        await sleep(this.rateLimitDelay);
      } catch (error) {
        this.logger.warn(`Failed to fetch details for pin ${pin.id}:`, error.message);
        enhancedPins.push(pin);
      }
    }

    return enhancedPins;
  }

  async downloadImage(imageUrl, fileName) {
    if (!imageUrl) return null;

    try {
      const response = await axios({
        method: 'GET',
        url: imageUrl,
        responseType: 'stream'
      });

      const filePath = path.join(this.outputDir, 'images', fileName);
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
      });
    } catch (error) {
      this.logger.warn(`Image download failed for ${imageUrl}:`, error.message);
      return null;
    }
  }

  escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const stringValue = String(value).replace(/"/g, '""');
    if (/[,"\n\r]/.test(stringValue)) return `"${stringValue}"`;
    return stringValue;
  }

  writeCSV(data, filePath) {
    if (!data || data.length === 0) {
      this.logger.warn('No data to write to CSV');
      return false;
    }

    try {
      const allKeys = new Set();
      data.forEach(item => Object.keys(item).forEach(key => allKeys.add(key)));
      const headers = Array.from(allKeys).sort();
      const headerRow = headers.map(header => this.escapeCSV(header)).join(',');
      const rows = data.map(item => headers.map(header => this.escapeCSV(item[header])).join(','));
      const csvContent = [headerRow, ...rows].join('\n');
      fs.writeFileSync(filePath, csvContent);
      this.logger.info(`CSV data saved to ${filePath}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to write CSV: ${error.message}`);
      return false;
    }
  }

  async saveResults(pinData, keyword) {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const fileNameBase = `pinterest_${keyword.replace(/\s+/g, '_')}_${timestamp}`;

    if (this.downloadImages) {
      this.logger.info(`Downloading ${pinData.length} images...`);
      for (let i = 0; i < pinData.length; i++) {
        const pin = pinData[i];
        if (!pin.imageUrl) continue;

        const extension = this.getImageExtension(pin.imageUrl);
        const imageName = `${pin.id}${extension}`;
        this.logger.debug(`Downloading image ${i + 1}/${pinData.length}: ${imageName}`);
        const filePath = await this.downloadImage(pin.imageUrl, imageName);

        if (filePath) pinData[i].localImagePath = filePath;
        await sleep(100);
      }
    }

    switch (this.outputFormat.toLowerCase()) {
      case 'json':
        const jsonPath = path.join(this.outputDir, `${fileNameBase}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(pinData, null, 2));
        this.logger.info(`JSON data saved to ${jsonPath}`);
        break;
      case 'csv':
        const csvPath = path.join(this.outputDir, `${fileNameBase}.csv`);
        this.writeCSV(pinData, csvPath);
        break;
      default:
        this.logger.warn(`Unsupported output format: ${this.outputFormat}, defaulting to JSON`);
        const defaultPath = path.join(this.outputDir, `${fileNameBase}.json`);
        fs.writeFileSync(defaultPath, JSON.stringify(pinData, null, 2));
        break;
    }

    const metadataPath = path.join(this.outputDir, `${fileNameBase}_metadata.json`);
    const metadata = {
      query: keyword,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      totalResults: pinData.length,
      imagesDownloaded: this.downloadImages ? pinData.filter(p => p.localImagePath).length : 0,
      outputFormat: this.outputFormat
    };

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    this.logger.info(`Metadata saved to ${metadataPath}`);
  }

  getImageExtension(url) {
    const regex = /\.(jpe?g|png|gif|webp)(?:\?.*)?$/i;
    const match = url.match(regex);
    return match ? `.${match[1].toLowerCase()}` : '.jpg';
  }

  async scrapePinterest(keyword, limit = 10, searchOptions = {}) {
    this.logger.info(`Starting Pinterest scraper for keyword: "${keyword}" with limit: ${limit}`);

    const options = { useBrowser: true, fetchAdditionalDetails: true, ...searchOptions };
    let pinData;

    if (options.useBrowser) {
      pinData = await this.scrapePinterestWithBrowser(keyword, limit);
    } else {
      pinData = await this.scrapePinterestWithHttp(keyword, limit);
    }

    if (options.fetchAdditionalDetails && pinData.length > 0) {
      pinData = await this.scrapeAdditionalPinDetails(pinData);
    }

    this.logger.info(`Scraping completed: Found ${pinData.length} results`);
    return pinData;
  }

  async scrapePinterestWithHttp(keyword, limit = 10) {
    try {
      const { cookieHeader } = await this.loadCookies();
      const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(keyword)}`;
      this.logger.info(`Making HTTP request to ${searchUrl}`);
      const response = await this.makeRequest(searchUrl, { cookieHeader });
      const $ = cheerio.load(response.data);
      let pinData = [];

      let jsonData;
      $('script').each((i, element) => {
        const scriptContent = $(element).html() || '';
        if (scriptContent.includes('__PWS_DATA__')) {
          try {
            const jsonMatch = scriptContent.match(/\{"__PWS_DATA__".*?}\);/);
            if (jsonMatch) jsonData = JSON.parse(jsonMatch[0].replace(/\);$/, ''));
          } catch (e) {
            this.logger.warn('Failed to parse JSON from script tag:', e.message);
          }
        }
      });

      if (jsonData && jsonData.__PWS_DATA__) {
        const pinResource = Object.values(jsonData.__PWS_DATA__.resourceResponses || {})
          .find(res => res.name === 'SearchResource');

        if (pinResource && pinResource.response && pinResource.response.data) {
          const results = pinResource.response.data.results || [];
          pinData = results.slice(0, limit).map(pin => ({
            id: pin.id,
            description: pin.description || '',
            imageUrl: pin.images?.orig?.url || '',
            pinUrl: `https://www.pinterest.com/pin/${pin.id}/`,
            board: pin.board?.name || '',
            timestamp: new Date().toISOString()
          }));
        }
      }

      if (pinData.length === 0) {
        this.logger.info('Falling back to HTML scraping');
        $('[data-test-id="pin"]').each((i, element) => {
          if (pinData.length >= limit) return false;

          const pinId = $(element).attr('data-pin-id');
          if (!pinId) return;

          const imageElement = $(element).find('img').first();
          const imageUrl = imageElement.attr('src');
          const origImageUrl = imageUrl ? imageUrl.replace(/\/236x\//, '/originals/') : null;

          pinData.push({
            id: pinId,
            description: $(element).find('[data-test-id="pin-description"]').text().trim(),
            imageUrl: origImageUrl,
            pinUrl: `https://www.pinterest.com/pin/${pinId}/`,
            timestamp: new Date().toISOString()
          });
        });
      }

      this.logger.info(`HTTP request found ${pinData.length} pins`);
      await this.saveResults(pinData, keyword);
      return pinData;
    } catch (error) {
      this.logger.error('HTTP scraping error:', error.message);
      throw error;
    }
  }

  async batchScrape(keywords, limit = 10, options = {}) {
    const results = {};

    for (const keyword of keywords) {
      this.logger.info(`Batch scraping keyword: ${keyword}`);
      try {
        results[keyword] = await this.scrapePinterest(keyword, limit, options);
      } catch (error) {
        this.logger.error(`Failed to scrape keyword "${keyword}":`, error.message);
        results[keyword] = { error: error.message };
      }
      await sleep(options.batchDelay || 2000);
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const batchResultPath = path.join(this.outputDir, `batch_results_${timestamp}.json`);
    fs.writeFileSync(batchResultPath, JSON.stringify(results, null, 2));
    this.logger.info(`Batch scraping completed. Results saved to ${batchResultPath}`);
    return results;
  }
}

(async () => {
  try {
    const scraper = new PinterestScraper({
      cookiePath: 'cookie.json',
      outputDir: 'pinterest_output',
      downloadImages: true,
      outputFormat: 'json',
      rateLimitDelay: 1000,
      maxRetries: 3,
      logLevel: 'info',
      headless: true,
      proxyList: []
    });

    const results = await scraper.scrapePinterest('wallpaper aesthetic', 20, {
      useBrowser: true,
      fetchAdditionalDetails: true
    });

    console.log(`Scraped ${results.length} pins`);
  } catch (error) {
    console.error('Scraper error:', error.message);
  }
})();