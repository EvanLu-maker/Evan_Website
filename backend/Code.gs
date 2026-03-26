// ============================================
// B2B 訂貨系統 - Google Apps Script 後端 API
// ============================================

const SCRIPT_VERSION = "1.1.0";

/**
 * 取得工作表 (具有大小寫防呆功能)
 */
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // 嘗試精確匹配
  let sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  
  // 嘗試不分大小寫匹配
  const sheets = ss.getSheets();
  for (let s of sheets) {
    if (s.getName().toLowerCase() === name.toLowerCase()) return s;
  }
  return null;
}

/**
 * 處理 GET 請求 (測試連線用)
 */
function doGet(e) {
  return createResponse({
    status: 'success',
    message: 'B2B API is running v' + SCRIPT_VERSION,
    action_requested: e.parameter.action || 'none'
  });
}

/**
 * 處理 POST 請求 (主要 API 進入點)
 */
function doPost(e) {
  try {
    const postBody = JSON.parse(e.postData.contents);
    const action = postBody.action;

    // 路由 (Routing)
    switch(action) {
      case 'login':
        return handleLogin(postBody.account, postBody.password);
      case 'getProducts':
        return getProducts(postBody.customerToken);
      case 'submitOrder':
        return submitOrder(postBody.customerToken, postBody.ordersData);
      case 'getMyOrders':
        return getMyOrders(postBody.customerToken);
      default:
        return createResponse({ status: 'error', message: '未知的 Action: ' + action });
    }
  } catch(error) {
    return createResponse({ status: 'error', message: error.toString() });
  }
}

/**
 * 登入處理
 */
function handleLogin(account, password) {
  const sheet = getSheet("customers");
  if (!sheet) return createResponse({ status: 'error', message: '找不到 customers 工作表' });

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const colAccount = headers.indexOf('Account');
  const colPassword = headers.indexOf('Password');
  const colToken = headers.indexOf('Token');
  const colIsAdmin = headers.indexOf('IsAdmin');
  
  if(colAccount === -1 || colPassword === -1) 
    return createResponse({ status: 'error', message: '資料表缺漏必填欄位 (Account, Password)' });

  for(let i = 1; i < data.length; i++) {
    if(String(data[i][colAccount]) === String(account) && String(data[i][colPassword]) === String(password)) {
      return createResponse({
        status: 'success',
        user: {
          account: data[i][colAccount],
          token: data[i][colToken] || 'auto-token-' + i,
          isAdmin: data[i][colIsAdmin] == "1" || data[i][colIsAdmin] === true
        }
      });
    }
  }
  return createResponse({ status: 'error', message: '帳號或密碼錯誤' });
}

/**
 * 獲取客戶商品列表
 */
function getProducts(customerToken) {
  const productSheet = getSheet("Products");
  if (!productSheet) return createResponse({ status: 'error', message: '找不到 Products 工作表' });

  const data = productSheet.getDataRange().getValues();
  const headers = data[0];
  
  let products = [];
  for(let i = 1; i < data.length; i++) {
    let p = {};
    headers.forEach((h, index) => {
      p[h] = data[i][index];
    });
    products.push(p);
  }
  return createResponse({ status: 'success', data: products });
}

/**
 * 提交訂單 (支援自動拆單寫入)
 */
function submitOrder(customerToken, ordersData) {
  const orderSheet = getSheet("order");
  if (!orderSheet) return createResponse({ status: 'error', message: '找不到 order 工作表' });

  // 取得客戶名稱 (簡單模擬，正式版應從 Token 反查)
  const customerName = customerToken; 
  const timestamp = new Date();
  
  // 檢查標題列，若為空則寫入標題
  if (orderSheet.getLastRow() === 0) {
    orderSheet.appendRow(['Timestamp', 'CustomerToken', 'ProductID', 'Quantity', 'ShippingDays', 'Status', 'TotalAmount']);
  }

  // ordersData 為陣列，每個元素代表一個批次 (拆單後的結果)
  ordersData.forEach(batch => {
    batch.items.forEach(item => {
      orderSheet.appendRow([
        timestamp,
        customerName,
        item.productName,
        item.quantity,
        batch.expectedShippingDays,
        '待處理',
        batch.batchTotal // 簡化版，僅記錄金額
      ]);
    });
  });

  return createResponse({ status: 'success', message: '訂單已成功存入試算表' });
}

/**
 * 獲取歷史訂單
 */
function getMyOrders(customerToken) {
  const orderSheet = getSheet("order");
  if (!orderSheet) return createResponse({ status: 'success', data: [] });

  const data = orderSheet.getDataRange().getValues();
  const headers = data[0];
  const colToken = headers.indexOf('CustomerToken');
  
  let myOrders = [];
  for(let i = 1; i < data.length; i++) {
    if (String(data[i][colToken]) === String(customerToken)) {
      let order = {};
      headers.forEach((h, index) => {
        order[h] = data[i][index];
      });
      myOrders.push(order);
    }
  }
  return createResponse({ status: 'success', data: myOrders.reverse() }); // 最新訂單在前
}

/**
 * 回傳 JSON 給前端
 */
function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
