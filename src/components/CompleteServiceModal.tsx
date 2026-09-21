import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  Plus,
  Trash2,
  Receipt,
  Printer,
  Share2,
  MessageCircle,
  Clock,
  User,
  Users,
  Calendar,
  AlertCircle,
  CreditCard,
  Percent,
  IndianRupee,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Booking, CompanyInfo, StaffMember, AddOnServiceItem } from '../types';
import {
  buildCompletionInvoiceWhatsAppMessage,
  createWhatsAppWebUrl,
  formatBookingAmount,
} from '../services/storageService';
import { BillOfSupplyDocument } from './BillOfSupplyDocument';

interface CompleteServiceModalProps {
  isOpen: boolean;
  booking: Booking | null;
  allStaff?: StaffMember[];
  companyInfo: CompanyInfo;
  onClose: () => void;
  onSave?: (completedBooking: Booking) => void;
  onSaveCompletedService?: (completedBooking: Booking) => void;
}

const COMMON_ADDON_SUGGESTIONS = [
  'Bedroom Deep Cleaning',
  'Kitchen Degreasing & Chimney Scrub',
  'Balcony Tile Acid Wash',
  'Ceiling Fans & Light Fixtures (x4)',
  'Sofa & Upholstery Shampooing',
  'Window Glass & Mesh Scrubbing',
  'Hard Water Stain Removal',
  'Water Tank Disinfection',
  'Floor Machine Buffing & Polishing',
  'Extra Dusting & Cobweb Removal',
];

