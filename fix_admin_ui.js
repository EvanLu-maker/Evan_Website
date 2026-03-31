const fs = require('fs');
const path = 'src/pages/Admin.jsx';

let c = fs.readFileSync(path, 'utf8');
const isWindows = c.includes('\r\n');
let cn = c.replace(/\r\n/g, '\n');

let changes = 0;

// 1. Add Header Checkbox
const headerMatch = "                    <th style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => requestSort('Timestamp')}>日期";
const newHeader = 
`                    <th style={{ padding: '0.5rem 1rem', width: '40px' }}>
                      <input 
                        type="checkbox" 
                        checked={filteredAndSortedOrders.length > 0 && filteredAndSortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).every(o => selectedOrders.has(\`\${o.Timestamp}-\${o.CustomerToken}-\${o.ProductID}\`))}
                        onChange={() => handleToggleAllOrders(filteredAndSortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage))}
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                    </th>
                    <th style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => requestSort('Timestamp')}>日期`;

if (cn.includes(headerMatch)) {
    cn = cn.replace(headerMatch, newHeader);
    changes++;
}

// 2. Add Row Checkbox and Slice
const mapMatch = '                    filteredAndSortedOrders.map((order, idx) => (';
const newMap = '                    filteredAndSortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((order, idx) => (';

if (cn.includes(mapMatch)) {
    cn = cn.replace(mapMatch, newMap);
    changes++;
}

const rowMatch = '                      <tr key={idx} style={{ borderBottom: \'1px solid rgba(255,255,255,0.05)\' }}>';
const newRow = 
`                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: selectedOrders.has(\`\${order.Timestamp}-\${order.CustomerToken}-\${order.ProductID}\`) ? 'rgba(88,166,255,0.1)' : '' }}>
                        <td style={{ padding: '1rem' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedOrders.has(\`\${order.Timestamp}-\${order.CustomerToken}-\${order.ProductID}\`)}
                            onChange={() => handleToggleOrderSelection(order)}
                            style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                          />
                        </td>`;

if (cn.includes(rowMatch)) {
    cn = cn.replace(rowMatch, newRow);
    changes++;
}

// 3. Fix the formatting error in previous turn (shipped button was partially added)
const shippedBtn = '<button title="已出貨" onClick={() => updateOrderStatus(order, \'已出貨\')';
if (cn.includes(shippedBtn)) {
    console.log('Shipped button already partially present, checking formatting...');
}

fs.writeFileSync(path, isWindows ? cn.replace(/\n/g, '\r\n') : cn, 'utf8');
console.log('Applied ' + changes + ' UI fixes');
