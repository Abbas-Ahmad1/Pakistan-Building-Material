import React, { useState } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  CreditCard,
  Banknote,
  Printer,
  History,
  ArrowRight,
  Package,
  User,
  Calendar,
  DollarSign,
  ShieldCheck,
  Building,
  Layers,
  AlertCircle,
  Truck
} from 'lucide-react';
import { Sale, SaleItem, SalesReturn } from '../../types';
import { apiRequest } from '../../services/api';
import { BarcodeSvg } from '../common/BarcodeSvg';
import { QrCodeSvg } from '../common/QrCodeSvg';
import { ReceiptModal } from './ReceiptModal';

interface InvoiceLookupModalProps {
  initialSale?: Sale | null;
  initialTab?: 'details' | 'payment' | 'delivery' | 'returns' | 'history';
  onClose: () => void;
  onInvoiceUpdated?: (updatedSale: Sale) => void;
}

export const InvoiceLookupModal: React.FC<InvoiceLookupModalProps> = ({
  initialSale,
  initialTab,
  onClose,
  onInvoiceUpdated,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentSale, setCurrentSale] = useState<Sale | null>(initialSale || null);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'details' | 'payment' | 'delivery' | 'returns' | 'history'>(
    initialTab || (initialSale?.delivery_status === 'PARTIAL' || initialSale?.delivery_status === 'PENDING' ? 'delivery' : 'details')
  );

  // Quick Pay State
  const [payAmount, setPayAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Credit' | 'Bank Transfer' | 'Card'>('Cash');
  const [payNotes, setPayNotes] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Delivery / Pickup State: Map of sale_item_id -> new delivered_quantity
  const [deliveryMap, setDeliveryMap] = useState<Record<number, number>>({});
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isProcessingDelivery, setIsProcessingDelivery] = useState(false);

  // Delivery metrics
  const totalPurchasedQty = (currentSale?.items || []).reduce((acc, it) => acc + Number(it.quantity || 0), 0);
  const totalDeliveredQty = (currentSale?.items || []).reduce(
    (acc, it) => acc + (it.delivered_quantity !== undefined ? Number(it.delivered_quantity) : Number(it.quantity || 0)),
    0
  );
  const totalRemainingDelivery = Math.max(0, totalPurchasedQty - totalDeliveredQty);

  // Sync deliveryMap whenever currentSale changes
  React.useEffect(() => {
    if (currentSale?.items) {
      const map: Record<number, number> = {};
      for (const it of currentSale.items) {
        if (it.id) {
          map[it.id] = it.delivered_quantity !== undefined ? it.delivered_quantity : it.quantity;
        }
      }
      setDeliveryMap(map);
    }
  }, [currentSale]);

  // Return Items State: Map of sale_item_id -> { returnQty: number, reason: string }
  const [returnMap, setReturnMap] = useState<Record<number, { returnQty: number; reason: string }>>({});
  const [returnNotes, setReturnNotes] = useState('');
  const [refundAction, setRefundAction] = useState<'AUTO' | 'CASH_REFUND' | 'LEDGER_ADJUSTMENT'>('AUTO');
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);
  const [latestReturnSlip, setLatestReturnSlip] = useState<{
    returnNumber: string;
    totalRefund: number;
    cashRefund: number;
    ledgerCredit: number;
    refundType: string;
  } | null>(null);

  // Printable receipt toggle
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Perform search / lookup by barcode or invoice ID
  const handleLookup = async (queryToSearch?: string) => {
    const query = (queryToSearch || searchInput).trim();
    if (!query) return;

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setLatestReturnSlip(null);

    try {
      const res = await apiRequest<Sale>(`/api/sales/lookup/${encodeURIComponent(query)}`);
      if (res.success && res.data) {
        setCurrentSale(res.data);
        // Reset pay amount to pending due
        setPayAmount(res.data.due_amount > 0 ? String(res.data.due_amount) : '');
        // Reset return selections
        setReturnMap({});
        // Default to payment tab if invoice is unpaid, or returns tab if user wanted returns
        if (res.data.due_amount > 0) {
          setActiveTab('payment');
        } else {
          setActiveTab('details');
        }
      } else {
        setErrorMessage(res.message || `No invoice found matching "${query}".`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error communicating with server.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Pay Handler
  const handleSettlePayment = async () => {
    if (!currentSale) return;
    setIsProcessingPayment(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const amountToSettle = Number(payAmount) || currentSale.due_amount;

    try {
      const res = await apiRequest<Sale>(`/api/sales/${currentSale.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amountToSettle,
          payment_method: paymentMethod,
          notes: payNotes || `Payment of Rs. ${amountToSettle.toLocaleString()} collected at POS`,
        }),
      });

      if (res.success && res.data) {
        setSuccessMessage(res.message || 'Payment recorded successfully!');
        // Refresh lookup to get full items & state
        await handleLookup(res.data.invoice_number);
        if (onInvoiceUpdated) onInvoiceUpdated(res.data);
      } else {
        setErrorMessage(res.message || 'Failed to record payment.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing payment.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Delivery Update Handler
  const handleUpdateDelivery = async () => {
    if (!currentSale || !currentSale.items) return;
    setIsProcessingDelivery(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const deliveries = currentSale.items.map((item) => {
        const dQty = deliveryMap[item.id!] !== undefined 
          ? deliveryMap[item.id!] 
          : (item.delivered_quantity !== undefined ? item.delivered_quantity : item.quantity);
        return {
          sale_item_id: item.id!,
          delivered_quantity: Math.max(0, Math.min(item.quantity, Number(dQty) || 0)),
        };
      });

      const res = await apiRequest<Sale>(`/api/sales/${currentSale.id}/delivery`, {
        method: 'POST',
        body: JSON.stringify({
          deliveries,
          notes: deliveryNotes || 'Stock balance delivered / handed over to customer',
        }),
      });

      if (res.success && res.data) {
        setSuccessMessage(res.message || 'Delivery quantities updated successfully! Remaining count refreshed.');
        setCurrentSale(res.data);
        if (onInvoiceUpdated) onInvoiceUpdated(res.data);
      } else {
        setErrorMessage(res.message || 'Failed to update deliveries.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing delivery update.');
    } finally {
      setIsProcessingDelivery(false);
    }
  };

  // Update item return qty
  const handleItemReturnChange = (itemId: number, maxReturnable: number, val: number) => {
    const validQty = Math.max(0, Math.min(maxReturnable, Math.round(val)));
    setReturnMap((prev) => ({
      ...prev,
      [itemId]: {
        returnQty: validQty,
        reason: prev[itemId]?.reason || 'Customer return',
      },
    }));
  };

  // Calculate total return summary
  const returnSummary = React.useMemo(() => {
    if (!currentSale || !currentSale.items) return { totalQty: 0, totalRefund: 0, itemsToReturn: [] };

    let totalQty = 0;
    let totalRefund = 0;
    const itemsToReturn: {
      sale_item_id: number;
      product_id: number;
      product_name: string;
      return_quantity: number;
      unit_price: number;
      refund_line_total: number;
      reason: string;
    }[] = [];

    for (const item of currentSale.items) {
      const entry = returnMap[item.id!];
      if (entry && entry.returnQty > 0) {
        totalQty += entry.returnQty;
        // Calculate proportional unit price
        const effectivePrice = item.quantity > 0 ? item.line_total / item.quantity : item.unit_price;
        const lineRefund = Math.round(entry.returnQty * effectivePrice * 100) / 100;
        totalRefund += lineRefund;

        itemsToReturn.push({
          sale_item_id: item.id!,
          product_id: item.product_id,
          product_name: item.product_name || 'Product',
          return_quantity: entry.returnQty,
          unit_price: item.unit_price,
          refund_line_total: lineRefund,
          reason: entry.reason || returnNotes,
        });
      }
    }

    return { totalQty, totalRefund, itemsToReturn };
  }, [currentSale, returnMap, returnNotes]);

  // Process Item Returns & Inventory Restock
  const handleProcessReturn = async () => {
    if (!currentSale || returnSummary.itemsToReturn.length === 0) {
      setErrorMessage('Please specify at least one item and quantity to return.');
      return;
    }

    setIsProcessingReturn(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await apiRequest<{
        return_number: string;
        total_refund_amount: number;
        cash_refund_amount: number;
        ledger_credit_amount: number;
        refund_type: string;
        invoice: Sale;
      }>(`/api/sales/${currentSale.id}/returns`, {
        method: 'POST',
        body: JSON.stringify({
          items: returnSummary.itemsToReturn,
          refund_action: refundAction,
          notes: returnNotes || 'Item return processed at POS terminal',
        }),
      });

      if (res.success && res.data) {
        setLatestReturnSlip({
          returnNumber: res.data.return_number,
          totalRefund: res.data.total_refund_amount,
          cashRefund: res.data.cash_refund_amount,
          ledgerCredit: res.data.ledger_credit_amount,
          refundType: res.data.refund_type,
        });
        setSuccessMessage(
          `Return ${res.data.return_number} processed! Stock replenished in database. Total adjusted: Rs. ${res.data.total_refund_amount.toLocaleString()}`
        );
        // Reload full invoice details
        await handleLookup(currentSale.invoice_number);
        if (onInvoiceUpdated && res.data.invoice) {
          onInvoiceUpdated(res.data.invoice);
        }
      } else {
        setErrorMessage(res.message || 'Failed to process item return.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error communicating with database.');
    } finally {
      setIsProcessingReturn(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/70 backdrop-blur-xs p-3 md:p-6 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[95vh] border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="bg-stone-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <div className="p-1.5 bg-amber-600/20 text-amber-400 rounded-lg border border-amber-500/30">
                <BarcodeSvg value={currentSale ? currentSale.invoice_number : 'SCAN-POS'} width={60} height={20} showText={false} />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wide flex items-center space-x-2">
                  <span>Verify Invoice & Item Return Center</span>
                </h3>
                <p className="text-[11px] text-stone-400">
                  Scan receipt barcode with scanner gun, check payment status & process item restocks
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scannable Search Bar */}
          <div className="p-4 bg-stone-50 border-b border-stone-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLookup();
              }}
              className="flex items-center space-x-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Scan receipt barcode with scanner gun OR type invoice # (e.g. INV-2026-1001)..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border-2 border-amber-500/40 rounded-lg text-xs md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-600 shadow-xs"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !searchInput.trim()}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs md:text-sm font-bold flex items-center space-x-1.5 shadow-xs transition-colors shrink-0"
              >
                {isLoading ? (
                  <span>Searching...</span>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Pull Up Bill</span>
                  </>
                )}
              </button>
            </form>

            {/* Error Message */}
            {errorMessage && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            )}
          </div>

          {/* Main Body */}
          {currentSale ? (
            <div className="flex-1 overflow-y-auto flex flex-col">
              {/* Invoice Status Banner */}
              <div className="p-4 bg-white border-b border-stone-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    {/* Barcode & QR Box */}
                    <div className="bg-stone-50 p-2 rounded-lg border border-stone-200 flex flex-col items-center">
                      <BarcodeSvg value={currentSale.invoice_number} width={130} height={36} showText={false} />
                      <span className="text-[10px] font-mono font-bold text-stone-800 mt-0.5">
                        {currentSale.invoice_number}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-base font-black text-stone-900">
                          {currentSale.invoice_number}
                        </span>
                        {/* Status Badge */}
                        {currentSale.payment_status === 'PAID' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>FULLY PAID</span>
                          </span>
                        ) : currentSale.payment_status === 'PARTIAL' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center space-x-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>PARTIAL PAYMENT (Due: Rs. {currentSale.due_amount?.toLocaleString()})</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center space-x-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>UNPAID / KHATA DUE: Rs. {currentSale.due_amount?.toLocaleString()}</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-stone-600 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="flex items-center space-x-1">
                          <User className="w-3.5 h-3.5 text-stone-400" />
                          <strong className="text-stone-800">{currentSale.customer_name}</strong>
                          {currentSale.customer_phone && <span className="text-stone-500">({currentSale.customer_phone})</span>}
                        </span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-stone-400" />
                          <span>{new Date(currentSale.sale_date).toLocaleString('en-PK')}</span>
                        </span>
                      </div>

                      {/* Prominent Cashier & Branch Audit Verification Box */}
                      <div className="mt-2 py-1.5 px-2.5 bg-amber-50/80 rounded-lg border border-amber-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <div className="flex items-center space-x-1.5 text-amber-900">
                          <Building className="w-3.5 h-3.5 text-amber-700" />
                          <span>Branch:</span>
                          <span className="font-bold text-stone-900 bg-white px-1.5 py-0.5 rounded border border-amber-200">
                            {currentSale.branch_name || 'Main Store'} {currentSale.branch_code ? `(${currentSale.branch_code})` : ''}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-amber-900">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Billed By:</span>
                          <span className="font-bold text-stone-900 bg-white px-1.5 py-0.5 rounded border border-amber-200">
                            {currentSale.cashier_name || 'Terminal Cashier'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Financial Stats Cards */}
                  <div className="flex items-center space-x-2 bg-stone-50 p-2 rounded-lg border border-stone-200">
                    <div className="px-3 py-1 text-center">
                      <div className="text-[10px] uppercase font-bold text-stone-500">
                        {(currentSale.returned_amount || 0) > 0 ? 'Net Total' : 'Total Bill'}
                      </div>
                      <div className="text-sm font-black text-stone-900">
                        Rs. {(currentSale.net_total || currentSale.grand_total)?.toLocaleString()}
                      </div>
                      {(currentSale.returned_amount || 0) > 0 && (
                        <div className="text-[9px] text-rose-600 font-semibold">
                          Ret: -Rs. {currentSale.returned_amount?.toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="w-px h-8 bg-stone-300" />
                    <div className="px-3 py-1 text-center">
                      <div className="text-[10px] uppercase font-bold text-stone-500">Paid</div>
                      <div className="text-sm font-black text-emerald-700">
                        Rs. {currentSale.paid_amount?.toLocaleString()}
                      </div>
                    </div>
                    <div className="w-px h-8 bg-stone-300" />
                    <div className="px-3 py-1 text-center">
                      <div className="text-[10px] uppercase font-bold text-stone-500">Pending Due</div>
                      <div className={`text-sm font-black ${currentSale.due_amount > 0 ? 'text-rose-700' : 'text-stone-400'}`}>
                        Rs. {currentSale.due_amount?.toLocaleString()}
                      </div>
                    </div>
                    <div className="w-px h-8 bg-stone-300" />
                    <div className="px-3 py-1 text-center">
                      <div className="text-[10px] uppercase font-bold text-stone-500">Delivery Status</div>
                      <div className={`text-xs font-black ${totalRemainingDelivery > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {totalRemainingDelivery > 0 ? `Pending (${totalRemainingDelivery} units)` : 'Fully Delivered'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub Tabs */}
                <div className="flex items-center space-x-2 mt-4 pt-3 border-t border-stone-200">
                  <button
                    type="button"
                    onClick={() => setActiveTab('details')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors ${
                      activeTab === 'details'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Bill Items ({currentSale.items?.length || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('delivery')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors ${
                      activeTab === 'delivery'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>
                      Delivery / Pickup
                      {totalRemainingDelivery > 0 ? (
                        <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px]">
                          {totalRemainingDelivery} Pending
                        </span>
                      ) : (
                        <span className="ml-1 px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-[10px]">
                          Complete
                        </span>
                      )}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('payment')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors ${
                      activeTab === 'payment'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>
                      Quick Payment{' '}
                      {currentSale.due_amount > 0 && (
                        <span className="ml-1 px-1.5 py-0.2 bg-rose-600 text-white rounded-full text-[10px]">
                          Pending
                        </span>
                      )}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('returns')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors ${
                      activeTab === 'returns'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Return / Edit Items</span>
                  </button>

                  {currentSale.returns && currentSale.returns.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('history')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors ${
                        activeTab === 'history'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Return Slips ({currentSale.returns.length})</span>
                    </button>
                  )}

                  <div className="flex-1" />

                  <button
                    type="button"
                    onClick={() => setShowReceiptModal(true)}
                    className="px-3 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Receipt</span>
                  </button>
                </div>
              </div>

              {/* Tab 1: Line Items Details */}
              {activeTab === 'details' && (
                <div className="p-4 flex-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                    Purchased Items & Delivery Breakdown
                  </h4>
                  <div className="border border-stone-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                        <tr>
                          <th className="py-2.5 px-3">Item / SKU</th>
                          <th className="py-2.5 px-2 text-center">Unit Price</th>
                          <th className="py-2.5 px-2 text-center">Purchased (Paid)</th>
                          <th className="py-2.5 px-2 text-center">Delivered</th>
                          <th className="py-2.5 px-2 text-center">Remaining</th>
                          <th className="py-2.5 px-2 text-center">Returned</th>
                          <th className="py-2.5 px-3 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200">
                        {currentSale.items?.map((item, idx) => {
                          const returned = item.returned_quantity || 0;
                          const delivered = item.delivered_quantity !== undefined ? item.delivered_quantity : item.quantity;
                          const remaining = Math.max(0, item.quantity - delivered);

                          return (
                            <tr key={idx} className="hover:bg-stone-50">
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-stone-900">{item.product_name}</div>
                                <div className="text-[10px] text-stone-500">SKU: {item.sku || 'N/A'}</div>
                              </td>
                              <td className="py-2.5 px-2 text-center text-stone-800">
                                Rs. {item.unit_price?.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-2 text-center font-bold text-stone-900">
                                {item.quantity} {item.unit || 'pcs'}
                              </td>
                              <td className="py-2.5 px-2 text-center font-bold text-emerald-700">
                                {delivered} {item.unit || 'pcs'}
                              </td>
                              <td className="py-2.5 px-2 text-center font-bold">
                                {remaining > 0 ? (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-black rounded text-[11px]">
                                    {remaining} pending
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 text-[11px] font-semibold">✓ Completed</span>
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                {returned > 0 ? (
                                  <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded-full text-[10px]">
                                    -{returned} returned
                                  </span>
                                ) : (
                                  <span className="text-stone-400">0</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-stone-900">
                                Rs. {item.line_total?.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex justify-between items-center">
                    <div className="text-xs text-stone-500">
                      Payment is finalized for full purchase. Manage customer stock pickups anytime in the Delivery tab.
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('delivery')}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
                      >
                        <Truck className="w-4 h-4" />
                        <span>Manage Stock Pickups / Handover</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('returns')}
                        className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Return Items</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Quick Payment / Settlement */}
              {activeTab === 'payment' && (
                <div className="p-5 flex-1 max-w-2xl mx-auto w-full">
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 shadow-xs">
                    <div className="flex items-center space-x-2 text-stone-800 font-black text-sm mb-3">
                      <CreditCard className="w-5 h-5 text-amber-600" />
                      <span>Collect Payment for Invoice {currentSale.invoice_number}</span>
                    </div>

                    {currentSale.due_amount <= 0 ? (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center space-x-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-bold">This invoice is already FULLY PAID!</p>
                          <p className="text-stone-600 mt-0.5">
                            Total bill of Rs. {currentSale.grand_total?.toLocaleString()} has been settled in full.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Pending Total Callout */}
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between">
                          <div>
                            <span className="text-xs uppercase font-bold text-rose-700 block">Pending Amount Due</span>
                            <span className="text-2xl font-black text-rose-900">
                              Rs. {currentSale.due_amount?.toLocaleString()}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPayAmount(String(currentSale.due_amount))}
                            className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                          >
                            Pay Full Due (Rs. {currentSale.due_amount?.toLocaleString()})
                          </button>
                        </div>

                        {/* Payment Amount Input */}
                        <div>
                          <label className="block text-xs font-bold text-stone-700 mb-1">
                            Amount to Collect (Rs.)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs">
                              Rs.
                            </span>
                            <input
                              type="number"
                              min="1"
                              max={currentSale.due_amount}
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                        </div>

                        {/* Payment Method Selector */}
                        <div>
                          <label className="block text-xs font-bold text-stone-700 mb-1">
                            Payment Method
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {(['Cash', 'Bank Transfer', 'Card'] as const).map((method) => (
                              <button
                                key={method}
                                type="button"
                                onClick={() => setPaymentMethod(method)}
                                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                                  paymentMethod === method
                                    ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                                }`}
                              >
                                {method}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Optional Notes */}
                        <div>
                          <label className="block text-xs font-bold text-stone-700 mb-1">
                            Payment Reference / Receipt Notes (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Paid in cash by contractor Majid"
                            value={payNotes}
                            onChange={(e) => setPayNotes(e.target.value)}
                            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        {/* Customer Khata impact note */}
                        <div className="p-3 bg-stone-100 rounded-lg text-[11px] text-stone-600 space-y-0.5">
                          <p className="font-bold text-stone-800">Database & Khata Ledger Synchronization:</p>
                          <p>
                            Collecting payment will immediately record a customer receipt in the SQLite ledger and reduce{' '}
                            <strong>{currentSale.customer_name}</strong>'s pending balance.
                          </p>
                        </div>

                        {/* Submit Button */}
                        <button
                          type="button"
                          disabled={isProcessingPayment || !payAmount || Number(payAmount) <= 0}
                          onClick={handleSettlePayment}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-sm shadow-md transition-colors flex items-center justify-center space-x-2"
                        >
                          {isProcessingPayment ? (
                            <span>Recording Payment...</span>
                          ) : (
                            <>
                              <CheckCircle2 className="w-5 h-5" />
                              <span>
                                Collect Rs. {Number(payAmount || 0).toLocaleString()} & Mark as Paid
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Item Delivery & Pickup Management */}
              {activeTab === 'delivery' && (
                <div className="p-4 flex-1 flex flex-col space-y-4">
                  {/* Delivery Info Banner */}
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-950 flex items-start space-x-3">
                    <Truck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-sm text-amber-950">Partial Item Delivery & Stock Balance Tracking</p>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        Total payment for invoice <strong>#{currentSale.invoice_number}</strong> was calculated on the full purchased quantity.
                        When the customer arrives to pick up items, enter the newly delivered quantities below. The remaining balance will automatically refresh and print on the customer's delivery slip.
                      </p>
                    </div>
                  </div>

                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-center">
                      <span className="text-[10px] uppercase font-bold text-stone-500 block">Total Purchased (Paid)</span>
                      <span className="text-xl font-black text-stone-900">{totalPurchasedQty} units</span>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Picked Up</span>
                      <span className="text-xl font-black text-emerald-800">{totalDeliveredQty} units</span>
                    </div>
                    <div className={`p-3 rounded-lg text-center border ${
                      totalRemainingDelivery > 0 ? 'bg-amber-50 border-amber-300 text-amber-950' : 'bg-stone-50 border-stone-200 text-stone-600'
                    }`}>
                      <span className="text-[10px] uppercase font-bold text-amber-800 block">Remaining Stock Balance</span>
                      <span className="text-xl font-black text-amber-900">{totalRemainingDelivery} units</span>
                    </div>
                  </div>

                  {/* Item Delivery Table */}
                  <div className="border border-stone-200 rounded-lg overflow-hidden bg-white shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200 uppercase text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3">Item Description</th>
                          <th className="py-2.5 px-3 text-center">Total Purchased (Paid)</th>
                          <th className="py-2.5 px-3 text-center w-56">Delivered / Picked Up</th>
                          <th className="py-2.5 px-3 text-center">Remaining Balance</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200">
                        {currentSale.items?.map((item) => {
                          const purchased = Number(item.quantity);
                          const currentDeliveredVal = deliveryMap[item.id!] !== undefined 
                            ? Number(deliveryMap[item.id!]) 
                            : (item.delivered_quantity !== undefined ? Number(item.delivered_quantity) : purchased);
                          const currentRemaining = Math.max(0, purchased - currentDeliveredVal);

                          return (
                            <tr key={item.id} className="hover:bg-stone-50/80">
                              <td className="py-3 px-3">
                                <div className="font-bold text-stone-900 text-sm">{item.product_name}</div>
                                <div className="text-[10px] text-stone-500 flex items-center space-x-2 mt-0.5">
                                  <span>SKU: {item.sku || 'N/A'}</span>
                                  <span>•</span>
                                  <span>Unit: {item.unit || 'Piece'}</span>
                                  <span>•</span>
                                  <span>Unit Price: Rs. {item.unit_price?.toLocaleString()}</span>
                                </div>
                              </td>

                              <td className="py-3 px-3 text-center font-bold text-stone-900 text-sm">
                                {purchased} {item.unit || 'pcs'}
                              </td>

                              <td className="py-3 px-3">
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={purchased}
                                    value={currentDeliveredVal}
                                    onChange={(e) => {
                                      const num = Math.max(0, Math.min(purchased, Number(e.target.value) || 0));
                                      setDeliveryMap((prev) => ({
                                        ...prev,
                                        [item.id!]: num,
                                      }));
                                    }}
                                    className="w-24 px-2 py-1.5 border border-stone-300 rounded font-bold text-center text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                                  />
                                  <span className="text-xs text-stone-500 font-medium">{item.unit || 'pcs'}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeliveryMap((prev) => ({
                                        ...prev,
                                        [item.id!]: purchased,
                                      }));
                                    }}
                                    className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-[10px] font-bold text-stone-700 rounded border border-stone-200 whitespace-nowrap"
                                  >
                                    All ({purchased})
                                  </button>
                                </div>
                              </td>

                              <td className="py-3 px-3 text-center">
                                <span className={`inline-block px-2.5 py-1 rounded text-xs font-black ${
                                  currentRemaining > 0 
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {currentRemaining} {item.unit || 'pcs'}
                                </span>
                              </td>

                              <td className="py-3 px-3 text-center">
                                {currentRemaining === 0 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Fully Delivered
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                                    <Truck className="w-3 h-3 mr-1" />
                                    Partial ({currentRemaining} Left)
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Dispatch Notes Input & Action Button */}
                  <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Delivery Notes / Gate Pass Reference (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Loaded 100 bags on Shahzad Suzuki Pickup # LEJ-882, handed to customer driver"
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => setShowReceiptModal(true)}
                        className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Bill with Delivery Status</span>
                      </button>

                      <button
                        type="button"
                        disabled={isProcessingDelivery}
                        onClick={handleUpdateDelivery}
                        className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-md flex items-center space-x-2 transition-colors"
                      >
                        {isProcessingDelivery ? (
                          <span>Updating Delivery...</span>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Save Delivery & Refresh Remaining Balance</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Delivery History Logs (if any past pickups recorded) */}
                  {currentSale.delivery_logs && currentSale.delivery_logs.length > 0 && (
                    <div className="border border-stone-200 rounded-lg p-3 bg-white space-y-2">
                      <h5 className="text-xs font-bold uppercase text-stone-700 flex items-center space-x-1.5">
                        <History className="w-3.5 h-3.5 text-amber-600" />
                        <span>Previous Pickup & Delivery Log History</span>
                      </h5>
                      <div className="divide-y divide-stone-100 text-xs">
                        {currentSale.delivery_logs.map((log) => (
                          <div key={log.id} className="py-2 flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-stone-900">
                                {log.product_name}: <span className="text-emerald-700 font-bold">+{log.delivered_quantity} units delivered</span>
                              </div>
                              <div className="text-[10px] text-stone-500 mt-0.5">
                                {log.notes && <span className="italic mr-2">"{log.notes}"</span>}
                                <span>Remaining balance after pickup: <strong>{log.remaining_after} units</strong></span>
                              </div>
                            </div>
                            <div className="text-right text-[10px] text-stone-500">
                              <div>{new Date(log.created_at).toLocaleString('en-PK')}</div>
                              {log.delivered_by_name && <div>By: {log.delivered_by_name}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Sales Return & Refund Management */}
              {activeTab === 'returns' && (
                <div className="p-4 flex-1 flex flex-col space-y-4">
                  {/* Explanation Banner */}
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start space-x-2">
                    <RotateCcw className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Item Return & Automatic Inventory Restock</p>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        Select the quantity to return for each line item. Returned stock will be automatically added back
                        to the SQLite products table and inventory audit trail. Financial totals will be recalculated
                        immediately.
                      </p>
                    </div>
                  </div>

                  {/* Return Table */}
                  <div className="border border-stone-200 rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                        <tr>
                          <th className="py-2.5 px-3">Product Name & SKU</th>
                          <th className="py-2.5 px-3 text-center">Unit Price</th>
                          <th className="py-2.5 px-3 text-center">Purchased</th>
                          <th className="py-2.5 px-3 text-center">Already Returned</th>
                          <th className="py-2.5 px-3 text-center">Max Returnable</th>
                          <th className="py-2.5 px-3 text-center w-36">Return Qty</th>
                          <th className="py-2.5 px-3 text-right">Refund Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200">
                        {currentSale.items?.map((item) => {
                          const alreadyReturned = item.returned_quantity || 0;
                          const maxReturnable = Math.max(0, item.quantity - alreadyReturned);
                          const currentReturnQty = returnMap[item.id!]?.returnQty || 0;
                          const effectivePrice = item.quantity > 0 ? item.line_total / item.quantity : item.unit_price;
                          const refundLine = Math.round(currentReturnQty * effectivePrice * 100) / 100;

                          return (
                            <tr
                              key={item.id}
                              className={currentReturnQty > 0 ? 'bg-amber-50/60' : 'hover:bg-stone-50'}
                            >
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-stone-900">{item.product_name}</div>
                                <div className="text-[10px] text-stone-500">SKU: {item.sku || 'N/A'}</div>
                              </td>
                              <td className="py-2.5 px-3 text-center text-stone-800">
                                Rs. {item.unit_price?.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-stone-800">
                                {item.quantity} {item.unit || 'pcs'}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {alreadyReturned > 0 ? (
                                  <span className="text-rose-700 font-bold">{alreadyReturned}</span>
                                ) : (
                                  <span className="text-stone-400">0</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                                {maxReturnable} {item.unit || 'pcs'}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {maxReturnable <= 0 ? (
                                  <span className="text-[11px] text-stone-400 italic">Fully Returned</span>
                                ) : (
                                  <div className="flex items-center justify-center space-x-1">
                                    <button
                                      type="button"
                                      disabled={currentReturnQty <= 0}
                                      onClick={() =>
                                        handleItemReturnChange(item.id!, maxReturnable, currentReturnQty - 1)
                                      }
                                      className="w-6 h-6 rounded bg-stone-200 hover:bg-stone-300 disabled:opacity-30 text-xs font-bold flex items-center justify-center"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      max={maxReturnable}
                                      value={currentReturnQty}
                                      onChange={(e) =>
                                        handleItemReturnChange(
                                          item.id!,
                                          maxReturnable,
                                          Number(e.target.value) || 0
                                        )
                                      }
                                      className="w-14 text-center py-1 border border-stone-300 rounded font-bold text-xs focus:ring-1 focus:ring-amber-500"
                                    />
                                    <button
                                      type="button"
                                      disabled={currentReturnQty >= maxReturnable}
                                      onClick={() =>
                                        handleItemReturnChange(item.id!, maxReturnable, currentReturnQty + 1)
                                      }
                                      className="w-6 h-6 rounded bg-stone-200 hover:bg-stone-300 disabled:opacity-30 text-xs font-bold flex items-center justify-center"
                                    >
                                      +
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleItemReturnChange(item.id!, maxReturnable, maxReturnable)
                                      }
                                      title="Return All Available"
                                      className="px-1.5 py-1 text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-700 rounded border border-stone-300 font-semibold"
                                    >
                                      All
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-stone-900">
                                {refundLine > 0 ? (
                                  <span className="text-rose-700">Rs. {refundLine.toLocaleString()}</span>
                                ) : (
                                  <span className="text-stone-400">Rs. 0</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Return Summary & Financial Action Box */}
                  <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-stone-200 pb-3">
                      <div>
                        <span className="text-xs uppercase font-bold text-stone-500">Items to Return</span>
                        <div className="text-sm font-bold text-stone-900">
                          {returnSummary.totalQty} units across {returnSummary.itemsToReturn.length} products
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs uppercase font-bold text-stone-500">Total Refund Value</span>
                        <div className="text-xl font-black text-rose-700">
                          Rs. {returnSummary.totalRefund.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Financial Mechanism Explanation */}
                    <div className="p-3 bg-white border border-stone-200 rounded-lg text-xs space-y-1.5">
                      <span className="font-bold text-stone-800 block">Financial Adjustment Rule:</span>
                      {currentSale.due_amount > 0 ? (
                        <div className="text-stone-700 leading-relaxed">
                          ⚠️ This bill has a pending due balance of{' '}
                          <strong className="text-rose-700">Rs. {currentSale.due_amount?.toLocaleString()}</strong>.{' '}
                          Returning these items will automatically deduct up to{' '}
                          <strong>
                            Rs.{' '}
                            {Math.min(currentSale.due_amount, returnSummary.totalRefund).toLocaleString()}
                          </strong>{' '}
                          from the customer's pending Khata balance.
                          {returnSummary.totalRefund > currentSale.due_amount && (
                            <span className="block mt-1 text-emerald-700 font-bold">
                              The excess refund of Rs.{' '}
                              {(returnSummary.totalRefund - currentSale.due_amount).toLocaleString()} will be refunded in
                              Cash to the customer.
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-stone-700 leading-relaxed">
                          ✓ This bill was previously <strong className="text-emerald-700">FULLY PAID</strong>. The
                          cashier should return{' '}
                          <strong className="text-rose-700 font-black">
                            Rs. {returnSummary.totalRefund.toLocaleString()}
                          </strong>{' '}
                          in CASH to the customer (or credit to Khata ledger if registered contractor).
                        </div>
                      )}
                    </div>

                    {/* Refund Action Selector */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 mb-1">
                          Adjustment Preference
                        </label>
                        <select
                          value={refundAction}
                          onChange={(e: any) => setRefundAction(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="AUTO">Auto-Determine (Offset Udhaar / Cash Refund)</option>
                          <option value="CASH_REFUND">Return Cash to Customer</option>
                          <option value="LEDGER_ADJUSTMENT">Credit Customer Khata Account</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 mb-1">
                          Return Reason / Inspection Notes
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Leftover paint cans from painting contractor"
                          value={returnNotes}
                          onChange={(e) => setReturnNotes(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    {/* Submit Return Button */}
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        disabled={isProcessingReturn || returnSummary.totalQty <= 0}
                        onClick={handleProcessReturn}
                        className="px-6 py-2.5 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white rounded-lg font-bold text-xs md:text-sm shadow-md transition-colors flex items-center space-x-2"
                      >
                        {isProcessingReturn ? (
                          <span>Processing Return & Restock...</span>
                        ) : (
                          <>
                            <RotateCcw className="w-4 h-4" />
                            <span>
                              Confirm Return & Restock ({returnSummary.totalQty} Units - Rs.{' '}
                              {returnSummary.totalRefund.toLocaleString()})
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Return History Slips */}
              {activeTab === 'history' && (
                <div className="p-4 flex-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-3">
                    Past Return Records for Invoice {currentSale.invoice_number}
                  </h4>

                  <div className="space-y-3">
                    {currentSale.returns?.map((ret) => (
                      <div
                        key={ret.id}
                        className="p-4 bg-stone-50 border border-stone-200 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-black text-sm text-stone-900">
                              {ret.return_number}
                            </span>
                            <span className="px-2 py-0.5 bg-stone-200 text-stone-700 text-[10px] font-bold rounded">
                              {ret.refund_type}
                            </span>
                          </div>
                          <div className="text-xs text-stone-500 mt-0.5">
                            Processed on {new Date(ret.created_at).toLocaleString('en-PK')} by{' '}
                            {ret.processed_by_name || 'Cashier'}
                          </div>
                          {ret.reason && (
                            <div className="text-xs text-stone-700 mt-1 italic">"{ret.reason}"</div>
                          )}
                        </div>

                        <div className="text-right">
                          <div className="text-xs uppercase font-bold text-stone-500">Refund Amount</div>
                          <div className="text-base font-black text-rose-700">
                            Rs. {ret.total_refund_amount?.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-stone-500">
                            Cash: Rs. {ret.cash_refund_amount?.toLocaleString()} | Ledger:{' '}
                            Rs. {ret.ledger_credit_amount?.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Empty State */
            <div className="p-12 text-center text-stone-500 space-y-3">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto text-stone-400">
                <BarcodeSvg value="SCAN-HERE" width={80} height={24} showText={false} />
              </div>
              <h4 className="font-bold text-stone-800 text-sm">No Invoice Selected</h4>
              <p className="text-xs max-w-md mx-auto text-stone-500">
                Scan any paper or digital receipt using your barcode scanner gun, or enter the invoice number above to
                verify payment status, collect pending balance, or process returns with automatic inventory restocking.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Printable Receipt Modal */}
      {showReceiptModal && currentSale && (
        <ReceiptModal sale={currentSale} onClose={() => setShowReceiptModal(false)} />
      )}
    </>
  );
};
