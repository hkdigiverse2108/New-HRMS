const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let modifiedCount = 0;

walkDir('./src', function(filePath) {
  if (!filePath.endsWith('.tsx')) return;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;
  
  const regex = /(<\/DialogClose>\s*<\/div>\s*)(?:({\w+\s*&&\s*\(\s*)?)(<(?:div|form)[^>]*className="([^"]*)")[^>]*>/g;
  
  content = content.replace(regex, (match, headerEnd, condition, tagStart, className) => {
    if (className.includes('p-') || className.includes('px-')) {
      return match;
    }
    
    const newClassName = className + " px-6 md:px-8 py-6";
    const newTagStart = tagStart.replace(className, newClassName);
    return headerEnd + (condition || '') + newTagStart;
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log('Fixed:', filePath);
    modifiedCount++;
  }
});

console.log('Total files fixed:', modifiedCount);
