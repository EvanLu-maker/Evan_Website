const fs = require('fs');

const path = 'src/pages/Admin.jsx';
const buf = fs.readFileSync(path);
// Conversion to string might fail if encoding is weird, so we'll be careful
let content = buf.toString('utf8');

const isWindows = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// Standardizing the Pagination UI text
// The corrupted ones are: 憿舐內蝚? -> 顯示第; 蝑??? -> 筆，共; 蝑? -> 筆
const replacements = [
  { from: /憿舐內蝚\?/g, to: '顯示第' },
  { from: /蝑\?\?\?/g, to: '筆，共' },
  { from: /蝑\?/g, to: '筆' }
];

let changedCount = 0;
replacements.forEach(r => {
  if (r.from.test(content)) {
    content = content.replace(r.from, r.to);
    changedCount++;
  }
});

// Final cleanup: Remove any non-ASCII or non-Chinese characters that might be hiding
// This is a safety measure. Standard Chinese range: \u4e00-\u9fa5
// However, let's just focus on the problematic ones.

if (changedCount > 0) {
  fs.writeFileSync(path, isWindows ? content.replace(/\n/g, '\r\n') : content, 'utf8');
  console.log(`Fixed ${changedCount} types of corrupted text.`);
} else {
  console.log('No corrupted text found with current regex.');
}
