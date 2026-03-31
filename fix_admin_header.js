import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Package, Loader2, CheckCircle, XCircle, Clock, Save, RefreshCw, Trash2, Users, ShieldAlert, Plus, Edit, Key, Truck } from 'lucide-react';

export default function Admin() {
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
