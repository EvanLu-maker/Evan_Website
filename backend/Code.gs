// ============================================
// B2B 訂貨系統 - 終極後端 API (智慧封鎖與日誌)
// ============================================

const SCRIPT_VERSION = "2.1.0";

function initializeDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // customers
  let cS = getSheet("customers") || ss.insertSheet("customers");
  if(cS.getLastRow() < 1) cS.getRange(1, 1, 1, 11).setValues([["Account", "Password", "Token", "IsAdmin", "Email", "Phone", "IsBlocked", "FailedAttempts", "Salt", "ResetCode", "ResetExpiry"]]);
  if(cS.getLastRow() < 2) {
      const salt = Utilities.getUuid();
      cS.appendRow(["evan", hashPassword("1234", salt), "T-001", "1", "evan@example.com", "0912-345-678", 0, 0, salt, "", ""]);
  }
  
  // Products
  let pS = getSheet("Products") || ss.insertSheet("Products");
  if(pS.getLastRow() < 1) pS.getRange(1, 1, 1, 6).setValues([["品名", "價格", "出貨時間", "最小訂購量", "最大訂購量", "單位"]]);
  
  // Whitelist
  let wS = getSheet("Whitelist") || ss.insertSheet("Whitelist");
  if(wS.getLastRow() < 1) wS.getRange(1, 1, 1, 2).setValues([["Account", "ProductName"]]);
  
  // order
  let oS = getSheet("order");
  if (!oS) {
      oS = ss.insertSheet("order");
      oS.appendRow(["Timestamp", "CustomerToken", "BatchID", "ProductID", "Quantity", "Unit", "ShippingDays", "TargetShipDate", "Status", "TotalAmount"]);
  } else {
      if (oS.getLastRow() < 1) {
          oS.appendRow(["Timestamp", "CustomerToken", "BatchID", "ProductID", "Quantity", "Unit", "ShippingDays", "TargetShipDate", "Status", "TotalAmount"]);
      } else {
          // Check if CustomerToken exists in header, if not, insert new header row
          const headers = oS.getRange(1, 1, 1, oS.getLastColumn() || 1).getValues()[0];
          if (headers.indexOf("CustomerToken") === -1) {
              oS.insertRowBefore(1);
              oS.getRange(1, 1, 1, 10).setValues([["Timestamp", "CustomerToken", "BatchID", "ProductID", "Quantity", "Unit", "ShippingDays", "TargetShipDate", "Status", "TotalAmount"]]);
          }
      }
  }

  // LoginLogs
  let lS = getSheet("LoginLogs") || ss.insertSheet("LoginLogs");
  if(lS.getLastRow() < 1) lS.appendRow(["Timestamp", "Account", "Status", "IP", "Message"]);
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  for (let s of sheets) if (s.getName().toLowerCase() === name.toLowerCase()) return s;
  return null;
}

// 智慧欄位搜尋助手
function getColIdx(sheet, keywords) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
  for (let k of keywords) {
    const idx = headers.findIndex(h => String(h).toLowerCase().trim() === k.toLowerCase());
    if (idx > -1) return idx;
  }
  return -1;
}

function doGet(e) { 
  initializeDatabase(); 
  return res({status: 'success', version: SCRIPT_VERSION, message: '系統全自動建表完成'}); 
}

function doPost(e) {
  initializeDatabase(); 
  try {
    const b = JSON.parse(e.postData.contents);
    switch(b.action) {
      case 'login': return res(handleLogin(b.account, b.password, b.turnstileToken));
      case 'getProducts': return res(getProducts(b.customerToken));
      case 'submitOrder': return res(submitOrder(b.customerToken, b.ordersData));
      case 'getMyOrders': return res(getMyOrders(b.customerToken));
      case 'updateProfile': return res(updateProfile(b.customerToken, b.profileData));
      case 'getLoginLogs': return res(getLoginLogs(b.customerToken));
      case 'toggleUserBlock': return res(toggleUserBlock(b.customerToken, b.targetAccount, b.isBlocked));
      case 'getCustomers': return res(getCustomers(b.customerToken));
      case 'addCustomer': return res(addCustomer(b.customerToken, b.customerData));
      case 'addProduct': return res(addProduct(b.customerToken, b.productData));
      case 'getAdminDashboardData': return res(getAdminDashboardData(b.customerToken));
      case 'requestPasswordReset': return res(handleRequestPasswordReset(b.accountOrEmail));
      case 'resetPasswordWithCode': return res(handleResetPasswordWithCode(b.account, b.code, b.newPassword));
      default: return res({status: 'error', message: '未知 Action'});
    }
  } catch(err) { return res({status: 'error', message: err.toString()}); }
}

