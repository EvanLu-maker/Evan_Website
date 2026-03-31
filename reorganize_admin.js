const fs = require('fs');
const path = 'src/pages/Admin.jsx';

let c = fs.readFileSync(path, 'utf8');
const isWindows = c.includes('\r\n');
let cn = c.replace(/\r\n/g, '\n');

// THE REFACTORING PLAN:
// 1. Move all simple states to the top.
// 2. Move all simple functions (helper functions) below states.
// 3. Move all useMemo hooks below functions.
// 4. Move all useEffect hooks to the bottom of the initialization block.

// This ensures no Temporal Dead Zone (TDZ) for variables used in Hooks.

// Let's identify the blocks.
// I'll use a very safe approach: I will build a clean "header" for the Admin component.

const adminHeader = `export default function Admin() {
  const navigate = useNavigate();
  
  // -- Basic States --
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('orders');
  const [error, setError] = useState('');
  const [adminToken, setAdminToken] = useState('ADMIN');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const itemsPerPage = 10;
  
  // -- UI States --
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [resultPassword, setResultPassword] = useState('');
  const [newCustomer, setNewCustomer] = useState({ account: '', companyName: '', allowedProducts: [] });
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [showEditOrderModal, setShowEditOrderModal] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', minQty: 0, maxQty: 0, unit: '包', leadTime: 1 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'TargetShipDate', direction: 'asc' });
  const [searchTermCustomer, setSearchTermCustomer] = useState('');
  const [sortConfigCustomer, setSortConfigCustomer] = useState({ key: 'Account', direction: 'asc' });

  // -- Helper Functions --
  const getCustomerName = (token) => {
    const c = customers.find(item => String(item.Token) === String(token));
    if (!c) return token;
    return c.公司名稱 || c.店名 || c.Account || token;
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
`;

// Now find where the old definitions end and the hooks begin.
// I'll replace everything from the start of Admin() to the beginning of the first fetchData/useEffect.

const searchStart = "export default function Admin() {";
const searchEnd = "  useEffect(() => {"; // First useEffect is the one for cache loading

if (cn.includes(searchStart) && cn.includes(searchEnd)) {
  const startIndex = cn.indexOf(searchStart);
  const endIndex = cn.indexOf(searchEnd);
  
  // We need to keep everything BETWEEN the hooks and the return, but move our new header in.
  cn = adminHeader + cn.slice(endIndex);
}

// Clean up any double definitions that might have been missed
// (Especially the ones I just injected in previous turns)
cn = cn.replace(/const \[adminToken, setAdminToken\] = useState\('ADMIN'\);\n  const \[currentPage, setCurrentPage\] = useState\(1\);\n  const \[selectedOrders, setSelectedOrders\] = useState\(new Set\(\)\);\n  const itemsPerPage = 10;\n/, '');

fs.writeFileSync(path, isWindows ? cn.replace(/\n/g, '\r\n') : cn, 'utf8');
console.log('Complete Admin.jsx reorganization to fix TDZ/ReferenceError.');
