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

// Load previous manuals.json to preserve originalExtension
let previousManuals = {};
if (fs.existsSync(outputFile)) {
  try {
    const previousData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    for (const brand in previousData) {
      for (const manual of previousData[brand]) {
        previousManuals[manual.filename] = manual.originalExtension;
      }
    }
  } catch (e) {
    console.warn('⚠️ Failed to read previous manuals.json:', e.message);
  }
}

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

  files.forEach(originalFile => {
  let fullPath = path.join(brandManualPath, originalFile);
  let extname = path.extname(originalFile).toLowerCase();
  let base = path.basename(originalFile, extname);

  const isOffice = allowedExtensions.includes(extname) && extname !== '.pdf';
  const isAlreadyRenamed = originalFile.match(/\.(docx|pptx|xlsx|doc|ppt|xls)\.pdf$/i);
  let originalExt = '.pdf';
  let targetFilename = '';

  // Rename Office files: example.docx → example.docx.pdf
  if (isOffice) {
    originalExt = extname;
    const sanitizedBase = sanitize(base);
    targetFilename = `${sanitizedBase}${originalExt}.pdf`;

    const targetPath = path.join(brandManualPath, targetFilename);
    if (originalFile !== targetFilename) {
      fs.renameSync(fullPath, targetPath);
      console.log(`📦 Renamed Office file: ${originalFile} → ${targetFilename}`);
    }
    fullPath = targetPath;
  }
  // Handle files already named like docx.pdf
  else if (isAlreadyRenamed) {
    const match = originalFile.match(/\.(docx|pptx|xlsx|doc|ppt|xls)\.pdf$/i);
    originalExt = `.${match[1].toLowerCase()}`;
    const sanitizedBase = sanitize(path.basename(originalFile, '.pdf'));
    targetFilename = `${sanitizedBase}.pdf`;

    const targetPath = path.join(brandManualPath, targetFilename);
    if (originalFile !== targetFilename) {
      fs.renameSync(fullPath, targetPath);
      console.log(`🧼 Renamed: ${originalFile} → ${targetFilename}`);
    }
    fullPath = targetPath;
  }
  // Native PDFs
  else {
    originalExt = '.pdf';
    const sanitized = sanitize(originalFile);
    const targetPath = path.join(brandManualPath, sanitized);
    if (originalFile !== sanitized) {
      fs.renameSync(fullPath, targetPath);
      console.log(`🧼 Renamed: ${originalFile} → ${sanitized}`);
    }
    fullPath = targetPath;
    targetFilename = sanitized;
  }

  const cleanName = path.basename(targetFilename, '.pdf').replace(/_/g, ' ');
  const previewFileName = targetFilename.replace(/\.pdf$/i, '.png');
  const previewFullPath = path.join(brandPreviewPath, previewFileName);
  const previewUrl = fs.existsSync(previewFullPath)
    ? `${baseJsDelivr}${previewDir}/${brand}/${previewFileName}`
    : originalExt
      ? `${baseJsDelivr}${iconDir}/${originalExt.replace('.', '')}.png`
      : null;

  // Only generate preview if native PDF
  if (!fs.existsSync(previewFullPath) && originalExt === '.pdf') {
    try {
      console.log(`📄 Generating preview for ${targetFilename}...`);
      execSync(`magick -density 150 "${fullPath}[0]" -quality 90 "${previewFullPath}"`);
    } catch (err) {
      console.error(`❌ Failed to generate preview for ${targetFilename}:`, err.message);
    }
  }

  result[brand].push({
    name: cleanName,
    brand,
    filename: targetFilename,
    originalExtension: previousManuals[targetFilename] || originalExt,
    extension: '.pdf',
    url: `${baseJsDelivr}${baseDir}/${brand}/${targetFilename}`,
    previewUrl,
    version: '1.0'
  });
});

});

// Write updated manuals.json
fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
console.log(`✅ Successfully generated ${outputFile}`);
