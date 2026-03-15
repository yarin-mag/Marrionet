'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, execFileSync } = require('child_process');

module.exports = function bootstrap() {
  const version = require('../package.json').version;
  const platform = process.platform;
  const arch = process.arch;
  const isWindows = platform === 'win32';

  let artifact;
  if (platform === 'linux') {
    artifact = 'marionette-linux-x64.tar.gz';
  } else if (platform === 'darwin') {
    artifact = arch === 'arm64'
      ? 'marionette-macos-arm64.tar.gz'
      : 'marionette-macos-x64.tar.gz';
  } else if (isWindows) {
    artifact = 'marionette-windows-x64.zip';
  } else {
    console.error(`Unsupported platform: ${platform}`);
    process.exit(1);
  }

  const url = `https://github.com/yarin-mag/Marionette/releases/download/v${version}/${artifact}`;
  const installDir = path.join(os.homedir(), '.marionette', 'app');
  const tmpFile = path.join(os.tmpdir(), artifact);
  const realBin = path.join(installDir, 'bin', isWindows ? 'marionette.cmd' : 'marionette');

  console.log(`Installing Marionette v${version}...`);
  console.log(`Downloading ${artifact}...`);

  download(url, tmpFile, () => {
    console.log('Extracting...');
    fs.mkdirSync(installDir, { recursive: true });

    if (isWindows) {
      const tmpExtract = path.join(os.tmpdir(), 'marionette-extract');
      try { execSync(`rmdir /S /Q "${tmpExtract}"`, { stdio: 'pipe' }); } catch (_) {}
      execSync(
        `powershell -NoProfile -Command "Expand-Archive -Force -Path '${tmpFile}' -DestinationPath '${tmpExtract}'"`,
        { stdio: 'inherit' }
      );
      const inner = path.join(tmpExtract, 'marionette');
      execSync(`xcopy /E /I /Y "${inner}" "${installDir}"`, { stdio: 'inherit' });
      try { execSync(`rmdir /S /Q "${tmpExtract}"`, { stdio: 'pipe' }); } catch (_) {}
    } else {
      execSync(`tar -xzf "${tmpFile}" -C "${installDir}" --strip-components=1`, { stdio: 'inherit' });
      fs.chmodSync(realBin, 0o755);
    }

    try { fs.unlinkSync(tmpFile); } catch (_) {}

    console.log('Running setup...');
    execFileSync(realBin, ['setup'], { stdio: 'inherit', shell: isWindows });
  });
};

function download(url, dest, callback) {
  function get(urlStr) {
    https.get(urlStr, (res) => {
      // Follow redirects (GitHub releases redirect to CDN)
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        res.resume(); // drain so connection is released
        get(res.headers.location);
        return;
      }
      if (res.statusCode !== 200) {
        console.error(`Download failed: HTTP ${res.statusCode}\nURL: ${urlStr}`);
        process.exit(1);
      }

      const file = fs.createWriteStream(dest);
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;

      res.on('data', (chunk) => {
        received += chunk.length;
        if (total) {
          const pct = Math.round((received / total) * 100);
          process.stdout.write(`\r  ${pct}%`);
        }
      });

      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          if (total) process.stdout.write('\n');
          callback();
        });
      });
      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        console.error(`Write error: ${err.message}`);
        process.exit(1);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      console.error(`Download error: ${err.message}`);
      process.exit(1);
    });
  }

  get(url);
}