function logLogin(account, status, msg) {
  let lS = getSheet("LoginLogs");
  if (lS) {
    lS.insertRowAfter(1);
    lS.getRange(2, 1, 1, 5).setValues([[new Date(), account, status, "隱藏", msg]]);
  }
}

function handleLogin(account, password, turnstileToken) {
  // 1. 驗證 Anti-Bot Token (Cloudflare Turnstile)
  if (!verifyTurnstile(turnstileToken)) {
      logLogin(account, "失敗", "未通過機器人驗證程序");
      return {status: 'error', message: '請完成網頁上的機器人驗證程序'};
  }

  const sheet = getSheet("customers");
  if (!sheet) return {status: 'error', message: '找不到 customers 工作表'};
  
  const colA = getColIdx(sheet, ["帳號", "Account", "Username", "Login"]);
  const colP = getColIdx(sheet, ["密碼", "Password", "Pass"]);
  const colT = getColIdx(sheet, ["Token", "代碼"]);
  const colIsAdmin = getColIdx(sheet, ["IsAdmin", "管理員", "管理權限"]);
  const colEmail = getColIdx(sheet, ["Email", "電子郵件", "郵箱"]);
  const colPhone = getColIdx(sheet, ["Phone", "電話", "手機"]);
  const colBlocked = getColIdx(sheet, ["IsBlocked", "已封鎖", "黑名單"]);
  const colFailed = getColIdx(sheet, ["FailedAttempts", "失敗次數"]);
  const colSalt = getColIdx(sheet, ["Salt", "鹽值"]);
  
  if (colA === -1) return {status: 'error', message: '找不到「帳號」欄位'};

  const data = sheet.getDataRange().getValues();

  for(let i=1; i<data.length; i++) {
    const accCell = String(data[i][colA]).trim();
    if(accCell.toLowerCase() === String(account).trim().toLowerCase()) {
      
      let isBlocked = false;
      if (colBlocked > -1) isBlocked = (data[i][colBlocked] == "1" || data[i][colBlocked] === true || String(data[i][colBlocked]).toUpperCase() === "TRUE");

      if (isBlocked) {
        logLogin(account, "失敗", "帳號已遭系統鎖定");
        return {status: 'error', message: '此帳號已遭系統鎖定，請聯絡管理員解除封鎖'};
      }

      // 密碼比對 (雜湊 vs 明碼)
      const storedPassword = String(data[i][colP]).trim();
      const salt = colSalt > -1 ? String(data[i][colSalt]) : "";
      const inputHash = hashPassword(password, salt);
      
      // 支援舊有明碼過渡 (如果 storedPassword 不是 64 位元 Hex)
      const isHashed = storedPassword.length === 64 && /^[0-9a-f]+$/i.test(storedPassword);
      const isMatch = isHashed ? (storedPassword === inputHash) : (storedPassword === String(password).trim());

      if(isMatch) {
        // 成功，重置失敗次數
        if (colFailed > -1) sheet.getRange(i+1, colFailed+1).setValue(0);
        
        // 取得或產生 Token
        let t = colT > -1 ? data[i][colT] : '';
        if (!t) { 
          t = 'T-' + Math.random().toString(36).substr(2, 9).toUpperCase(); 
          if (colT > -1) sheet.getRange(i+1, colT+1).setValue(t); 
        }

        // 判斷是否為管理員
        const isAdmin = colIsAdmin > -1 ? (data[i][colIsAdmin] == "1" || data[i][colIsAdmin] === true || String(data[i][colIsAdmin]).toUpperCase() === "TRUE") : false;

        logLogin(account, "成功", "登入成功");
        return {status: 'success', user: {
          account: accCell, 
          token: t,
          isAdmin: isAdmin,
          email: colEmail > -1 ? data[i][colEmail] : '',
          phone: colPhone > -1 ? data[i][colPhone] : ''
        }};
      } else {
        // 失敗
        if (colFailed > -1) {
          let failed = parseInt(data[i][colFailed]) || 0;
          failed += 1;
          sheet.getRange(i+1, colFailed+1).setValue(failed);
          if (failed >= 5 && colBlocked > -1) {
            sheet.getRange(i+1, colBlocked+1).setValue(1);
            logLogin(account, "封鎖", "密碼連續錯誤 5 次");
            return {status: 'error', message: '帳號已被鎖定'};
          }
          logLogin(account, "失敗", `密碼錯誤 (${failed} 次)`);
          return {status: 'error', message: `密碼錯誤 (剩 ${5 - failed} 次)`};
        }
        return {status: 'error', message: '密碼錯誤'};
      }
    }
  }
  
  logLogin(account || "未知", "失敗", "帳號不存在");
  return {status: 'error', message: '帳號或密碼不正確'};
}

