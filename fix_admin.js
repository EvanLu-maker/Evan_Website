const fs = require('fs');
const path = 'src/pages/Admin.jsx';

let c = fs.readFileSync(path, 'utf8');
const isWindows = c.includes('\r\n');
let cn = c.replace(/\r\n/g, '\n');

let changes = 0;

// Simple single-line replacements
const replacements = [
  ['account: cust.Account,', 'account: cust.account,'],
  ['companyName: cust.\u516c\u53f8\u540d\u7a31 || cust.\u5e97\u540d || \'\',', 'companyName: cust.companyName,'],
  ['email: cust.Email || \'\',', 'email: cust.email || \'\','],
  ['phone: cust.Phone || \'\',', 'phone: cust.phone || \'\','],
];

for (let i = 0; i < replacements.length; i++) {
  const from = replacements[i][0];
  const to = replacements[i][1];
  if (cn.includes(from)) {
    cn = cn.replace(from, to);
    changes++;
    console.log('Replaced: ' + from);
  } else {
    console.log('Not found: ' + from);
  }
}

// Add address field after phone in setEditingCustomer block
const acctIdx = cn.indexOf('account: cust.account,');
if (acctIdx >= 0) {
  const blockEnd = cn.indexOf('})', acctIdx);
  const segment = cn.slice(acctIdx, blockEnd);
  
  if (segment.indexOf('address: cust.address') === -1) {
    const phoneIdx = cn.indexOf("phone: cust.phone || '',", acctIdx);
    if (phoneIdx >= 0) {
      const lineEnd = cn.indexOf('\n', phoneIdx);
      const lineStart = cn.lastIndexOf('\n', phoneIdx) + 1;
      const lineContent = cn.slice(lineStart, phoneIdx);
      const m = lineContent.match(/^(\s+)/);
      const indent = m ? m[1] : '';
      const insertStr = '\n' + indent + 'address: cust.address || \'\',';
      cn = cn.slice(0, lineEnd) + insertStr + cn.slice(lineEnd);
      changes++;
      console.log('Added address field');
    }
  } else {
    console.log('Address already exists');
  }
}

fs.writeFileSync(path, isWindows ? cn.replace(/\n/g, '\r\n') : cn, 'utf8');
console.log('Done. ' + changes + ' total replacements.');
