const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const brands = ['Carrier', 'Daikin', 'Thermoking', 'Starcool'];
const baseDir = 'assets/manuals';
const previewDir = 'assets/previews';
const iconDir = 'assets/icons';
const outputFile = 'assets/manuals.json';

const baseJsDelivr = 'https://cdn.jsdelivr.net/gh/chillreefer/chill-manuals/';

const allowedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];

const sanitize = (filename) => {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  const safeName = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  return `${safeName}${ext}`;
};

const result = {};

brands.forEach((brand) => {
  const brandManualPath = path.join(baseDir, brand);
  const brandPreviewPath = path.join(previewDir, brand);

  if (!fs.existsSync(brandPreviewPath)) {
    fs.mkdirSync(brandPreviewPath, { recursive: true });
  }

  let files = fs.readdirSync(brandManualPath).filter(file => {
    const lower = file.toLowerCase();
    return (
      !lower.startsWith('.') &&
      !['desktop.ini', '.ds_store', 'thumbs.db'].includes(lower) &&
      allowedExtensions.some(ext => lower.endsWith(ext)) ||
      lower.match(/\.(docx|pptx|xlsx|doc|ppt|xls)\.pdf$/i)
    );
  });

  result[brand] = [];

  files.forEach(file => {
    let fullPath = path.join(brandManualPath, file);
    const originalExtMatch = file.match(/\.(docx|pptx|xlsx|doc|ppt|xls)$/i);
    const isNativePDF = path.extname(file).toLowerCase() === '.pdf';

    const originalExt = originalExtMatch ? originalExtMatch[0].toLowerCase() : null;
    const sanitizedName = sanitize(path.basename(file, path.extname(file)));

    let targetFilename = sanitizedName;
    if (originalExt && !file.endsWith('.pdf')) {
      // rename Office file to .pdf suffix
      targetFilename += `.pdf`;
      const targetPath = path.join(brandManualPath, targetFilename);

      // Only rename if needed
      if (file !== targetFilename) {
        fs.renameSync(fullPath, targetPath);
        console.log(`📦 Renamed Office file: ${file} → ${targetFilename}`);
      }

      file = targetFilename;
      fullPath = path.join(brandManualPath, file);
    } else {
      file = sanitize(file);
      const sanitizedPath = path.join(brandManualPath, file);
      if (fullPath !== sanitizedPath) {
        fs.renameSync(fullPath, sanitizedPath);
        fullPath = sanitizedPath;
        console.log(`🧼 Renamed: ${path.basename(fullPath)} → ${file}`);
      }
    }

    const cleanName = sanitizedName.replace(/_/g, ' ');

    const previewFileName = file.replace(/\.pdf$/i, '.png');
    const previewFullPath = path.join(brandPreviewPath, previewFileName);
    const previewUrl = fs.existsSync(previewFullPath)
      ? `${baseJsDelivr}${previewDir}/${brand}/${previewFileName}`
      : originalExt
        ? `${baseJsDelivr}${iconDir}/${originalExt.replace('.', '')}.png`
        : null;

    if (!originalExt && !fs.existsSync(previewFullPath)) {
      try {
        console.log(`📄 Generating preview for ${file}...`);
        execSync(`magick -density 150 "${fullPath}[0]" -quality 90 "${previewFullPath}"`);
      } catch (err) {
        console.error(`❌ Failed to generate preview for ${file}:`, err.message);
      }
    }

    result[brand].push({
      name: cleanName,
      brand,
      filename: file,
      originalExtension: originalExt || '.pdf',
      extension: '.pdf',
      url: `${baseJsDelivr}${baseDir}/${brand}/${file}`,
      previewUrl,
      version: '1.0'
    });
  });
});

// Write to manuals.json
fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
console.log(`✅ Successfully generated ${outputFile}`);
