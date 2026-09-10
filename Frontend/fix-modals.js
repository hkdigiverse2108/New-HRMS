const fs = require('fs');
const glob = require('glob');
const path = require('path');

const files = glob.sync('src/**/*.tsx');
let modifiedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let originalContent = content;
  
  // A regex to find the closing div of the header (identified by </DialogClose>\n  </div>)
  // and then the next tag which represents the body, if it's missing px- or p- padding.
  
  // It's safer to just inject px-6 md:px-8 py-6 to specific known patterns.
  // We know the pattern is:
  // </div> (closing the header)
  // <div className="space-y-something"> or <form ... className="space-y-something">
  
  const regex = /(<\/DialogClose>\s*<\/div>\s*)(?:({\w+\s*&&\s*\(\s*)?)(<(?:div|form)[^>]*className="([^"]*)")[^>]*>/g;
  
  content = content.replace(regex, (match, headerEnd, condition, tagStart, className) => {
    if (className.includes('p-') || className.includes('px-')) {
      return match; // already has padding
    }
    
    // Add px-6 md:px-8 py-6
    const newClassName = className + " px-6 md:px-8 py-6";
    const newTagStart = tagStart.replace(className, newClassName);
    return headerEnd + (condition || '') + newTagStart;
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log('Fixed:', file);
    modifiedCount++;
  }
}
console.log('Total files fixed:', modifiedCount);