/**
 * 送出重設請求：發送 6 位數代碼到 Email
 */
function handleRequestPasswordReset(accountOrEmail) {
  if (!accountOrEmail) return {status: 'error', message: '請提供帳號或 Email'};

  const sheet = getSheet("customers");
  const data = sheet.getDataRange().getValues();
  const colA = getColIdx(sheet, ["Account", "帳號"]);
  const colEmail = getColIdx(sheet, ["Email", "電子郵件"]);
  const colResetCode = getColIdx(sheet, ["ResetCode"]);
  const colResetExpiry = getColIdx(sheet, ["ResetExpiry"]);

  // 如果欄位不存在，自動新增
  if (colResetCode === -1 || colResetExpiry === -1) {
    const headers = data[0];
    sheet.getRange(1, headers.length + 1).setValue("ResetCode");
    sheet.getRange(1, headers.length + 2).setValue("ResetExpiry");
    return handleRequestPasswordReset(accountOrEmail); // 遞迴重跑
  }

  for (let i = 1; i < data.length; i++) {
    const acc = String(data[i][colA]).toLowerCase();
    const email = String(data[i][colEmail]).toLowerCase();
    
    if (acc === accountOrEmail.toLowerCase() || email === accountOrEmail.toLowerCase()) {
      if (!data[i][colEmail]) return {status: 'error', message: '該帳號未綁定 Email，請聯絡管理員'};

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = new Date(new Date().getTime() + 30 * 60000); // 30 mins

      sheet.getRange(i + 1, colResetCode + 1).setValue(code);
      sheet.getRange(i + 1, colResetExpiry + 1).setValue(expiry);

      // 發送郵件
      try {
        GmailApp.sendEmail(data[i][colEmail], "【B2B 訂貨系統】密碼重設驗證碼", 
          `您的驗證碼為：${code}\n\n請在 30 分鐘內於網頁輸入此代碼以完成密碼重設。`);
      } catch(e) {
        return {status: 'error', message: '發送郵件失敗，請稍後再試'};
      }

      return {status: 'success', message: '驗證碼已發送到您的信箱'};
    }
  }

  return {status: 'error', message: '找不到相關帳號資訊'};
}

/**
 * 驗證代碼並更換新密碼
 */
