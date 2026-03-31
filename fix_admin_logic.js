const fs = require('fs');
const path = 'src/pages/Admin.jsx';

let c = fs.readFileSync(path, 'utf8');
const isWindows = c.includes('\r\n');
let cn = c.replace(/\r\n/g, '\n');

let changes = 0;

// 1. Add missing state variables at the start of Admin function
const stateStart = '  const [adminToken, setAdminToken] = useState(\'ADMIN\');';
const newStates = `
  const [adminToken, setAdminToken] = useState('ADMIN');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const itemsPerPage = 10;
`;

if (cn.includes(stateStart) && !cn.includes('const [currentPage, setCurrentPage]')) {
  cn = cn.replace(stateStart, newStates);
  changes++;
  console.log('Added missing states (pagination, selection)');
}

// 2. Add missing handlers before SkeletonRow
const handlerTarget = '  const SkeletonRow = ({ cols = 7 }) => (';
const newHandlers = `
  const handleToggleOrderSelection = (order) => {
    const key = \`\${order.Timestamp}-\${order.CustomerToken}-\${order.ProductID}\`;
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(key)) newSelected.delete(key);
    else newSelected.add(key);
    setSelectedOrders(newSelected);
  };

  const handleToggleAllOrders = (currentItems) => {
    const allInPageKeys = currentItems.map(o => \`\${o.Timestamp}-\${o.CustomerToken}-\${o.ProductID}\`);
    const allSelected = allInPageKeys.every(k => selectedOrders.has(k));
    const newSelected = new Set(selectedOrders);
    
    if (allSelected) {
      allInPageKeys.forEach(k => newSelected.delete(k));
    } else {
      allInPageKeys.forEach(k => newSelected.add(k));
    }
    setSelectedOrders(newSelected);
  };

  const handleBatchUpdateStatus = async (newStatus) => {
    if (!window.confirm(\`確定要將選取的 \${selectedOrders.size} 筆訂單更新為 [\${newStatus}] 嗎？\`)) return;
    setIsSyncing(true);
    try {
      const ordersToUpdate = orders.filter(o => {
        const key = \`\${o.Timestamp}-\${o.CustomerToken}-\${o.ProductID}\`;
        return selectedOrders.has(key);
      });
      await api.batchUpdateOrderStatus(adminToken, ordersToUpdate, newStatus);
      alert('批次更新成功！');
      setSelectedOrders(new Set());
      fetchData(adminToken);
    } catch (err) {
      alert('更新失敗：' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const SkeletonRow = ({ cols = 7 }) => (
`;

if (cn.includes(handlerTarget) && !cn.includes('const handleBatchUpdateStatus')) {
  cn = cn.replace(handlerTarget, newHandlers);
  changes++;
  console.log('Added order handlers');
}

// 3. Reset pagination when searching
const searchSetter = '  const [searchTerm, setSearchTerm] = useState(\'\');';
const newSearchSetter = `  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => { setCurrentPage(1); setSelectedOrders(new Set()); }, [searchTerm, showOnlyPending]);
`;
if (cn.includes(searchSetter) && !cn.includes('useEffect(() => { setCurrentPage(1);')) {
  cn = cn.replace(searchSetter, newSearchSetter);
  changes++;
  console.log('Added pagination reset useEffect');
}

// 4. Update order rendering: checkboxes and pagination slice
// First, find the order table rendering loop
// Before: ordersToRender.map((order, index) => (...
// We need to define currentOrders items

const orderTableHead = '<th style={{ padding: \'1rem\' }}>操作</th>';
const newOrderTableHead = `
                    <th style={{ padding: '0.5rem 1rem', width: '40px' }}>
                      <input 
                        type="checkbox" 
                        checked={filteredAndSortedOrders.length > 0 && filteredAndSortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).every(o => selectedOrders.has(\`\${o.Timestamp}-\${o.CustomerToken}-\${o.ProductID}\`))}
                        onChange={() => handleToggleAllOrders(filteredAndSortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage))}
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                    </th>
                    <th style={{ padding: '1rem' }}>操作</th>
`;
if (cn.includes(orderTableHead) && !cn.includes('handleToggleAllOrders')) {
  cn = cn.replace(orderTableHead, newOrderTableHead);
  changes++;
}

// Update Row with checkbox and "Shipped" button
const orderRowStart = '<tr key={index} style={{ borderBottom: \'1px solid var(--border-color)\', transition: \'background 0.2s\' }} className="hover-row">';
const newOrderRowStart = '<tr key={index} style={{ borderBottom: \'1px solid var(--border-color)\', transition: \'background 0.2s\', background: selectedOrders.has(\`\${order.Timestamp}-\${order.CustomerToken}-\${order.ProductID}\`) ? \'rgba(88,166,255,0.1)\' : \'\' }} className="hover-row">';
if (cn.includes(orderRowStart)) {
  cn = cn.replace(orderRowStart, newOrderRowStart);
  changes++;
}

const orderRowCheckSlot = '<td style={{ padding: \'1rem\' }}>';
const newOrderRowCheckSlot = `
                        <td style={{ padding: '1rem' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedOrders.has(\`\${order.Timestamp}-\${order.CustomerToken}-\${order.ProductID}\`)}
                            onChange={() => handleToggleOrderSelection(order)}
                            style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                          />
                        </td>
                        <td style={{ padding: '1rem' }}>
`;
// Only replace the FIRST one inside the loop if possible
// This is tricky. Let's look for a more specific row start
const rowMarker = '{filteredAndSortedOrders.map((order, index) => (';
const rowMarkerReplacement = `{filteredAndSortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((order, index) => (`;
if (cn.includes(rowMarker)) {
  cn = cn.replace(rowMarker, rowMarkerReplacement);
  changes++;
}

// Update actions block to include Shipped button
const actionsBlock = '<button title="核准" onClick={() => updateOrderStatus(order, \'已核准\')';
const newActionsBlock = `
                              <button title="已出貨" onClick={() => updateOrderStatus(order, '已出貨')} style={{ background: 'transparent', border: 'none', color: '#38b2ac', cursor: 'pointer' }}><Truck size={18} /></button>
                              <button title="核准" onClick={() => updateOrderStatus(order, '已核准')
`;
if (cn.includes(actionsBlock) && !cn.includes('title="已出貨"')) {
  cn = cn.replace(actionsBlock, newActionsBlock);
  changes++;
}

fs.writeFileSync(path, isWindows ? cn.replace(/\n/g, '\r\n') : cn, 'utf8');
console.log('Applied ' + changes + ' changes');
