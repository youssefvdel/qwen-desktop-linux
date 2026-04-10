/**
 * Post-install script to download Linux runtimes (bun + uv)
 * These are bundled with the app to run MCP servers
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ARCH = os.arch();
const IS_ARM = ARCH === 'arm64';

// Download URLs
const BUN_VERSION = '1.2.5';
const UV_VERSION = '0.6.5';

const DOWNLOADS = [
  {
    name: 'bun',
    url: IS_ARM
      ? `https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-aarch64.zip`
      : `https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-x64.zip`,
    dest: path.join(__dirname, '..', 'resources', 'bun', IS_ARM ? 'linux-arm64' : 'linux-x64'),
    extract: true,
  },
  {
    name: 'uv',
    url: IS_ARM
      ? `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-aarch64-unknown-linux-musl.tar.gz`
      : `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-x86_64-unknown-linux-musl.tar.gz`,
    dest: path.join(__dirname, '..', 'resources', 'uv', IS_ARM ? 'linux-arm64' : 'linux-x64'),
    extract: true,
  },
];

/**
 * Download a file with progress
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`⬇️  Downloading: ${url}`);

    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          https.get(response.headers.location, (redirectResponse) => {
            redirectResponse.pipe(file);
            file.on('finish', () => {
              file.close();
              resolve();
            });
          }).on('error', reject);
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      })
      .on('error', reject);
  });
}

/**
 * Extract archive
 */
function extractArchive(filePath, destDir, isTarGz = false) {
  console.log(`📦 Extracting: ${path.basename(filePath)}`);

  fs.mkdirSync(destDir, { recursive: true });

  if (isTarGz) {
    execSync(`tar -xzf "${filePath}" -C "${destDir}"`, { stdio: 'inherit' });
  } else {
    execSync(`unzip -o "${filePath}" -d "${destDir}"`, { stdio: 'inherit' });
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Setting up Qwen Desktop Linux runtimes...\n');

  const tmpDir = path.join(os.tmpdir(), 'qwen-desktop-runtimes');
  fs.mkdirSync(tmpDir, { recursive: true });

  for (const download of DOWNLOADS) {
    console.log(`\n📥 Setting up ${download.name}...`);

    const archiveName = download.url.split('/').pop();
    const archivePath = path.join(tmpDir, archiveName);

    // Check if already exists
    const bunExists = fs.existsSync(path.join(download.dest, 'bun'));
    const uvExists = fs.existsSync(path.join(download.dest, 'uv'));

    if ((download.name === 'bun' && bunExists) || (download.name === 'uv' && uvExists)) {
      console.log(`✅ ${download.name} already exists, skipping`);
      continue;
    }

    try {
      // Download
      await downloadFile(download.url, archivePath);

      // Extract
      const isTarGz = archiveName.endsWith('.tar.gz');
      extractArchive(archivePath, download.dest, isTarGz);

      // Cleanup archive
      fs.unlinkSync(archivePath);

      console.log(`✅ ${download.name} downloaded successfully`);
    } catch (error) {
      console.error(`❌ Failed to download ${download.name}:`, error.message);
      console.log(`   You can download it manually from: ${download.url}`);
      console.log(`   And extract to: ${download.dest}`);
    }
  }

  // Cleanup temp directory
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }

  console.log('\n✨ Runtime setup complete!');
  console.log('\nNext steps:');
  console.log('  npm start     - Start the app in development mode');
  console.log('  npm run make  - Build distributable packages\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
