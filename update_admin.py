file_path = r'src\pages\Admin.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# --- 1. Fix Customer Edit Mapping ---
old_set = (
    "setEditingCustomer({\n"
    "                                   account: cust.Account,\n"
    "                                   companyName: cust.\u516c\u53f8\u540d\u7a31 || cust.\u5e97\u540d || '',\n"
    "                                   email: cust.Email || '',\n"
    "                                   phone: cust.Phone || '',\n"
    "                                   allowedProducts: (cust.\u53ef\u8cfc\u7522\u54c1 || '').split(',').filter(x => x)\n"
    "                                 });"
)

new_set = (
    "setEditingCustomer({\n"
    "                                   account: cust.account,\n"
    "                                   companyName: cust.companyName,\n"
    "                                   email: cust.email || '',\n"
    "                                   phone: cust.phone || '',\n"
    "                                   address: cust.address || '',\n"
    "                                   allowedProducts: (cust.\u53ef\u8cfc\u7522\u54c1 || '').split(',').filter(x => x)\n"
    "                                 });"
)

if old_set in content:
    content = content.replace(old_set, new_set)
    changes += 1
    print('Step 1 OK: Customer mapping fixed')
else:
    print('Step 1 SKIP: pattern not found (may already be fixed)')

# --- 2. Add Pagination + Batch Bar after order table ---
old_footer = (
    "                </tbody>\n"
    "              </table>\n"
    "            </div>\n"
    "          </div>\n"
    "        )}"
)

new_footer = """                </tbody>
              </table>
            </div>

            {/* --- \u5206\u9801\u8207\u6279\u6b21\u64cd\u4f5c\u5217 --- */}
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                \u986f\u793a\u7b2c {filteredAndSortedOrders.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} \u81f3 {Math.min(currentPage * itemsPerPage, filteredAndSortedOrders.length)} \u7b46\uff0c\u5171 {filteredAndSortedOrders.length} \u7b46
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="btn btn-outline"
                  style={{ padding: '0.4rem 0.8rem' }}
                >
                  \u4e0a\u4e00\u9801
                </button>
                {[...Array(Math.ceil(filteredAndSortedOrders.length / itemsPerPage))].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setCurrentPage(i + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className={`btn ${currentPage === i + 1 ? 'btn-primary' : 'btn-outline'}`}
                    style={{ padding: '0.4rem 0.8rem', minWidth: '40px' }}
                  >
                    {i + 1}
                  </button>
                )).slice(Math.max(0, currentPage - 3), Math.min(Math.ceil(filteredAndSortedOrders.length / itemsPerPage), currentPage + 2))}
                <button
                  disabled={currentPage === Math.ceil(filteredAndSortedOrders.length / itemsPerPage) || filteredAndSortedOrders.length === 0}
                  onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="btn btn-outline"
                  style={{ padding: '0.4rem 0.8rem' }}
                >
                  \u4e0b\u4e00\u9801
                </button>
              </div>
            </div>

            {selectedOrders.size > 0 && (
              <div className="animate-fade-in" style={{
                position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
                background: 'var(--primary-color)', color: '#fff', padding: '1rem 2rem',
                borderRadius: '50px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', gap: '1.5rem', zIndex: 1000,
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <div style={{ fontWeight: '600' }}>\u5df2\u9078\u53d6 {selectedOrders.size} \u7b46\u8a02\u55ae</div>
                <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.3)' }}></div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleBatchUpdateStatus('\u5df2\u6838\u51c6')} className="btn" style={{ background: 'rgba(255,255,255,0.2)', padding: '0.4rem 1rem', fontSize: '0.85rem', color: '#fff' }}>\u6838\u51c6</button>
                  <button onClick={() => handleBatchUpdateStatus('\u5df2\u51fa\u8ca8')} className="btn" style={{ background: 'rgba(255,255,255,0.2)', padding: '0.4rem 1rem', fontSize: '0.85rem', color: '#fff' }}>\u5df2\u51fa\u8ca8</button>
                  <button onClick={() => handleBatchUpdateStatus('\u5df2\u53d6\u6d88')} className="btn" style={{ background: 'rgba(248, 81, 73, 0.4)', padding: '0.4rem 1rem', fontSize: '0.85rem', color: '#fff' }}>\u53d6\u6d88</button>
                </div>
                <button onClick={() => setSelectedOrders(new Set())} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7 }}><XCircle size={18} /></button>
              </div>
            )}
          </div>
        )}"""

# Count occurrences to avoid wrong replacement
count = content.count(old_footer)
print(f'Step 2: Found {count} occurrence(s) of order table footer')

if count == 1:
    content = content.replace(old_footer, new_footer)
    changes += 1
    print('Step 2 OK: Pagination + batch bar added')
elif count > 1:
    print('Step 2 SKIP: Multiple occurrences, unsafe to replace')
else:
    print('Step 2 SKIP: Footer pattern not found')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Done. Total changes applied: {changes}')