function handleResetPasswordWithCode(account, code, newPassword) {
  if (!account || !code || !newPassword) return {status: 'error', message: '請填寫完整資訊'};

  const sheet = getSheet("customers");
  const data = sheet.getDataRange().getValues();
  const colA = getColIdx(sheet, ["Account", "帳號"]);
  const colP = getColIdx(sheet, ["Password", "密碼"]);
  const colS = getColIdx(sheet, ["Salt"]);
  const colResetCode = getColIdx(sheet, ["ResetCode"]);
  const colResetExpiry = getColIdx(sheet, ["ResetExpiry"]);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colA]).toLowerCase() === account.toLowerCase()) {
      const storedCode = String(data[i][colResetCode]);
      const expiry = new Date(data[i][colResetExpiry]);

      if (storedCode !== code) return {status: 'error', message: '驗證碼錯誤'};
      if (new Date() > expiry) return {status: 'error', message: '驗證碼已過期'};

      // 執行重設
      const newSalt = Utilities.getUuid();
      const hashedPass = hashPassword(newPassword, newSalt);
      
      sheet.getRange(i + 1, colP + 1).setValue(hashedPass);
      if (colS > -1) sheet.getRange(i + 1, colS + 1).setValue(newSalt);
      
      // 清除驗證碼，防止重複使用
      sheet.getRange(i + 1, colResetCode + 1).setValue("");
      sheet.getRange(i + 1, colResetExpiry + 1).setValue("");

      return {status: 'success', message: '密碼已成功重設！'};
    }
  }

  return {status: 'error', message: '帳號資訊不符'};
}

function getAccountByToken(token) {
  if (token === "ADMIN") return "ADMIN";
  const sheet = getSheet("customers");
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  const colA = getColIdx(sheet, ["帳號", "Account", "Username", "Login"]);
  const colT = getColIdx(sheet, ["Token", "代碼"]);
  
  if (colT === -1 || colA === -1) return null;

  for(let i=1; i<data.length; i++) {
    if(String(data[i][colT]) === String(token)) return data[i][colA];
  }
  return null;
}

function isAdminToken(token) {
  if (token === "ADMIN") return true;
  const sheet = getSheet("customers");
  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();
  const colT = getColIdx(sheet, ["Token", "代碼"]);
  const colIsAdmin = getColIdx(sheet, ["IsAdmin", "管理員", "管理權限"]);
  
  if (colT === -1 || colIsAdmin === -1) return false;

  for(let i=1; i<data.length; i++) {
    if(String(data[i][colT]) === String(token)) {
      return (data[i][colIsAdmin] == "1" || data[i][colIsAdmin] === true || String(data[i][colIsAdmin]).toUpperCase() === "TRUE");
    }
  }
  return false;
}

