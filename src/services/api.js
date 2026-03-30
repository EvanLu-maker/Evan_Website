const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const apiCall = async (action, payload = {}) => {
  if (!API_BASE_URL) {
    throw new Error('API URL 未設定，請檢查 .env.local');
  }

  try {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ action, ...payload }),
    });

    const data = await response.json();
    
    if (data.status === 'error') {
      throw new Error(data.message || '發生未知錯誤');
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

export const api = {
  login: (account, password, turnstileToken = null) => 
    apiCall('login', { account, password, turnstileToken }),
    
  getProducts: (customerToken) => 
    apiCall('getProducts', { customerToken }),
    
  submitOrder: (customerToken, ordersData) => 
    apiCall('submitOrder', { customerToken, ordersData }),
    
  getMyOrders: (customerToken) =>
    apiCall('getMyOrders', { customerToken }),
    
  updateProfile: (customerToken, profileData) =>
    apiCall('updateProfile', { customerToken, profileData }),
    
  // Admin APIs
  getLoginLogs: (customerToken) =>
    apiCall('getLoginLogs', { customerToken }),
    
  getCustomers: (customerToken) =>
    apiCall('getCustomers', { customerToken }),
    
  toggleUserBlock: (customerToken, targetAccount, isBlocked) =>
    apiCall('toggleUserBlock', { customerToken, targetAccount, isBlocked }),
    
  addCustomer: (customerToken, customerData) =>
    apiCall('addCustomer', { customerToken, customerData }),
    
  addProduct: (customerToken, productData) =>
    apiCall('addProduct', { customerToken, productData }),
    
  getAdminDashboardData: (customerToken) =>
    apiCall('getAdminDashboardData', { customerToken }),
    
  requestPasswordReset: (accountOrEmail) =>
    apiCall('requestPasswordReset', { accountOrEmail }),
    
  resetPasswordWithCode: (account, code, newPassword) =>
    apiCall('resetPasswordWithCode', { account, code, newPassword })
};
