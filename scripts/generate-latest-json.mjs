import fs from 'fs';
import path from 'path';

/**
 * Script to generate/update latest.json for Tauri v2 updater.
 * This script searches for .sig files and bundles in the target directory
 * and creates a latest.json formatted for GitHub Releases.
 */

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = pkg.version;
const owner = 'Rithprohos';
const repo = 'Vibe-DB';

const targetDir = process.argv[2] || 'src-tauri/target/release/bundle';

const latest = {
  version: `v${version}`,
  notes: `Release v${version}`,
  pub_date: new Date().toISOString(),
  platforms: {}
};

// Mapping of Tauri platform names to our bundle filenames pattern
// Tauri v2 uses OS-ARCH or OS-ARCH-INSTALLER
const platformMap = {
  'darwin-aarch64': {
    arch: 'aarch64',
    pattern: /\.app\.tar\.gz$/,
    sigPattern: /\.app\.tar\.gz\.sig$/
  },
  'darwin-x86_64': {
    arch: 'x86_64',
    pattern: /\.app\.tar\.gz$/,
    sigPattern: /\.app\.tar\.gz\.sig$/
  },
  'windows-x86_64': {
    arch: 'x64',
    pattern: /\.msi\.zip$/,
    sigPattern: /\.msi\.zip\.sig$/
  },
  'linux-x86_64': {
    arch: 'amd64',
    pattern: /\.AppImage\.tar\.gz$/,
    sigPattern: /\.AppImage\.tar\.gz\.sig$/
  }
};

function findFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(filePath));
    } else {
      results.push(filePath);
    }
  });
  return results;
}

const allFiles = findFiles(targetDir);
console.log(`Found ${allFiles.length} files in ${targetDir}`);

Object.entries(platformMap).forEach(([platform, config]) => {
  // Look for files that match the pattern AND contain the architecture name
  const bundleFile = allFiles.find(f => f.includes(config.arch) && config.pattern.test(f));
  const sigFile = allFiles.find(f => f.includes(config.arch) && config.sigPattern.test(f));

  if (bundleFile && sigFile) {
    const signature = fs.readFileSync(sigFile, 'utf8').trim();
    const fileName = path.basename(bundleFile);
    
    latest.platforms[platform] = {
      signature,
      url: `https://github.com/${owner}/${repo}/releases/download/v${version}/${fileName}`
    };
    console.log(`Matched ${platform}: ${fileName}`);
  }
});

if (Object.keys(latest.platforms).length === 0) {
  console.error('No matching platform artifacts found!');
  process.exit(0); // Exit gracefully so CI doesn't necessarily fail if assets aren't all there yet
}

const outputPath = 'latest.json';
fs.writeFileSync(outputPath, JSON.stringify(latest, null, 2));
console.log(`Generated ${outputPath} for version ${version}`);
console.log(latest);