export const CompleteServiceModal: React.FC<CompleteServiceModalProps> = ({
  isOpen,
  booking,
  allStaff = [],
  companyInfo,
  onClose,
  onSave,
  onSaveCompletedService,
}) => {
  if (!isOpen || !booking) return null;

  // Primary service baseline amount
  const initialBaseAmount = useMemo(() => {
    if (typeof booking.originalBookingAmount === 'number') {
      return booking.originalBookingAmount;
    }
    if (booking.originalBookingAmount) {
      const parsed = parseFloat(String(booking.originalBookingAmount).replace(/[^\d.]/g, ''));
      if (!isNaN(parsed)) return parsed;
    }
    if (typeof booking.amount === 'number') {
      return booking.amount;
    }
    const parsed = parseFloat(String(booking.amount).replace(/[^\d.]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }, [booking]);

  const [baseAmount, setBaseAmount] = useState<number>(initialBaseAmount);
  const [addOnServices, setAddOnServices] = useState<AddOnServiceItem[]>(
    booking.addOnServices && booking.addOnServices.length > 0
      ? booking.addOnServices
      : []
  );

  // Discount states
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>(
    booking.discountType || 'flat'
  );
  const [discountValue, setDiscountValue] = useState<number>(
    booking.discountValue || booking.discountAmount || 0
  );

  // Payment mode
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Credit'>(
    booking.paymentMode || 'Cash'
  );
  const [receivedAmount, setReceivedAmount] = useState<number>(
    booking.finalCollectedAmount !== undefined
      ? Number(booking.finalCollectedAmount)
      : (booking.paymentMode === 'Credit' ? 0 : initialBaseAmount)
  );
  const [completionNotes, setCompletionNotes] = useState<string>(
    booking.completionNotes || booking.notes || ''
  );

  // New Addon Inline Entry State
  const [newAddonName, setNewAddonName] = useState<string>('');
  const [newAddonQty, setNewAddonQty] = useState<number>(1);
  const [newAddonAmount, setNewAddonAmount] = useState<string>('');
  const [isAddingAddon, setIsAddingAddon] = useState<boolean>(false);

  // View tabs inside modal
  const [activeTab, setActiveTab] = useState<'calculation' | 'preview' | 'whatsapp'>('calculation');
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  // Reset state on booking change
  useEffect(() => {
    setBaseAmount(initialBaseAmount);
    setAddOnServices(booking.addOnServices || []);
    setDiscountType(booking.discountType || 'flat');
    setDiscountValue(booking.discountValue || booking.discountAmount || 0);
    const initialMode = booking.paymentMode || 'Cash';
    setPaymentMode(initialMode);
    setReceivedAmount(
      booking.finalCollectedAmount !== undefined
        ? Number(booking.finalCollectedAmount)
        : (initialMode === 'Credit' ? 0 : initialBaseAmount)
    );
    setCompletionNotes(booking.completionNotes || booking.notes || '');
    setIsAddingAddon(false);
  }, [booking, initialBaseAmount]);

  // Real-time calculations
  const addOnsTotal = useMemo(() => {
    return addOnServices.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [addOnServices]);

  const subtotal = useMemo(() => {
    return Math.max(0, (Number(baseAmount) || 0) + addOnsTotal);
  }, [baseAmount, addOnsTotal]);

  const discountAmount = useMemo(() => {
    const val = Number(discountValue) || 0;
    if (val <= 0) return 0;
    if (discountType === 'percentage') {
      const computed = (subtotal * val) / 100;
      return Math.min(subtotal, Math.round(computed));
    }
    return Math.min(subtotal, val);
  }, [subtotal, discountType, discountValue]);

  const finalTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  // If user switches payment mode to Credit, automatically default received to 0 if not custom
  const handlePaymentModeChange = (mode: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Credit') => {
    setPaymentMode(mode);
    if (mode === 'Credit') {
      setReceivedAmount(0);
    } else if (receivedAmount === 0) {
      setReceivedAmount(finalTotal);
    }
  };

  const balanceAmount = useMemo(() => {
    return Math.max(0, finalTotal - (Number(receivedAmount) || 0));
  }, [finalTotal, receivedAmount]);

  const advancePaid = Number(booking.advanceAmount) || 0;
  const balanceCollectedNow = Math.max(0, finalTotal - advancePaid);

  // Handlers for Add-Ons
  const handleAddAddonItem = () => {
    const name = newAddonName.trim();
    const amt = parseFloat(newAddonAmount);
    if (!name) {
      alert('Please specify the extra service or work name.');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      alert('Please specify a valid extra service amount.');
      return;
    }

    const newItem: AddOnServiceItem = {
      id: `addon-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      quantity: Math.max(1, newAddonQty || 1),
      amount: amt,
    };

    setAddOnServices((prev) => [...prev, newItem]);
    setNewAddonName('');
    setNewAddonQty(1);
    setNewAddonAmount('');
    setIsAddingAddon(false);
  };

  const handleRemoveAddonItem = (id: string) => {
    setAddOnServices((prev) => prev.filter((item) => item.id !== id));
  };

  // Build current completed booking model
  const constructedCompletedBooking: Booking = useMemo(() => {
    return {
      ...booking,
      amount: finalTotal,
      originalBookingAmount: initialBaseAmount,
      finalCollectedAmount: receivedAmount,
      advanceAmount: receivedAmount,
      balanceAmount: balanceAmount,
      paymentStatus: balanceAmount > 0 ? 'Pending' : 'Paid',
      bookingStatus: 'Completed',
      addOnServices,
      discountAmount,
      discountType,
      discountValue,
      paymentMode,
      completionNotes,
      completedAt: booking.completedAt || new Date().toISOString(),
      invoiceGenerated: true,
      updatedAt: new Date().toISOString(),
    };
  }, [
    booking,
    finalTotal,
    initialBaseAmount,
    receivedAmount,
    balanceAmount,
    addOnServices,
    discountAmount,
    discountType,
    discountValue,
    paymentMode,
    completionNotes,
  ]);

  // Generate WhatsApp message preview
  const whatsAppMessageText = useMemo(() => {
    return buildCompletionInvoiceWhatsAppMessage(constructedCompletedBooking, companyInfo);
  }, [constructedCompletedBooking, companyInfo]);

  // Send WhatsApp bill
  const handleSendWhatsAppReceipt = () => {
    const phone = booking.customerWhatsApp || booking.customerMobile;
    if (!phone) {
      alert('Customer WhatsApp/mobile number is missing.');
      return;
    }
    const url = createWhatsAppWebUrl(phone, whatsAppMessageText);
    window.open(url, '_blank');
  };

  // Copy WhatsApp Receipt
  const handleCopyWhatsAppReceipt = () => {
    navigator.clipboard.writeText(whatsAppMessageText);
    setCopiedNotice('WhatsApp Bill Receipt copied to clipboard!');
    setTimeout(() => setCopiedNotice(null), 3000);
  };

  // Print Invoice
  const handlePrintInvoice = () => {
    window.print();
  };

  // Save Final Completion
  const handleSubmitCompletion = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!booking) return;

    const bookingId = booking?.id || '';
    const finalAmount = finalTotal;
    const selectedPaymentMode = paymentMode;

    // Strict Zero-Amount Validation:
    if (finalAmount <= 0) {
      alert('Please enter a valid final service amount greater than ₹0 before completing the service.');
      return;
    }

    console.log("Complete button clicked", {
      bookingId,
      finalAmount,
      paymentMode: selectedPaymentMode,
    });

    const updatedBooking: Booking = {
      ...booking,
      bookingStatus: 'Completed',
      paymentStatus: balanceAmount > 0 ? 'Pending' : 'Paid',
      amount: finalAmount,
      originalBookingAmount: initialBaseAmount,
      finalCollectedAmount: receivedAmount,
      advanceAmount: receivedAmount,
      balanceAmount: balanceAmount,
      paymentMode: selectedPaymentMode,
      completedAt: new Date().toISOString(),
      addOnServices: addOnServices ? [...addOnServices] : [],
      discountAmount,
      discountType,
      discountValue,
      completionNotes: completionNotes || '',
      invoiceGenerated: true,
      updatedAt: new Date().toISOString(),
    };

    const saveFn = onSaveCompletedService || onSave;
    if (typeof saveFn === 'function') {
      try {
        saveFn(updatedBooking);
      } catch (err) {
        console.error("Error executing save handler in CompleteServiceModal:", err);
      }
    } else {
      console.warn("No save handler provided to CompleteServiceModal", { updatedBooking });
    }

    onClose();

    // Show a success toast/alert
    alert('Service completed & Bill of Supply saved successfully!');
  };

  const staffNamesDisplay =
    booking.assignedStaffNames && booking.assignedStaffNames.length > 0
      ? booking.assignedStaffNames.join(', ')
      : 'Unassigned';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 print:border-none print:shadow-none print:max-h-none print:w-full">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-xs">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] uppercase font-bold tracking-wider text-emerald-400">
                Service Completion &amp; Bill of Supply
              </div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Bill of Supply (Non-GST Layout)</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-blue-300 border border-slate-700">
                  Ref: {booking.bookingRef}
                </span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation for Preview and Calculation */}
        <div className="px-5 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setActiveTab('calculation')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'calculation'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
              <span>1. Add-Ons &amp; Pricing</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-blue-600" />
              <span>2. Bill of Supply (PDF &amp; Print)</span>
            </button>
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'whatsapp'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>3. WhatsApp Message</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <span>Customer:</span>
            <strong className="text-slate-800">{booking.customerName}</strong>
          </div>
        </div>

        {copiedNotice && (
          <div className="mx-5 mt-3 bg-emerald-50 border border-emerald-300 text-emerald-800 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 print:hidden">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{copiedNotice}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* TAB 1: Calculation & Add-ons */}
          {activeTab === 'calculation' && (
            <div className="space-y-4">
              {/* Customer & Job Info Summary Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Customer</span>
                  <span className="font-bold text-slate-900 truncate block">
                    {booking.customerName}
                  </span>
                  <span className="text-[11px] font-mono text-blue-600">
                    {booking.customerMobile}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Schedule Date</span>
                  <span className="font-bold text-slate-800 block">{booking.scheduleDate}</span>
                  <span className="text-[11px] text-slate-500">
                    Slot {booking.slotNumber} ({booking.slotPeriod})
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Staff Assigned</span>
                  <span className="font-bold text-slate-800 truncate block">
                    {staffNamesDisplay}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Location</span>
                  <span className="font-semibold text-slate-800 truncate block">
                    {booking.serviceLocation === 'Other'
                      ? booking.customLocation || 'Pondicherry'
                      : booking.serviceLocation}
                  </span>
                </div>
              </div>

              {/* Zero-Amount Warning Notice */}
              {finalTotal <= 0 && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2.5 text-amber-900 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Final Amount Required:</strong> A booking cannot be completed or saved with ₹0. Please enter the final service charge (for After-Visit inspection) or add extra services below before saving.
                  </span>
                </div>
              )}

              {/* SECTION 1: Original Booked Service Line Item */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Original Booked Service</span>
                  </div>
                  {initialBaseAmount <= 0 ? (
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      After-Visit Quote (Amount Required)
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Primary Service
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 bg-slate-50/80 p-2.5 rounded-lg">
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 text-sm">
                      {booking.serviceType}
                      {booking.quantity && booking.quantity > 1 && (
                        <span className="ml-2 text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                          Qty: {booking.quantity}
                        </span>
                      )}
                    </div>
                    {booking.serviceDescription && (
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {booking.serviceDescription}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs ${baseAmount <= 0 ? 'text-amber-700 font-bold' : 'text-slate-500'}`}>
                      {initialBaseAmount <= 0 ? 'Final Service Charge (₹):*' : 'Service Charge (₹):'}
                    </span>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={baseAmount || ''}
                        onChange={(e) => setBaseAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                        className={`w-32 bg-white border rounded-lg px-2.5 py-1 text-right font-mono font-bold text-slate-900 focus:ring-2 focus:outline-none ${
                          baseAmount <= 0
                            ? 'border-amber-400 bg-amber-50/60 focus:ring-amber-500 text-amber-900'
                            : 'border-slate-300 focus:ring-blue-500'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: On-Site Add-ons & Extra Work */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-emerald-600" />
                    <span>On-Site Add-on Services &amp; Extra Work ({addOnServices.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingAddon(true)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Extra Service / Work</span>
                  </button>
                </div>

                {/* Inline New Addon Form */}
                {isAddingAddon && (
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5 animate-in fade-in">
                    <div className="font-bold text-emerald-950 text-xs flex items-center justify-between">
                      <span>Add Extra Service Carried Out On-Site</span>
                      <button
                        type="button"
                        onClick={() => setIsAddingAddon(false)}
                        className="text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-6 space-y-1">
                        <label className="text-[10px] font-bold text-slate-600">
                          Extra Service Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Bedroom Cleaning, Kitchen Degreasing..."
                          value={newAddonName}
                          onChange={(e) => setNewAddonName(e.target.value)}
                          list="addon-suggestions"
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        />
                        <datalist id="addon-suggestions">
                          {COMMON_ADDON_SUGGESTIONS.map((sug, i) => (
                            <option key={i} value={sug} />
                          ))}
                        </datalist>
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-600">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={newAddonQty}
                          onChange={(e) => setNewAddonQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-center font-bold text-slate-900"
                        />
                      </div>

                      <div className="sm:col-span-4 space-y-1">
                        <label className="text-[10px] font-bold text-slate-600">
                          Additional Amount (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g. 500"
                          value={newAddonAmount}
                          onChange={(e) => setNewAddonAmount(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingAddon(false)}
                        className="px-2.5 py-1 rounded text-xs font-medium text-slate-600 hover:bg-slate-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddAddonItem}
                        className="px-3 py-1 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs"
                      >
                        Add to Invoice
                      </button>
                    </div>
                  </div>
                )}

                {/* List of Add-ons */}
                {addOnServices.length > 0 ? (
                  <div className="space-y-1.5">
                    {addOnServices.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-200 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-bold text-slate-800">{item.name}</span>
                            {item.quantity > 1 && (
                              <span className="ml-1.5 text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                Qty: {item.quantity}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-emerald-700 text-xs">
                            +₹{Number(item.amount).toLocaleString('en-IN')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAddonItem(item.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                            title="Remove line item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-dashed border-slate-200 text-center text-slate-400 bg-slate-50/50">
                    No on-site add-ons or extra tasks added yet. Click &ldquo;+ Add Extra Service / Work&rdquo; above if extra work was performed.
                  </div>
                )}
              </div>

              {/* SECTION 3: On-Site Discount & Adjustment Option */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-amber-600" />
                    <span>On-Site Discount &amp; Price Adjustment</span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setDiscountType('flat')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                        discountType === 'flat'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      ₹ Flat Discount
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percentage')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                        discountType === 'percentage'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      % Percentage
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {discountType === 'flat'
                        ? 'Discount Amount (₹)'
                        : 'Discount Percentage (%)'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max={discountType === 'percentage' ? 100 : subtotal}
                        value={discountValue || ''}
                        onChange={(e) =>
                          setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))
                        }
                        placeholder={discountType === 'flat' ? 'e.g. 200' : 'e.g. 10'}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-mono font-bold focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-2 text-slate-400 font-bold">
                        {discountType === 'flat' ? '₹' : '%'}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-0.5">
                    <div className="text-amber-900 font-bold">
                      Discount Applied: -₹{discountAmount.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-amber-800">
                      {discountType === 'percentage' && discountValue > 0 ? (
                        <>({discountValue}% discount on Subtotal ₹{subtotal.toLocaleString('en-IN')})</>
                      ) : discountValue > 0 ? (
                        <>(Flat ₹{discountValue} discount deducted from final bill)</>
                      ) : (
                        'No discount applied'
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Calculation Summary & Payment Collection */}
              <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3.5 shadow-md">
                <div className="font-bold text-sm text-emerald-400 flex items-center justify-between border-b border-slate-800 pb-2">
                  <span>Final Calculation &amp; Payment Settlement</span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Formula: (Base + Add-ons) - Discount
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                    <div className="text-slate-400 text-[11px]">Primary Service</div>
                    <div className="text-base font-bold text-white mt-0.5 font-mono">
                      ₹{baseAmount.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                    <div className="text-slate-400 text-[11px]">Extra Add-ons</div>
                    <div className="text-base font-bold text-emerald-400 mt-0.5 font-mono">
                      +₹{addOnsTotal.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                    <div className="text-slate-400 text-[11px]">Subtotal</div>
                    <div className="text-base font-bold text-blue-300 mt-0.5 font-mono">
                      ₹{subtotal.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                    <div className="text-slate-400 text-[11px]">Discount</div>
                    <div className="text-base font-bold text-amber-400 mt-0.5 font-mono">
                      -₹{discountAmount.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Big Final Total Display */}
                <div className="bg-slate-800 p-3.5 rounded-xl border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase font-bold text-emerald-400">
                      Final Payable Total
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight mt-0.5">
                      ₹{finalTotal.toLocaleString('en-IN')}
                    </div>
                    {advancePaid > 0 && (
                      <div className="text-[11px] text-slate-400 mt-1">
                        Advance Paid: ₹{advancePaid.toLocaleString('en-IN')} &bull; Balance Due Collected: ₹
                        {balanceCollectedNow.toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>

                  {/* Payment Mode Selector & Received/Balance */}
                  <div className="space-y-2 sm:text-right">
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        Payment Mode
                      </label>
                      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                        {(['Cash', 'UPI', 'Credit', 'Card', 'Bank Transfer'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => handlePaymentModeChange(mode)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              paymentMode === mode
                                ? mode === 'Credit'
                                  ? 'bg-amber-600 text-white shadow-2xs'
                                  : 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Received Amount & Balance Breakdown */}
                    <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-700/80 space-y-2 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[11px] font-semibold text-slate-300">
                          Amount Received:
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 text-xs">₹</span>
                          <input
                            type="number"
                            min="0"
                            max={finalTotal}
                            value={receivedAmount}
                            onChange={(e) => setReceivedAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-24 bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-xs text-white font-mono font-bold text-right focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Quick fill buttons */}
                      <div className="flex items-center justify-end gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => setReceivedAmount(finalTotal)}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium rounded border border-slate-600 cursor-pointer"
                        >
                          Full (₹{finalTotal})
                        </button>
                        <button
                          type="button"
                          onClick={() => setReceivedAmount(0)}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-medium rounded border border-slate-600 cursor-pointer"
                        >
                          Zero / Credit
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                        <span className="text-slate-400">Balance Due:</span>
                        <span className={`font-mono font-bold ${balanceAmount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          ₹{balanceAmount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Completion Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Completion Notes / Feedback (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Work verified and approved by customer, payment received in full"
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 2: Bill of Supply Preview & PDF Document */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <BillOfSupplyDocument
                booking={constructedCompletedBooking}
                companyInfo={companyInfo}
                baseAmount={Number(baseAmount) || 0}
                addOnServices={addOnServices}
                discountAmount={discountAmount}
                discountType={discountType}
                discountValue={discountValue}
                finalTotal={finalTotal}
                receivedAmount={receivedAmount}
                balanceAmount={balanceAmount}
                paymentMode={paymentMode}
                completionTime={booking.preferredTime || undefined}
                onBack={() => setActiveTab('calculation')}
              />
            </div>
          )}

          {/* TAB 3: WhatsApp Message Preview */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>WhatsApp Bill Receipt Template</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyWhatsAppReceipt}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Copy Message
                  </button>
                  <button
                    type="button"
                    onClick={handleSendWhatsAppReceipt}
                    className="px-3 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open WhatsApp</span>
                  </button>
                </div>
              </div>

              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl">
                <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {whatsAppMessageText}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendWhatsAppReceipt}
              className="px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              title="Open WhatsApp with receipt"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">WhatsApp Bill</span>
            </button>
            <button
              type="button"
              onClick={handleSubmitCompletion}
              className={`px-5 py-2 text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 ${
                finalTotal <= 0
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
              id="btn-confirm-complete-service"
              title={finalTotal <= 0 ? 'Amount must be greater than ₹0 to complete service' : 'Complete service & save Bill of Supply'}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {finalTotal <= 0
                  ? 'Complete Service & Save Bill of Supply (₹0)'
                  : `Complete Service & Save Bill of Supply (₹${finalTotal.toLocaleString('en-IN')})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