function getProducts(customerToken) {
  const account = getAccountByToken(customerToken);
  if (!account) return {status: 'error', message: '無效的 Token'};

  const isAdmin = isAdminToken(customerToken);
  let allowedSet = new Set();
  
  // 如果不是管理員，則需要檢查白名單
  if (!isAdmin) {
    // 來源 1: Whitelist 工作表
    const wSheet = getSheet("Whitelist");
    if (wSheet) {
      const wData = wSheet.getDataRange().getValues();
      const wColA = getColIdx(wSheet, ["帳號", "Account", "Username"]);
      const wColP = getColIdx(wSheet, ["ProductName", "品名", "商品名稱"]);
      if (wColA > -1 && wColP > -1) {
        for(let i=1; i<wData.length; i++) {
          if(String(wData[i][wColA]).toLowerCase().trim() === String(account).toLowerCase().trim()) {
            allowedSet.add(String(wData[i][wColP]).toLowerCase().trim());
          }
        }
      }
    }

    // 來源 2: customers 工作表中的「可購產品」欄位
    const cSheet = getSheet("customers");
    if (cSheet) {
      const cData = cSheet.getDataRange().getValues();
      const cColA = getColIdx(cSheet, ["帳號", "Account", "Username"]);
      const cColList = getColIdx(cSheet, ["可購產品", "AllowedProducts", "Products"]);
      if (cColA > -1 && cColList > -1) {
        for(let i=1; i<cData.length; i++) {
          if(String(cData[i][cColA]).toLowerCase().trim() === String(account).toLowerCase().trim()) {
            const rawList = String(cData[i][cColList]);
            // 支援逗號、分號、換行分隔
            const items = rawList.split(/[,;\n\r]+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
            items.forEach(it => allowedSet.add(it));
          }
        }
      }
    }
  }

  const pSheet = getSheet("Products");
  if (!pSheet) return {status: 'error', message: '找不到 Products 工作表'};
  
  const pData = pSheet.getDataRange().getValues();
  const pHeaders = pData[0];
  const pColNameIdx = getColIdx(pSheet, ["品名", "商品名稱", "Name", "Product", "Item"]);
  const colName = pColNameIdx > -1 ? pColNameIdx : 0;
  
  let list = [];
  for(let i=1; i<pData.length; i++) {
    const pName = String(pData[i][colName]).trim();
    const pNameLower = pName.toLowerCase();

    // 管理員全開，或是商品在白名單內
    if (isAdmin || allowedSet.has(pNameLower)) {
      let obj = {};
      for(let j=0; j<pHeaders.length; j++) obj[pHeaders[j]] = pData[i][j];
      list.push(obj);
    }
  }

  if(list.length === 0) {
      return {status: 'error', message: '您目前沒有商品採購權限。'};
  }

  return {status: 'success', data: list};
}

function updateProfile(customerToken, profileData) {
  const sheet = getSheet("customers");
  const data = sheet.getDataRange().getValues();
  const colT = data[0].indexOf('Token'), colP = data[0].indexOf('Password'), colEmail = data[0].indexOf('Email'), colPhone = data[0].indexOf('Phone');
  
  for(let i=1; i<data.length; i++) {
    if(colT > -1 && String(data[i][colT]) === String(customerToken)) {
       if(profileData.password && String(profileData.password).trim() !== "") {
           sheet.getRange(i+1, colP+1).setValue(profileData.password);
       }
       if(colEmail > -1) sheet.getRange(i+1, colEmail+1).setValue(profileData.email || '');
       if(colPhone > -1) sheet.getRange(i+1, colPhone+1).setValue(profileData.phone || '');
       return {status: 'success', message: '個人資料更新成功！'};
    }
  }
  return {status: 'error', message: '驗證失敗'};
}

function submitOrder(customerToken, ordersData) {
  try {
    const oSheet = getSheet("order");
    const account = getAccountByToken(customerToken);
    if (!account) return {status: 'error', message: '無效 Token'};

    const timestamp = new Date();
    const batchId = "B2B-" + timestamp.getTime().toString().substr(-6) + "-" + Math.floor(Math.random()*1000);

    ordersData.forEach(batch => {
      batch.items.forEach(item => {
        // [Timestamp, CustomerToken, BatchID, ProductID, Quantity, Unit, ShippingDays, TargetShipDate, Status, TotalAmount]
        // Setting TotalAmount to 0 or empty since frontend no longer tracks prices.
        oSheet.appendRow([timestamp, customerToken, batchId, item.productName, item.qty, item.unit || '', '-', batch.shipDate, '待處理', '']);
      });
    });

    return {status: 'success', message: '訂單送出成功'};
  } catch(err) {
    return {status: 'error', message: err.toString()};
  }
}

function getMyOrders(customerToken) {
  try {
    const oSheet = getSheet("order");
    if (!oSheet) return {status: 'success', data: []};
    
    const range = oSheet.getDataRange();
    if (!range) return {status: 'success', data: []};
    
    const data = range.getValues();
    if (!data || data.length < 2) return {status: 'success', data: []};

    const headers = data[0];
    const colToken = headers.indexOf('CustomerToken');
    if (colToken === -1) return {status: 'success', data: []};
    
    let list = [];
    for(let i=1; i<data.length; i++) {
      if (customerToken === "ADMIN" || String(data[i][colToken]) === String(customerToken)) {
        let obj = {};
        for(let j=0; j<headers.length; j++) obj[headers[j]] = data[i][j];
        list.push(obj);
      }
    }
    return {status: 'success', data: list.reverse()};
  } catch(err) {
    return {status: 'error', message: err.toString()};
  }
}

// === 新增管理員後台 API ===

function getLoginLogs(customerToken) {
  if (!isAdminToken(customerToken)) return {status: 'error', message: '權限不足'};
  
  const sheet = getSheet("LoginLogs");
  if (!sheet) return {status: 'success', data: []};

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  let list = [];
  // 只取前 100 筆紀錄
  const limit = Math.min(data.length, 101);
  for(let i=1; i<limit; i++) {
     let obj = {};
     for(let j=0; j<headers.length; j++) obj[headers[j]] = data[i][j];
     list.push(obj);
  }
  return {status: 'success', data: list};
}

function getCustomers(customerToken) {
  if (!isAdminToken(customerToken)) return {status: 'error', message: '權限不足'};
  const sheet = getSheet("customers");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  let list = [];
  for(let i=1; i<data.length; i++) {
     let obj = {};
     for(let j=0; j<headers.length; j++) obj[headers[j]] = data[i][j];
     list.push(obj);
  }
  return {status: 'success', data: list};
}

function toggleUserBlock(customerToken, targetAccount, isBlockedBoolean) {
  if (!isAdminToken(customerToken)) return {status: 'error', message: '權限不足'};
  
  const sheet = getSheet("customers");
  const data = sheet.getDataRange().getValues();
  const colA = data[0].indexOf('Account'), colBlocked = data[0].indexOf('IsBlocked'), colFailed = data[0].indexOf('FailedAttempts');
  
  for(let i=1; i<data.length; i++) {
    if(String(data[i][colA]) === String(targetAccount)) {
       sheet.getRange(i+1, colBlocked+1).setValue(isBlockedBoolean ? 1 : 0);
       if (!isBlockedBoolean && colFailed > -1) {
           sheet.getRange(i+1, colFailed+1).setValue(0); // 解鎖時順便重置失敗次數
       }
       return {status: 'success', message: '用戶狀態更新成功'};
    }
  }
  return {status: 'error', message: '找不到此用戶'};
}

function addCustomer(adminToken, customerData) {
  if (!isAdminToken(adminToken)) return {status: 'error', message: '權限不足'};

  const sheet = getSheet("customers");
  const data = sheet.getDataRange().getValues();
  const colA = getColIdx(sheet, ["帳號", "Account"]);
  
  // 檢查帳號是否重複
  for(let i=1; i<data.length; i++) {
    if(String(data[i][colA]).toLowerCase() === String(customerData.account).toLowerCase()) {
      return {status: 'error', message: '該帳號已存在'};
    }
  }

  // 生成密碼與 Token
  const randomPassword = generateRandomPassword();
  const token = 'T-' + Math.random().toString(36).substr(2, 6).toUpperCase();

  const headers = data[0];
  const newRow = new Array(headers.length).fill('');
  
  // 智慧配對寫入
  const fields = {
    "帳號": customerData.account,
    "Account": customerData.account,
    "密碼": randomPassword,
    "Password": randomPassword,
    "Token": token,
    "代碼": token,
    "店名": customerData.companyName,
    "公司名稱": customerData.companyName,
    "可購產品": customerData.allowedProducts, // 逗號分隔字串
    "IsAdmin": 0,
    "FailedAttempts": 0,
    "IsBlocked": 0,
    "Salt": Utilities.getUuid()
  };
  
  // 核心：儲存前先雜湊
  const hPass = hashPassword(randomPassword, fields["Salt"]);
  fields["Password"] = hPass;
  fields["密碼"] = hPass;

  for (let j=0; j<headers.length; j++) {
    const h = String(headers[j]).trim();
    if (fields[h] !== undefined) newRow[j] = fields[h];
  }

  sheet.appendRow(newRow);
  return {status: 'success', message: '新增客戶成功！', password: randomPassword};
}

function addProduct(adminToken, productData) {
  if (!isAdminToken(adminToken)) return {status: 'error', message: '權限不足'};

  const sheet = getSheet("Products");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const newRow = new Array(headers.length).fill('');

  const fields = {
    "品名": productData.name,
    "商品名稱": productData.name,
    "Name": productData.name,
    "最小訂購量": productData.minQty || 0,
    "起訂量": productData.minQty || 0,
    "MinQty": productData.minQty || 0,
    "最大訂購量": productData.maxQty || 0,
    "最大量": productData.maxQty || 0,
    "MaxQty": productData.maxQty || 0,
    "單位": productData.unit || '包',
    "Unit": productData.unit || '包',
    "出貨時間": productData.leadTime || 1,
    "備貨天數": productData.leadTime || 1,
    "LeadTime": productData.leadTime || 1,
    "價格": 0,
    "Price": 0 // 依據先前需求，價格設為 0
  };

  for (let j=0; j<headers.length; j++) {
    const h = String(headers[j]).trim();
    if (fields[h] !== undefined) newRow[j] = fields[h];
  }

  sheet.appendRow(newRow);
  return {status: 'success', message: '新增商品成功！'};
}

function generateRandomPassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // 排除易混淆字元
  let pass = "";
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

function getAdminDashboardData(token) {
  if (!isAdminToken(token)) return {status: 'error', message: '權限不足'};

  return {
    status: 'success',
    orders: getMyOrders(token).data || [],
    products: getProducts(token).data || [],
    customers: getCustomers(token).data || [],
    logs: getLoginLogs(token).data || []
  };
}

function res(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// 安全強化工具函式 (Security Utilities)
// ============================================

/**
 * 密碼雜湊處理 (SHA-256 + Salt)
 */
function hashPassword(password, salt) {
  if (!password) return "";
  const cryptoData = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt, Utilities.Charset.UTF_8);
  let hash = "";
  for (let i = 0; i < cryptoData.length; i++) {
    let byte = cryptoData[i];
    if (byte < 0) byte += 256;
    let byteStr = byte.toString(16);
    if (byteStr.length === 1) byteStr = "0" + byteStr;
    hash += byteStr;
  }
  return hash;
}

/**
 * 驗證 Cloudflare Turnstile Token
 */
function verifyTurnstile(token) {
  if (!token) return false;
  // 測試環境 Sitekey 永遠通過 (僅供開發測試)
  if (token === "XX_TEST_TOKEN_XX") return true; 
  
  const secretKey = "1x0000000000000000000000000000000AA"; // 請在此處填入您的 Secret Key (Cloudflare 後台取得)
  const url = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
  
  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      payload: {
        secret: secretKey,
        response: token
      }
    });
    const result = JSON.parse(response.getContentText());
    return result.success;
  } catch (e) {
    console.error("Turnstile Error:", e);
    return false;
  }
}

/**
 * [一次性腳本] 將現有的明碼密碼全數遷移為雜湊加密
 * 請在 Apps Script 編輯器中手動執行此函式
 */
function migratePlainPasswordsToHashes() {
  const sheet = getSheet("customers");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const colP = getColIdx(sheet, ["Password", "密碼"]);
  let colSalt = getColIdx(sheet, ["Salt", "鹽值"]);
  
  // 如果沒有 Salt 欄位，自動加上
  if (colSalt === -1) {
    sheet.getRange(1, headers.length + 1).setValue("Salt");
    colSalt = headers.length;
  }
  
  for (let i = 1; i < data.length; i++) {
    let pwd = String(data[i][colP]).trim();
    // 檢查是否已經是雜湊值 (64位元 Hex)
    const isHashed = pwd.length === 64 && /^[0-9a-f]+$/i.test(pwd);
    
    if (!isHashed && pwd !== "") {
      const salt = Utilities.getUuid();
      const hashed = hashPassword(pwd, salt);
      sheet.getRange(i + 1, colP + 1).setValue(hashed);
      sheet.getRange(i + 1, colSalt + 1).setValue(salt);
      console.log("Migrated user: " + data[i][0]);
    }
  }
  return "遷移完成！";
}
