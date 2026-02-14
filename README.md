# CompressBench

A comprehensive client-side compression and decompression benchmarking tool that runs entirely in your browser. Compare the performance of various compression algorithms including GZIP, Brotli, Zstandard, and more.

<img src="https://i.ibb.co/fdG0dLVy/compressbench-thedabcorner-site-1.png">

## Features

- **Client-Side Processing**: All compression and benchmarking happens locally in your browser - no data is sent to external servers
- **Multiple Algorithms**: Support for GZIP, Brotli, Zstandard, Deflate, and more
- **Performance Metrics**: Detailed timing, throughput, and compression ratio analysis
- **Visual Results**: Interactive charts and tables showing compression performance
- **Browser Compatibility**: Automatic detection of native browser compression support
- **History Tracking**: Save and compare benchmark results across sessions
- **Download Results**: Export compressed files with the best algorithm per family
- **Dark/Light Theme**: Modern UI with theme switching support

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- A modern web browser with WebAssembly support

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/compressbench.git
cd compressbench
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run preview
```

## Supported Algorithms

CompressBench supports the following compression algorithms through various providers:

### Native Browser APIs
- **GZIP** (CompressionStream/DecompressionStream)
- **Deflate** (CompressionStream/DecompressionStream)

### fflate Library
- **GZIP** (multiple compression levels)
- **Zlib** (Deflate with zlib headers)
- **Deflate** (raw deflate)

### Brotli (WebAssembly)
- **Brotli** (multiple compression levels via brotli-wasm)

### Zstandard (WebAssembly)
- **Zstandard** (multiple compression levels via zstd-codec)

## Usage

1. **Upload a File**: Drag and drop any file into the upload zone or click to browse
2. **Configure Settings**: Adjust benchmark iterations and enable/disable algorithms
3. **Run Benchmark**: Click the play button to start compression testing
4. **View Results**: Analyze performance metrics, compression ratios, and timing data
5. **Download Results**: Export the best compressed version for each algorithm family

### Key Metrics

- **Compression Ratio**: How much the file size was reduced
- **Compression Speed**: Time taken to compress the data
- **Decompression Speed**: Time taken to decompress the data
- **Throughput**: Data processing speed in MB/s
- **Verification**: Ensures compressed data can be correctly decompressed

## Architecture

### Tech Stack

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Compression Libraries**:
  - fflate (fast JavaScript compression)
  - brotli-wasm (Brotli compression)
  - zstd-codec (Zstandard compression)

### Project Structure

```
src/
├── components/          # React components
│   ├── layout/         # Header, Footer
│   ├── results/        # Results display components
│   ├── settings/       # Configuration panels
│   └── ui/             # Reusable UI components
├── hooks/              # Custom React hooks
├── lib/                # Utility functions
│   ├── compression.ts  # Core compression logic
│   ├── hash.ts         # File hashing utilities
│   └── format.ts       # Data formatting helpers
└── types.ts            # TypeScript type definitions
```

## Configuration

### Benchmark Settings

- **Iterations**: Number of times to run each compression test (default: 5)
- **Algorithm Selection**: Enable/disable specific compression algorithms
- **Compression Levels**: Configure compression quality vs speed trade-offs

### Browser Support

CompressBench automatically detects browser capabilities:
- Native CompressionStream/DecompressionStream support
- WebAssembly availability for advanced algorithms
- Fallback to JavaScript implementations when needed

## Results Analysis

### Summary Cards
- Total benchmark time
- Best compression ratio achieved
- Fastest compression algorithm
- Fastest decompression algorithm

### Detailed Results Table
- Algorithm performance comparison
- Compression ratios and file sizes
- Timing data with min/max/average
- Throughput measurements

### Visual Charts
- Compression ratio comparison
- Performance timing visualization
- Algorithm family grouping

## History & Persistence

- **Local Storage**: Benchmark results are saved locally in your browser
- **Session Management**: Resume previous benchmarks
- **Comparison**: Compare results across different files and sessions

## Privacy & Security

- **100% Client-Side**: All processing happens in your browser
- **No Data Transmission**: Files never leave your device
- **Local Storage Only**: Results stored locally using IndexedDB
- **No External Dependencies**: Works offline once loaded

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Jackson Cummings**
- Website: [thedabcorner.site](https://thedabcorner.site)

## Acknowledgments

- [fflate](https://github.com/101arrowz/fflate) - Fast JavaScript compression library
- [brotli-wasm](https://github.com/google/brotli) - Brotli compression WebAssembly port
- [zstd-codec](https://github.com/yoshihitoh/zstd-codec) - Zstandard WebAssembly codec
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Vite](https://vitejs.dev/) - Fast build tool and dev server

---

**© 2026 Jackson Cummings** - Built with love for the web compression community
