const fs = require('fs');
const path = 'src/pages/Admin.jsx';

let c = fs.readFileSync(path, 'utf8');
const isWindows = c.includes('\r\n');
let cn = c.replace(/\r\n/g, '\n');

let changes = 0;

// 1. Update the table header for checkboxes
const headerMatch = '<th style={{ padding: \'1rem\', cursor: \'pointer\' }} onClick={() => requestSort(\'Timestamp\')}>下單時間';
const newHeader = `                    <th style={{ padding: '0.5rem 1rem', width: '40px' }}>
                      <input 
                        type="checkbox" 
                        checked={filteredAndSortedOrders.length > 0 && filteredAndSortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).every(o => selectedOrders.has(\`\${o.Timestamp}-\${o.CustomerToken}-\${o.ProductID}\`))}
                        onChange={() => handleToggleAllOrders(filteredAndSortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage))}
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                    </th>
                    <th style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => requestSort('Timestamp')}>下單時間`;

if (cn.includes(headerMatch) && !cn.includes('handleToggleAllOrders')) {
  cn = cn.replace(headerMatch, newHeader);
  changes++;
}

// 2. Update the row mapping to use slice and add checkbox + shipped button
const mapMatch = '{filteredAndSortedOrders.map((order, index) => (';
const newMap = '{filteredAndSortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((order, index) => (';

if (cn.includes(mapMatch)) {
  cn = cn.replace(mapMatch, newMap);
  changes++;
}

const rowMatch = '<tr key={index} style={{ borderBottom: \'1px solid var(--border-color)\', transition: \'background 0.2s\' }} className="hover-row">';
const newRow = '<tr key={index} style={{ borderBottom: \'1px solid var(--border-color)\', transition: \'background 0.2s\', background: selectedOrders.has(\`\${order.Timestamp}-\${order.CustomerToken}-\${order.ProductID}\`) ? \'rgba(88,166,255,0.1)\' : \'\' }} className="hover-row">';

if (cn.includes(rowMatch)) {
  cn = cn.replace(rowMatch, newRow);
  changes++;
}

const tdMatch = '<td style={{ padding: \'1rem\', color: \'var(--text-secondary)\', whiteSpace: \'nowrap\' }}>';
const newTd = `                        <td style={{ padding: '1rem' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedOrders.has(\`\${order.Timestamp}-\${order.CustomerToken}-\${order.ProductID}\`)}
                            onChange={() => handleToggleOrderSelection(order)}
                            style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                          />
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>`;

if (cn.includes(tdMatch)) {
  cn = cn.replace(tdMatch, newTd);
  changes++;
}

const actionMatch = '<button title="核准" onClick={() => updateOrderStatus(order, \'已核准\')';
const newAction = `                              <button title="已出貨" onClick={() => updateOrderStatus(order, '已出貨')} style={{ background: 'transparent', border: 'none', color: '#38b2ac', cursor: 'pointer' }}><Truck size={18} /></button>
                              <button title="核准" onClick={() => updateOrderStatus(order, '已核准')`;

if (cn.includes(actionMatch) && !cn.includes('title="已出貨"')) {
  cn = cn.replace(actionMatch, newAction);
  changes++;
}

fs.writeFileSync(path, isWindows ? cn.replace(/\n/g, '\r\n') : cn, 'utf8');
console.log('Applied ' + changes + ' UI changes');
