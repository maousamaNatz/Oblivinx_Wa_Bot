// Pastikan Anda telah menginstal ONNX Runtime Web terlebih dahulu
// npm install onnxruntime-web

import * as ort from 'onnxruntime-web';

// Konfigurasi URL model dari GitHub
const MODEL_URLS = {
    superResolution: 'https://github.com/TheFutureGadgetsLab/WaifuXL/raw/main/public/models/realesr-general-x4v3.onnx',
    // Asumsikan ada model kedua, misalnya untuk noise reduction (jika ada) 
    noiseReduction: 'https://github.com/TheFutureGadgetsLab/WaifuXL/raw/main/public/models/realesr-general-wdn-x4v3.onnx'
};

class WaifuXLManager {
    constructor() {
        this.sessionSR = null; // Sesi untuk Super Resolution
        this.sessionNR = null; // Sesi untuk Noise Reduction
    }

    // Inisialisasi dan muat model
    async initializeModels() {  
        try {       
            // Konfigurasi ONNX Runtime untuk WebAssembly
            ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
            
            // Muat model Super Resolution
            this.sessionSR = await ort.InferenceSession.create(MODEL_URLS.superResolution, {
                executionProviders: ['wasm']
            });
            console.log('Super Resolution model loaded successfully');

            // Muat model Noise Reduction
            this.sessionNR = await ort.InferenceSession.create(MODEL_URLS.noiseReduction, {
                executionProviders: ['wasm']
            });
            console.log('Noise Reduction model loaded successfully');
        } catch (error) {
            console.error('Error loading models:', error);
            throw error;
        }
    }

    // Fungsi untuk preprocessing gambar
    async preprocessImage(imageElement) {
        const canvas = document.createElement('canvas');
        canvas.width = imageElement.width;
        canvas.height = imageElement.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imageElement, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data, width, height } = imageData;

        // Konversi ke format tensor (normalized float32)
        const inputData = new Float32Array(width * height * 3);
        for (let i = 0, j = 0; i < data.length; i += 4) {
            inputData[j++] = data[i] / 255.0;     // R
            inputData[j++] = data[i + 1] / 255.0; // G
            inputData[j++] = data[i + 2] / 255.0; // B
        }

        return new ort.Tensor('float32', inputData, [1, 3, height, width]);
    }

    // Proses Super Resolution
    async applySuperResolution(imageElement) {
        if (!this.sessionSR) throw new Error('Super Resolution model not initialized');

        const inputTensor = await this.preprocessImage(imageElement);
        const feeds = { input: inputTensor };
        
        const results = await this.sessionSR.run(feeds);
        return this.postprocessOutput(results.output, imageElement.width * 4, imageElement.height * 4);
    }

    // Proses Noise Reduction
    async applyNoiseReduction(imageElement) {
        if (!this.sessionNR) throw new Error('Noise Reduction model not initialized');

        const inputTensor = await this.preprocessImage(imageElement);
        const feeds = { input: inputTensor };
        
        const results = await this.sessionNR.run(feeds);
        return this.postprocessOutput(results.output, imageElement.width * 4, imageElement.height * 4);
    }

    // Post-processing hasil tensor ke gambar
    postprocessOutput(outputTensor, width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);
        
        const data = outputTensor.data;
        for (let i = 0, j = 0; i < data.length; i += 3) {
            imageData.data[j++] = Math.min(255, Math.max(0, data[i] * 255));     // R
            imageData.data[j++] = Math.min(255, Math.max(0, data[i + 1] * 255)); // G
            imageData.data[j++] = Math.min(255, Math.max(0, data[i + 2] * 255)); // B
            imageData.data[j++] = 255; // A
        }
        
        ctx.putImageData(imageData, 0, 0);
        const outputImage = new Image();
        outputImage.src = canvas.toDataURL();
        return outputImage;
    }

    // Fungsi untuk proses lengkap (NR lalu SR)
    async processImage(imageElement) {
        const denoised = await this.applyNoiseReduction(imageElement);
        return await this.applySuperResolution(denoised);
    }
}

// Contoh penggunaan
async function main() {
    const waifuXL = new WaifuXLManager();
    
    try {
        await waifuXL.initializeModels();
        
        const inputImage = document.getElementById('inputImage');
        const resultImage = await waifuXL.processImage(inputImage);
        
        document.body.appendChild(resultImage);
    } catch (error) {
        console.error('Error processing image:', error);
    }
}

// HTML pendukung:
// <img id="inputImage" src="path/to/your/image.jpg" />
main();