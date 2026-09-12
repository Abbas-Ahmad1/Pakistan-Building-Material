#!/usr/bin/env python3
import json
import time
import urllib.request
import urllib.parse
import sys

BASE_URL = "http://127.0.0.1:8080"

test_results = {
    "passed": [],
    "failed": []
}

def record_pass(name, detail=""):
    print(f"  [PASS] {name}" + (f" - {detail}" if detail else ""))
    test_results["passed"].append(name)

def record_fail(name, error):
    print(f"  [FAIL] {name} - ERROR: {error}")
    test_results["failed"].append((name, str(error)))

def api_call(method, endpoint, data=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    req_body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=req_body, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as response:
            status = response.status
            body = response.read().decode("utf-8")
            try:
                return status, json.loads(body)
            except Exception:
                return status, body
    except urllib.error.HTTPError as e:
        status = e.code
        body = e.read().decode("utf-8")
        try:
            return status, json.loads(body)
        except Exception:
            return status, body

print("==================================================")
print("STARTING E2E TEST SUITE FOR PHP + MYSQL BACKEND")
print("==================================================")

admin_token = None
cashier_token = None

# 1. Login/Logout
print("\n--- 1. Testing Login & Logout ---")
try:
    st, res = api_call("POST", "/api/auth/login", {"username": "admin", "password": "wrongpassword"})
    assert st == 401 and res.get("success") == False, f"Expected 401 on wrong password, got {st}"
    record_pass("Login rejection with invalid credentials")

    st, res = api_call("POST", "/api/auth/login", {"username": "admin", "password": "admin123"})
    assert st == 200 and res.get("success") == True, f"Admin login failed: {res}"
    admin_token = res["data"]["token"]
    assert admin_token, "Admin token missing"
    assert res["data"]["user"]["role"] == "ADMIN", "Role should be ADMIN"
    record_pass("Admin login successful", f"Token acquired, role={res['data']['user']['role']}")

    st, res = api_call("POST", "/api/auth/login", {"username": "cashier", "password": "cashier123"})
    assert st == 200 and res.get("success") == True, f"Cashier login failed: {res}"
    cashier_token = res["data"]["token"]
    assert cashier_token, "Cashier token missing"
    assert res["data"]["user"]["role"] == "CASHIER", "Role should be CASHIER"
    record_pass("Cashier login successful", f"Role={res['data']['user']['role']}")

    # Test /api/auth/me
    st, res = api_call("GET", "/api/auth/me", token=admin_token)
    assert st == 200 and res["data"]["username"] == "admin", f"auth/me failed: {res}"
    record_pass("Verify active session (/api/auth/me)")
except Exception as e:
    record_fail("Login/Logout Suite", e)

# 2. RBAC & Roles Permissions
print("\n--- 2. Testing RBAC & Role Restrictions ---")
try:
    # Cashier should not access profit-loss report
    st, res = api_call("GET", "/api/reports/profit-loss", token=cashier_token)
    assert st == 403, f"Cashier should be forbidden from profit-loss, got {st} {res}"
    record_pass("RBAC: Cashier restricted from Profit & Loss report (403 Forbidden)")

    # Admin CAN access profit-loss
    st, res = api_call("GET", "/api/reports/profit-loss", token=admin_token)
    assert st == 200 and "net_profit" in res.get("data", {}), f"Admin should access P&L: {res}"
    record_pass("RBAC: Admin successfully accesses Profit & Loss report")
except Exception as e:
    record_fail("RBAC Suite", e)

# 3. Dashboard Metrics
print("\n--- 3. Testing Dashboard Metrics ---")
try:
    st, res = api_call("GET", "/api/dashboard/metrics", token=admin_token)
    assert st == 200 and res.get("success") == True, f"Failed dashboard metrics: {res}"
    data = res["data"]
    assert "todaySales" in data and "totalProducts" in data and "chartData" in data
    record_pass("Dashboard metrics returned correctly", f"Products count={data['totalProducts']}, sales={data['todaySales']}")
except Exception as e:
    record_fail("Dashboard Metrics Suite", e)

# 4. Products & Categories
print("\n--- 4. Testing Products & Categories ---")
created_product_id = None
try:
    st, res = api_call("GET", "/api/categories", token=admin_token)
    assert st == 200 and len(res["data"]) > 0, "Categories empty"
    first_cat = res["data"][0]
    cat_id = first_cat["id"]
    record_pass("Fetch categories", f"Found {len(res['data'])} categories")

    st, res = api_call("GET", "/api/products", token=admin_token)
    assert st == 200 and len(res["data"]) > 0, "Products empty"
    record_pass("Fetch products list", f"Total products: {len(res['data'])}")

    # Create new test product
    unique_suffix = int(time.time() * 1000)
    new_prod = {
        "name": f"E2E Test Brass Ball Valve 1 inch {unique_suffix % 10000}",
        "sku": f"VALVE-{unique_suffix}",
        "category_id": cat_id,
        "unit": "Piece",
        "purchase_price": 450.0,
        "selling_price": 600.0,
        "current_stock": 50.0,
        "minimum_stock": 10.0,
        "barcode": f"89{unique_suffix % 10000000000:010d}"
    }
    st, res = api_call("POST", "/api/products", new_prod, token=admin_token)
    assert st == 201 and res.get("success") == True, f"Product creation failed: {res}"
    created_product_id = res["data"]["id"]
    record_pass("Create new product", f"ID={created_product_id}, SKU={new_prod['sku']}")

    # Verify product shows in search
    st, res = api_call("GET", f"/api/products/search?q={urllib.parse.quote('Ball Valve')}", token=admin_token)
    assert st == 200 and any(p["id"] == created_product_id for p in res["data"]), "Product not found in search"
    record_pass("Search product by query")
except Exception as e:
    record_fail("Products & Categories Suite", e)

# 5. Customers & Khata Ledger
print("\n--- 5. Testing Customers & Khata ---")
customer_id = None
try:
    st, res = api_call("GET", "/api/customers", token=admin_token)
    assert st == 200 and len(res["data"]) > 0, "Customers empty"
    record_pass("Fetch customers list", f"Found {len(res['data'])} customers")

    # Create test customer with credit limit
    unique_cust_suffix = int(time.time() * 1000)
    new_cust = {
        "name": f"E2E Contractor Aslam {unique_cust_suffix % 10000}",
        "phone": f"0300{unique_cust_suffix % 10000000:07d}",
        "address": "Gulberg Main Road, Lahore",
        "credit_limit": 50000.0
    }
    st, res = api_call("POST", "/api/customers", new_cust, token=admin_token)
    assert st == 201 and res.get("success") == True, f"Customer creation failed: {res}"
    customer_id = res["data"]["id"]
    record_pass("Create new customer with Khata credit limit", f"ID={customer_id}")

    # Fetch customer detail
    st, res = api_call("GET", f"/api/customers/{customer_id}", token=admin_token)
    assert st == 200 and res["data"]["outstanding_balance"] == 0, "Initial balance should be 0"
    record_pass("Customer initial ledger detail verified")
except Exception as e:
    record_fail("Customers & Khata Suite", e)

# 6. Cash Drawer Management
print("\n--- 6. Testing Cash Drawer Shifts & Petty Expenses ---")
try:
    st, res = api_call("GET", "/api/cash-drawer/status", token=admin_token)
    assert st == 200 and res.get("success") == True, f"Failed cash drawer status: {res}"
    record_pass("Check cash drawer status")

    # Record petty cash expense from drawer
    drawer_exp = {
        "title": "Shop Tea and Biscuits",
        "category": "Tea & Refreshments",
        "amount": 250.0,
        "notes": "E2E automated test petty cash"
    }
    st, res = api_call("POST", "/api/cash-drawer/expense", drawer_exp, token=admin_token)
    assert st == 201 and res.get("success") == True, f"Drawer expense failed: {res}"
    record_pass("Record drawer petty cash expense", "Rs. 250.00")
except Exception as e:
    record_fail("Cash Drawer Suite", e)

# 7. POS Checkout & Sales Transactions (Atomic)
print("\n--- 7. Testing POS Checkout, Invoices & Stock Deductions ---")
sale_id = None
invoice_number = None
try:
    # Check current stock before sale
    st, res = api_call("GET", f"/api/products/{created_product_id}", token=admin_token)
    initial_stock = float(res["data"]["current_stock"])
    assert initial_stock == 50.0, f"Expected 50.0 initial stock, got {initial_stock}"

    # Perform POS Sale: 5 items @ 600 = 3000, 100 discount = 2900 total. Pay 1500, Due 1400 on Customer Khata!
    sale_payload = {
        "customer_id": customer_id,
        "items": [
            {
                "product_id": created_product_id,
                "quantity": 5.0,
                "unit_price": 600.0,
                "discount_amount": 0.0
            }
        ],
        "subtotal": 3000.0,
        "discount_amount": 100.0,
        "tax_amount": 0.0,
        "grand_total": 2900.0,
        "paid_amount": 1500.0,
        "payment_method": "CASH",
        "notes": "E2E Automated POS Sale"
    }
    st, res = api_call("POST", "/api/sales", sale_payload, token=admin_token)
    assert st == 201 and res.get("success") == True, f"Sale checkout failed: {res}"
    sale_id = res["data"]["sale_id"]
    invoice_number = res["data"]["invoice_number"]
    assert invoice_number.startswith("INV-"), f"Invalid invoice number format: {invoice_number}"
    record_pass("POS Sale checkout completed atomically", f"ID={sale_id}, Invoice={invoice_number}")

    # Verify Stock Deduction: 50.0 - 5.0 = 45.0
    st, res = api_call("GET", f"/api/products/{created_product_id}", token=admin_token)
    new_stock = float(res["data"]["current_stock"])
    assert new_stock == 45.0, f"Stock should be 45.0 after sale of 5 items, got {new_stock}"
    record_pass("Atomic Stock Deduction verified", "50.0 -> 45.0 units")

    # Verify Customer Khata Due Balance: should now be 1400.0 (2900 total - 1500 paid)
    st, res = api_call("GET", f"/api/customers/{customer_id}", token=admin_token)
    cust_data = res["data"]
    assert float(cust_data["outstanding_balance"]) == 1400.0, f"Expected 1400 balance, got {cust_data['outstanding_balance']}"
    record_pass("Customer Khata balance automatically updated", "Rs. 1,400.00 outstanding")

    # Fetch Invoice Details
    st, res = api_call("GET", f"/api/sales/{sale_id}", token=admin_token)
    assert st == 200 and res["data"]["invoice_number"] == invoice_number, "Invoice lookup failed"
    assert len(res["data"]["items"]) == 1, "Invoice items count mismatch"
    record_pass("Invoice and line items retrieval verified")
except Exception as e:
    record_fail("POS Checkout & Sales Suite", e)

# 8. Customer Khata Payment
print("\n--- 8. Testing Customer Khata Payment Recovery ---")
try:
    # Customer pays 1000 of the 1400 outstanding
    payment_payload = {
        "amount": 1000.0,
        "payment_method": "CASH",
        "notes": "Partial khata recovery payment"
    }
    st, res = api_call("POST", f"/api/customers/{customer_id}/payments", payment_payload, token=admin_token)
    assert st == 201 and res.get("success") == True, f"Customer payment failed: {res}"
    record_pass("Record Khata recovery payment", "Rs. 1000.00 paid")

    # Verify new outstanding balance: 1400 - 1000 = 400
    st, res = api_call("GET", f"/api/customers/{customer_id}", token=admin_token)
    balance = float(res["data"]["outstanding_balance"])
    assert balance == 400.0, f"Expected balance 400.0, got {balance}"
    record_pass("Customer Khata recalculated correctly", "Remaining balance: Rs. 400.00")
except Exception as e:
    record_fail("Customer Khata Payment Suite", e)

# 9. Sales Returns & Restocking
print("\n--- 9. Testing Sales Returns & Stock Restoration ---")
try:
    # Return 2 units of the 5 sold
    return_payload = {
        "items": [
            {
                "product_id": created_product_id,
                "quantity": 2.0,
                "unit_price": 600.0,
                "refund_amount": 1200.0,
                "condition_status": "GOOD",
                "restock": True
            }
        ],
        "refund_type": "CASH",
        "reason": "Customer ordered excess quantity",
        "deduct_from_drawer": True
    }
    st, res = api_call("POST", f"/api/sales/{sale_id}/returns", return_payload, token=admin_token)
    assert st == 201 and res.get("success") == True, f"Return failed: {res}"
    record_pass("Sales return processed successfully", "2 units returned")

    # Verify Stock Restocked: 45.0 + 2.0 = 47.0
    st, res = api_call("GET", f"/api/products/{created_product_id}", token=admin_token)
    restocked_stock = float(res["data"]["current_stock"])
    assert restocked_stock == 47.0, f"Expected stock 47.0 after return, got {restocked_stock}"
    record_pass("Product restocked back to inventory", "45.0 -> 47.0 units")
except Exception as e:
    record_fail("Sales Returns Suite", e)

# 10. Suppliers & Inward Purchasing
print("\n--- 10. Testing Suppliers & Purchasing ---")
supplier_id = None
try:
    st, res = api_call("GET", "/api/suppliers", token=admin_token)
    assert st == 200 and len(res["data"]) > 0, "Suppliers empty"
    record_pass("Fetch suppliers list", f"Found {len(res['data'])} suppliers")

    # Create test supplier
    sup_suffix = int(time.time() * 1000)
    new_sup = {
        "name": f"E2E Master Sanitary Mills {sup_suffix % 10000}",
        "contact_person": "Haji Tariq",
        "phone": f"0321{sup_suffix % 10000000:07d}",
        "email": f"tariq{sup_suffix % 10000}@sanitarymills.com",
        "address": "Gujranwala Industrial Estate"
    }
    st, res = api_call("POST", "/api/suppliers", new_sup, token=admin_token)
    assert st == 201 and res.get("success") == True, f"Supplier creation failed: {res}"
    supplier_id = res["data"]["id"]
    record_pass("Create new supplier", f"ID={supplier_id}")

    # Inward Purchase: 20 units @ 420.0 = 8400.0. Pay 4000.0, Due 4400.0 on Supplier Ledger!
    purchase_payload = {
        "supplier_id": supplier_id,
        "items": [
            {
                "product_id": created_product_id,
                "quantity": 20.0,
                "unit_cost": 420.0
            }
        ],
        "grand_total": 8400.0,
        "paid_amount": 4000.0,
        "payment_method": "CASH",
        "notes": "E2E Stock Inward Restock"
    }
    st, res = api_call("POST", "/api/purchases", purchase_payload, token=admin_token)
    assert st == 201 and res.get("success") == True, f"Purchase failed: {res}"
    po_num = res["data"]["purchase_number"]
    record_pass("Inward purchase order recorded atomically", f"PO={po_num}")

    # Verify Stock Inward Addition: 47.0 + 20.0 = 67.0
    st, res = api_call("GET", f"/api/products/{created_product_id}", token=admin_token)
    inward_stock = float(res["data"]["current_stock"])
    assert inward_stock == 67.0, f"Expected 67.0 stock, got {inward_stock}"
    record_pass("Inventory stock increased upon inward purchase", "47.0 -> 67.0 units")

    # Verify Supplier Payable Ledger: should be 4400.0
    st, res = api_call("GET", f"/api/suppliers/{supplier_id}", token=admin_token)
    payable = float(res["data"]["payable_balance"])
    assert payable == 4400.0, f"Expected payable 4400.0, got {payable}"
    record_pass("Supplier ledger payable balance updated", "Rs. 4,400.00 payable")

    # Record Supplier Payment: pay 2000.0
    st, res = api_call("POST", f"/api/suppliers/{supplier_id}/payments", {"amount": 2000.0, "payment_method": "BANK_TRANSFER"}, token=admin_token)
    assert st == 201, "Supplier payment failed"
    st, res = api_call("GET", f"/api/suppliers/{supplier_id}", token=admin_token)
    assert float(res["data"]["payable_balance"]) == 2400.0, f"Expected remaining 2400.0 payable"
    record_pass("Supplier payment processed & remaining balance verified", "Rs. 2,400.00 remaining")
except Exception as e:
    record_fail("Suppliers & Purchasing Suite", e)

# 11. Multi-Branch Operations & Stock Transfers
print("\n--- 11. Testing Multi-Branch & Stock Transfers ---")
try:
    st, res = api_call("GET", "/api/branches", token=admin_token)
    assert st == 200 and len(res["data"]) >= 2, "Need at least 2 branches for transfer test"
    from_b = res["data"][0]["id"]
    to_b = res["data"][1]["id"]
    record_pass("Branches verified", f"Branch 1: ID={from_b}, Branch 2: ID={to_b}")

    # Fetch stock matrix
    st, res = api_call("GET", "/api/branches/matrix/stock", token=admin_token)
    assert st == 200 and "products" in res["data"], "Matrix stock failed"
    record_pass("Multi-Branch Stock Matrix fetched successfully")

    # Transfer 10 units from Branch 1 to Branch 2
    transfer_payload = {
        "from_branch_id": from_b,
        "to_branch_id": to_b,
        "items": [
            {
                "product_id": created_product_id,
                "quantity": 10.0
            }
        ],
        "notes": "E2E automated inter-branch stock rebalance"
    }
    st, res = api_call("POST", "/api/branches/transfers", transfer_payload, token=admin_token)
    assert st == 200 and res.get("success") == True, f"Stock transfer failed: {res}"
    trf_num = res["data"]["transfer_number"]
    record_pass("Atomic Inter-Branch Stock Transfer completed", f"Transfer #{trf_num} (10 units)")

    # Verify transfer history
    st, res = api_call("GET", "/api/branches/transfers", token=admin_token)
    assert st == 200 and len(res["data"]) > 0, "Transfers list empty"
    record_pass("Stock transfer audit history retrieved")
except Exception as e:
    record_fail("Multi-Branch Transfers Suite", e)

# 12. Quotations & Conversion to Sale
print("\n--- 12. Testing Quotations & Sale Conversion ---")
quotation_id = None
try:
    quot_payload = {
        "customer_id": customer_id,
        "customer_name": "E2E Contractor Aslam",
        "items": [
            {
                "product_id": created_product_id,
                "quantity": 3.0,
                "unit_price": 600.0
            }
        ],
        "subtotal": 1800.0,
        "discount_amount": 50.0,
        "tax_amount": 0.0,
        "grand_total": 1750.0,
        "notes": "Commercial project estimate"
    }
    st, res = api_call("POST", "/api/quotations", quot_payload, token=admin_token)
    assert st == 201 and res.get("success") == True, f"Quotation creation failed: {res}"
    quotation_id = res["data"]["id"]
    quot_num = res["data"]["quotation_number"]
    record_pass("Create quotation estimate", f"ID={quotation_id}, #{quot_num}")

    # Convert Quotation to POS Sale
    st, res = api_call("POST", f"/api/quotations/{quotation_id}/convert-to-sale", {"payment_method": "CASH"}, token=admin_token)
    assert st == 201 and res.get("success") == True, f"Quotation conversion failed: {res}"
    converted_inv = res["data"]["invoice_number"]
    record_pass("Convert quotation to POS Sale invoice", f"Generated invoice: {converted_inv}")
except Exception as e:
    record_fail("Quotations Suite", e)

# 13. Reports, P&L, Inventory Valuation & Zakat
print("\n--- 13. Testing Financial Reports, P&L, Valuation & Zakat ---")
try:
    # Summary
    st, res = api_call("GET", "/api/reports/summary", token=admin_token)
    assert st == 200 and "today" in res["data"], "Reports summary failed"
    record_pass("Store Real-Time KPI summary retrieved")

    # Bestsellers
    st, res = api_call("GET", "/api/reports/bestsellers", token=admin_token)
    assert st == 200, "Bestsellers failed"
    record_pass("Fast-moving bestsellers report retrieved")

    # Profit & Loss
    st, res = api_call("GET", "/api/reports/profit-loss", token=admin_token)
    assert st == 200 and "gross_profit" in res["data"], "P&L failed"
    pnl = res["data"]
    record_pass("Profit & Loss statement calculated", f"Gross Profit=Rs. {pnl['gross_profit']}, Net Profit=Rs. {pnl['net_profit']}")

    # Inventory Valuation
    st, res = api_call("GET", "/api/inventory/summary", token=admin_token)
    assert st == 200 and "total_cost_value" in res["data"], "Inventory valuation failed"
    val = res["data"]
    record_pass("Inventory stock valuation computed", f"Cost: Rs. {val['total_cost_value']}, Retail: Rs. {val['total_retail_value']}")

    # Zakat Assessment
    st, res = api_call("GET", "/api/zakat/calculate", token=admin_token)
    assert st == 200 and "net_zakatable_wealth" in res["data"], "Zakat calculation failed"
    zakat = res["data"]
    record_pass("Shariah Zakat Assessment calculated", f"Net Wealth=Rs. {zakat['net_zakatable_wealth']}, Zakat Due=Rs. {zakat['zakat_due_amount']}")

    # Save Zakat record
    st, res = api_call("POST", "/api/zakat/save", {
        "inventory_value": zakat["inventory_value"],
        "cash_value": zakat["cash_in_hand"],
        "bank_balance": 0.0,
        "receivables": zakat["trade_receivables"],
        "liabilities": zakat["current_liabilities"],
        "notes": "E2E Automated Assessment"
    }, token=admin_token)
    assert st == 201, "Save zakat failed"
    record_pass("Zakat assessment snapshot saved to audit database")
except Exception as e:
    record_fail("Reports & Valuation Suite", e)

# 14. Audit Logs & System Activity Trail
print("\n--- 14. Testing Audit Logs & Activity Trail ---")
try:
    st, res = api_call("GET", "/api/audit-logs?limit=10", token=admin_token)
    assert st == 200 and len(res["data"]) > 0, "Audit logs empty"
    record_pass("Audit logs fetched successfully", f"Retrieved {len(res['data'])} audit trail records")
except Exception as e:
    record_fail("Audit Logs Suite", e)

# 15. Store Settings
print("\n--- 15. Testing Store Settings ---")
try:
    st, res = api_call("GET", "/api/settings", token=admin_token)
    assert st == 200 and "store_name" in res["data"], "Settings fetch failed"
    record_pass("Fetch store settings", f"Store: {res['data']['store_name']}")

    # Update settings
    st, res = api_call("POST", "/api/settings", {"invoice_footer": "Thank you for shopping with us!"}, token=admin_token)
    assert st == 200, "Settings update failed"
    record_pass("Store settings updated successfully")
except Exception as e:
    record_fail("Store Settings Suite", e)

print("\n==================================================")
print("TEST SUMMARY:")
print(f"Total Passed: {len(test_results['passed'])}")
print(f"Total Failed: {len(test_results['failed'])}")
if test_results["failed"]:
    print("\nFailures:")
    for name, err in test_results["failed"]:
        print(f"  - {name}: {err}")
    sys.exit(1)
else:
    print("\nALL END-TO-END TESTS PASSED CLEANLY!")
    sys.exit(0)
