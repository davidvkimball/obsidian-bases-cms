import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function getFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  for (const file of files) {
    const filePath = join(dir, file);
    if (statSync(filePath).isDirectory()) {
      getFiles(filePath, fileList);
    } else if (filePath.endsWith('.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const files = getFiles('src');
let changedCount = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf8');
  const originalContent = content;

  // Replace document. with activeDocument.
  content = content.replace(/(?<!active)document\.(querySelector|querySelectorAll|addEventListener|removeEventListener|body|createDocumentFragment|createElement)/g, 'activeDocument.$1');
  
  // Replace window.setTimeout with activeWindow.setTimeout
  content = content.replace(/window\.setTimeout/g, 'activeWindow.setTimeout');

  // Replace setTimeout with activeWindow.setTimeout
  content = content.replace(/(?<!activeWindow\.)\bsetTimeout\(/g, 'activeWindow.setTimeout(');

  if (content !== originalContent) {
    writeFileSync(file, content, 'utf8');
    changedCount++;
    console.log(`Updated ${file}`);
  }
}

console.log(`Fixed ${changedCount} files.`);
