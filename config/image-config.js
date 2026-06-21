const path = require('path');

module.exports = {
  // Directories paths (can be absolute or relative to the project root)
  directories: {
    source: path.resolve(process.cwd(), 'images'),
    output: path.resolve(process.cwd(), 'webp'),
    logs: path.resolve(process.cwd(), 'logs')
  },

  // Log file configuration
  logging: {
    logFile: path.resolve(process.cwd(), 'logs', 'image-optimization.log'),
    consoleOutput: true
  },

  // Conversion parameters for Sharp
  conversion: {
    quality: 80,         // WebP quality parameter (1-100)
    lossless: false,     // Use lossless compression
    effort: 4,           // CPU effort (0-6) where 6 is slowest but best compression
    stripMetadata: true  // Strip EXIF and metadata to reduce file size
  },

  // Performance and optimization limits
  optimization: {
    // Max width/height of images. Larger images will be resized down to maintain aspect ratio.
    // Set to null or 0 to disable automatic resizing.
    maxDimension: 2048,
    
    // Concurrency limit for bulk processing (avoiding OOM on 1000+ files)
    concurrency: 10,
    
    // Whether to delete the original source image after successful conversion
    deleteOriginal: false,
    
    // Supported input extensions
    supportedExtensions: ['.jpg', '.jpeg', '.png']
  }
};
