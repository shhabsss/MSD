import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  buildCustomerWhatsAppMessage,
  buildStaffWhatsAppMessage,
  cleanWhatsAppNumber,
  createWhatsAppWebUrl,
} from '../services/storageService';
import {
  Booking,
  CompanyInfo,
  MessageDeliveryStatus,
  StaffMember,
  StaffMessageStatus,
} from '../types';

interface BookingMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  allStaff: StaffMember[];
  companyInfo: CompanyInfo;
  onUpdateBooking?: (updatedBooking: Booking) => void;
  isDetailsChangedNotice?: boolean;
  initialNoticeTitle?: string;
  googleSheetSyncResult?: { success: boolean; message: string; remoteSaved?: boolean } | null;
}

export const BookingMessageModal: React.FC<BookingMessageModalProps> = ({
  isOpen,
  onClose,
  booking,
  allStaff = [],
  companyInfo,
  onUpdateBooking,
  isDetailsChangedNotice = false,
  initialNoticeTitle,
  googleSheetSyncResult,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedCustomerPreview, setExpandedCustomerPreview] = useState(false);
  const [expandedStaffPreview, setExpandedStaffPreview] = useState<Record<string, boolean>>({});

  // Multi-step send queue for "Send All Messages" to safely bypass browser popup blockers
  const [sendQueue, setSendQueue] = useState<{ id: string; type: 'customer' | 'staff'; name: string; phone: string; text: string }[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const [browserBlockedNotice, setBrowserBlockedNotice] = useState(false);

  // Local state for active booking to allow instantaneous UI feedback
  const [activeBooking, setActiveBooking] = useState<Booking | null>(booking);

  useEffect(() => {
    setActiveBooking(booking);
  }, [booking]);

  // Resolve assigned staff list
  const assignedStaffMembers = useMemo(() => {
    if (!activeBooking) return [];
    const list: StaffMember[] = [];
    const staffIds = activeBooking.assignedStaffIds || [];
    const staffNames = activeBooking.assignedStaffNames || [];

    // Map by IDs first
    for (const sId of staffIds) {
      const found = allStaff.find((s) => s.id === sId);
      if (found && !list.some((item) => item.id === found.id)) {
        list.push(found);
      }
    }

    // Map by Names if any missing
    for (const name of staffNames) {
      const found = allStaff.find((s) => s.name.toLowerCase() === name.toLowerCase());
      if (found && !list.some((item) => item.id === found.id)) {
        list.push(found);
      } else if (!list.some((item) => item.name === name)) {
        // Pseudo staff record if not found in staff master
        list.push({
          id: `temp-${name}`,
          name: name,
          mobile: '',
          status: 'active',
        });
      }
    }

    return list;
  }, [activeBooking, allStaff]);

  // Customer message text
  const customerMessageText = useMemo(() => {
    if (!activeBooking) return '';
    return buildCustomerWhatsAppMessage(activeBooking, allStaff, companyInfo);
  }, [activeBooking, allStaff, companyInfo]);

  // Pre-generate staff messages map
  const staffMessagesMap = useMemo(() => {
    if (!activeBooking) return {};
    const map: Record<string, { member: StaffMember; text: string; hasPhone: boolean }> = {};
    for (const staff of assignedStaffMembers) {
      const text = buildStaffWhatsAppMessage(activeBooking, staff, companyInfo);
      map[staff.id] = {
        member: staff,
        text,
        hasPhone: Boolean(staff.mobile && staff.mobile.trim()),
      };
    }
    return map;
  }, [activeBooking, assignedStaffMembers, companyInfo]);

  // Return null if modal is closed or active booking is not set (AFTER all React hooks)
  if (!isOpen || !activeBooking) return null;

  // Helper to persist message status changes back to booking
  const updateDeliveryStatus = (
    type: 'customer' | 'staff',
    staffId?: string,
    newStatus: MessageDeliveryStatus = 'Opened'
  ) => {
    const nowIso = new Date().toISOString();
    let updated: Booking = { ...activeBooking };

    if (type === 'customer') {
      updated = {
        ...updated,
        customerMessageStatus: newStatus,
        customerMessageOpenedAt: newStatus === 'Opened' ? nowIso : updated.customerMessageOpenedAt,
        customerMessageSentAt: newStatus === 'Sent' ? nowIso : updated.customerMessageSentAt,
      };
    } else if (type === 'staff' && staffId) {
      const staffMap: Record<string, StaffMessageStatus> = { ...(updated.staffMessageStatuses || {}) };
      const currentStaff = assignedStaffMembers.find((s) => s.id === staffId);
      staffMap[staffId] = {
        staffId,
        staffName: currentStaff ? currentStaff.name : staffId,
        phone: currentStaff?.mobile || '',
        status: newStatus,
        openedAt: newStatus === 'Opened' ? nowIso : staffMap[staffId]?.openedAt,
        sentAt: newStatus === 'Sent' ? nowIso : staffMap[staffId]?.sentAt,
      };
      updated = {
        ...updated,
        staffMessageStatuses: staffMap,
        staffMessageSentAt: nowIso,
      };
    }

    setActiveBooking(updated);
    if (onUpdateBooking) {
      onUpdateBooking(updated);
    }
  };

  // Open customer WhatsApp
  const handleOpenCustomerWhatsApp = () => {
    const phone = activeBooking.customerWhatsApp || activeBooking.customerMobile;
    if (!phone || !phone.trim()) {
      alert('Customer WhatsApp number is missing. Please add the number before sending the message.');
      return;
    }
    const url = createWhatsAppWebUrl(phone, customerMessageText);
    const win = window.open(url, '_blank');
    if (win) {
      updateDeliveryStatus('customer', undefined, 'Opened');
    } else {
      setBrowserBlockedNotice(true);
      updateDeliveryStatus('customer', undefined, 'Opened');
    }
  };

  // Open individual staff WhatsApp
  const handleOpenStaffWhatsApp = (staff: StaffMember) => {
    if (!staff.mobile || !staff.mobile.trim()) {
      alert(`${staff.name} has no mobile number. Staff message was not sent.`);
      return;
    }
    const staffData = staffMessagesMap[staff.id];
    const text = staffData ? staffData.text : buildStaffWhatsAppMessage(activeBooking, staff, companyInfo);
    const url = createWhatsAppWebUrl(staff.mobile, text);
    const win = window.open(url, '_blank');
    if (win) {
      updateDeliveryStatus('staff', staff.id, 'Opened');
    } else {
      setBrowserBlockedNotice(true);
      updateDeliveryStatus('staff', staff.id, 'Opened');
    }
  };

  // Handle "Send All Messages" via an automated or step-by-step queue
  const handleStartSendAll = () => {
    const items: { id: string; type: 'customer' | 'staff'; name: string; phone: string; text: string }[] = [];

    // 1. Customer item
    const custPhone = activeBooking.customerWhatsApp || activeBooking.customerMobile;
    if (custPhone && custPhone.trim()) {
      items.push({
        id: 'customer',
        type: 'customer',
        name: activeBooking.customerName,
        phone: custPhone,
        text: customerMessageText,
      });
    }

    // 2. Staff items
    for (const staff of assignedStaffMembers) {
      if (staff.mobile && staff.mobile.trim()) {
        const staffData = staffMessagesMap[staff.id];
        items.push({
          id: staff.id,
          type: 'staff',
          name: staff.name,
          phone: staff.mobile,
          text: staffData?.text || buildStaffWhatsAppMessage(activeBooking, staff, companyInfo),
        });
      }
    }

    if (items.length === 0) {
      alert('No valid phone numbers found to send messages to.');
      return;
    }

    // Attempt to open the first item immediately
    const firstItem = items[0];
    const firstUrl = createWhatsAppWebUrl(firstItem.phone, firstItem.text);
    const firstWin = window.open(firstUrl, '_blank');

    if (firstItem.type === 'customer') {
      updateDeliveryStatus('customer', undefined, 'Opened');
    } else {
      updateDeliveryStatus('staff', firstItem.id, 'Opened');
    }

    if (items.length === 1) {
      return;
    }

    // For multiple items: check if popups are allowed or guide user step by step
    setSendQueue(items);
    setQueueIndex(1); // Next to send is index 1
    if (!firstWin) {
      setBrowserBlockedNotice(true);
    }
  };

  // Send next message in queue
  const handleSendNextInQueue = () => {
    if (queueIndex < 0 || queueIndex >= sendQueue.length) {
      setSendQueue([]);
      setQueueIndex(-1);
      return;
    }

    const currentItem = sendQueue[queueIndex];
    const url = createWhatsAppWebUrl(currentItem.phone, currentItem.text);
    window.open(url, '_blank');

    if (currentItem.type === 'customer') {
      updateDeliveryStatus('customer', undefined, 'Opened');
    } else {
      updateDeliveryStatus('staff', currentItem.id, 'Opened');
    }

    if (queueIndex + 1 < sendQueue.length) {
      setQueueIndex((prev) => prev + 1);
    } else {
      // Completed all
      setSendQueue([]);
      setQueueIndex(-1);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Status badge styling helper
  const getStatusBadge = (status: MessageDeliveryStatus | undefined) => {
    const s = status || 'Ready';
    switch (s) {
      case 'Sent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCheck className="w-3 h-3 text-emerald-600" />
            Message Sent
          </span>
        );
      case 'Opened':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <ExternalLink className="w-3 h-3 text-blue-600" />
            WhatsApp Opened
          </span>
        );
      case 'Number Missing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Number Missing
          </span>
        );
      case 'Failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            Failed
          </span>
        );
      case 'Not Sent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3 h-3 text-slate-500" />
            Not Sent
          </span>
        );
      case 'Ready':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Ready to Send
          </span>
        );
    }
  };

  const customerPhone = activeBooking.customerWhatsApp || activeBooking.customerMobile;
  const isCustomerPhoneMissing = !customerPhone || !customerPhone.trim();
  const customerStatus = isCustomerPhoneMissing
    ? 'Number Missing'
    : (activeBooking.customerMessageStatus || 'Ready');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-white shadow-md">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white">
                  {initialNoticeTitle ||
                    (isDetailsChangedNotice
                      ? 'Booking Details Changed'
                      : 'Booking Saved Successfully')}
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md">
                  {activeBooking.bookingRef}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {isDetailsChangedNotice
                  ? 'Send updated WhatsApp messages to customer or staff'
                  : 'Automated WhatsApp messaging system for MSD Facility Services'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs bg-slate-50/50">
          {/* Cloud Google Sheet Sync Confirmation Banner */}
          {googleSheetSyncResult && (
            <div
              className={`rounded-xl p-3 border flex items-start gap-2.5 text-xs ${
                googleSheetSyncResult.remoteSaved
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              <CheckCheck
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  googleSheetSyncResult.remoteSaved ? 'text-emerald-600' : 'text-blue-600'
                }`}
              />
              <div className="flex-1">
                <div className="font-bold">
                  {googleSheetSyncResult.remoteSaved
                    ? 'Google Sheet Saved Successfully ✅'
                    : 'Saved to Local Central Database ✅'}
                </div>
                <div className="text-[11px] opacity-90 mt-0.5">
                  {googleSheetSyncResult.message}
                </div>
              </div>
            </div>
          )}

          {/* Details Changed Prompt Banner */}
          {isDetailsChangedNotice && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 space-y-2 text-amber-950">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Booking details changed. Send updated WhatsApp message?</span>
              </div>
              <p className="text-[11px] text-amber-800">
                You can send updated confirmations to the customer, assigned staff, or both below.
              </p>
            </div>
          )}

          {/* Browser Popup Block Guide (if triggered) */}
          {browserBlockedNotice && (
            <div className="bg-rose-50 border border-rose-300 rounded-xl p-3.5 space-y-2 text-rose-950">
              <div className="flex items-start gap-2 font-bold text-xs text-rose-900">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span>Browser Security Notice:</span>
                  <div className="text-[11px] font-normal text-rose-800 mt-0.5">
                    Your browser prevented multiple tabs from opening at the same time. Use the{' '}
                    <span className="font-bold">"Send Next Message"</span> button below to deliver each message step by step without interruption.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step-by-Step Queue Controller (when sending all) */}
          {sendQueue.length > 0 && queueIndex >= 0 && (
            <div className="bg-blue-50 border border-blue-300 rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-blue-900 text-xs flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                    {queueIndex + 1}
                  </span>
                  Sending Queue: {queueIndex + 1} of {sendQueue.length}
                </div>
                <span className="text-[11px] text-blue-700 font-medium">
                  {sendQueue[queueIndex]?.name} ({sendQueue[queueIndex]?.type === 'customer' ? 'Customer' : 'Staff'})
                </span>
              </div>

              <div className="text-[11px] text-blue-800">
                Browser security prevents multiple WhatsApp windows from opening automatically. Click Next to send the remaining messages.
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSendNextInQueue}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Next ({sendQueue[queueIndex]?.name}) &bull; {sendQueue.length - queueIndex} Remaining
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSendQueue([]);
                    setQueueIndex(-1);
                  }}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
                >
                  Cancel Queue
                </button>
              </div>
            </div>
          )}

          {/* Section 1: Customer WhatsApp Message */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <User className="w-4 h-4 text-blue-600" />
                    Customer Message
                  </span>
                  {getStatusBadge(customerStatus)}
                </div>
                <div className="text-slate-600 text-xs">
                  <span className="font-medium text-slate-800">{activeBooking.customerName}</span>
                  {' &bull; '}
                  <span className="font-mono text-slate-700">
                    {customerPhone || (
                      <span className="text-rose-600 font-bold">No Number Provided</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Action Buttons for Customer */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => copyToClipboard(customerMessageText, 'customer')}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  title="Copy Message Text"
                >
                  {copiedId === 'customer' ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>

                {!isCustomerPhoneMissing && (
                  <button
                    type="button"
                    onClick={handleOpenCustomerWhatsApp}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {customerStatus === 'Opened' || customerStatus === 'Sent'
                      ? 'Resend Customer WhatsApp'
                      : 'Send Customer WhatsApp'}
                  </button>
                )}
              </div>
            </div>

            {/* Validation Notice if number missing */}
            {isCustomerPhoneMissing && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 flex items-center gap-2 text-rose-800 text-[11px]">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>
                  Customer WhatsApp number is missing. Please add the number before sending the message.
                </span>
              </div>
            )}

            {/* Status & Sent Timestamp Info */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-500">
              <div className="flex items-center gap-2">
                {activeBooking.customerMessageOpenedAt && (
                  <span>Opened at: {new Date(activeBooking.customerMessageOpenedAt).toLocaleTimeString()}</span>
                )}
                {activeBooking.customerMessageSentAt && (
                  <span className="text-emerald-700 font-medium">
                    &bull; Sent: {new Date(activeBooking.customerMessageSentAt).toLocaleTimeString()}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateDeliveryStatus(
                      'customer',
                      undefined,
                      activeBooking.customerMessageStatus === 'Sent' ? 'Ready' : 'Sent'
                    )
                  }
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                >
                  {activeBooking.customerMessageStatus === 'Sent'
                    ? 'Mark as Unsent'
                    : 'Mark as Sent ✅'}
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedCustomerPreview(!expandedCustomerPreview)}
                  className="text-slate-600 hover:text-slate-900 flex items-center gap-0.5 font-medium cursor-pointer"
                >
                  <span>{expandedCustomerPreview ? 'Hide Preview' : 'View Message'}</span>
                  {expandedCustomerPreview ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Message Preview Box */}
            {expandedCustomerPreview && (
              <div className="mt-2 bg-slate-900 text-slate-100 font-mono text-[11px] rounded-xl p-3.5 whitespace-pre-wrap leading-relaxed border border-slate-800 shadow-inner">
                {customerMessageText}
              </div>
            )}
          </div>

          {/* Section 2: Staff WhatsApp Messages */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Assigned Staff Messages
                </span>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {assignedStaffMembers.length} {assignedStaffMembers.length === 1 ? 'Staff' : 'Staff Members'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Separate job assignment generated for each worker
              </span>
            </div>

            {assignedStaffMembers.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center text-slate-500 text-xs">
                No staff members currently assigned to this booking. You can assign staff in the booking edit screen.
              </div>
            ) : (
              <div className="space-y-3 divide-y divide-slate-100">
                {assignedStaffMembers.map((staff, idx) => {
                  const staffData = staffMessagesMap[staff.id];
                  const hasPhone = staffData?.hasPhone;
                  const staffStatusInfo = activeBooking.staffMessageStatuses?.[staff.id];
                  const currentStatus: MessageDeliveryStatus = !hasPhone
                    ? 'Number Missing'
                    : (staffStatusInfo?.status || 'Ready');
                  const isExpanded = expandedStaffPreview[staff.id];

                  return (
                    <div key={staff.id || idx} className={idx > 0 ? 'pt-3' : ''}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">{staff.name}</span>
                            {getStatusBadge(currentStatus)}
                          </div>
                          <div className="text-slate-600 text-xs flex items-center gap-2">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {hasPhone ? (
                              <span className="font-mono text-slate-800 font-medium">
                                {staff.mobile}
                              </span>
                            ) : (
                              <span className="text-rose-600 font-bold">
                                No mobile number in Staff Master
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasPhone && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(staffData?.text || '', staff.id)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                              title="Copy Message Text"
                            >
                              {copiedId === staff.id ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          {hasPhone ? (
                            <button
                              type="button"
                              onClick={() => handleOpenStaffWhatsApp(staff)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              {currentStatus === 'Opened' || currentStatus === 'Sent'
                                ? `Resend to ${staff.name.replace(/^Mr\.\s*/, '')}`
                                : `Send Staff WhatsApp`}
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Cannot send (No number)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Missing Number Alert for this specific staff */}
                      {!hasPhone && (
                        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-center gap-2 text-amber-900 text-[11px]">
                          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                          <span>
                            {staff.name} has no mobile number. Staff message was not sent.
                          </span>
                        </div>
                      )}

                      {/* Footer toggle and status */}
                      <div className="flex items-center justify-between pt-1 mt-1 text-[11px] text-slate-500">
                        <div>
                          {staffStatusInfo?.openedAt && (
                            <span>Opened: {new Date(staffStatusInfo.openedAt).toLocaleTimeString()}</span>
                          )}
                          {staffStatusInfo?.sentAt && (
                            <span className="text-emerald-700 font-medium ml-2">
                              &bull; Sent: {new Date(staffStatusInfo.sentAt).toLocaleTimeString()}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {hasPhone && (
                            <button
                              type="button"
                              onClick={() =>
                                updateDeliveryStatus(
                                  'staff',
                                  staff.id,
                                  currentStatus === 'Sent' ? 'Ready' : 'Sent'
                                )
                              }
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                            >
                              {currentStatus === 'Sent' ? 'Mark as Unsent' : 'Mark as Sent ✅'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedStaffPreview((prev) => ({
                                ...prev,
                                [staff.id]: !prev[staff.id],
                              }))
                            }
                            className="text-slate-600 hover:text-slate-900 flex items-center gap-0.5 font-medium cursor-pointer"
                          >
                            <span>{isExpanded ? 'Hide Preview' : 'View Message'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Preview Box */}
                      {isExpanded && staffData && (
                        <div className="mt-2 bg-slate-900 text-slate-100 font-mono text-[11px] rounded-xl p-3.5 whitespace-pre-wrap leading-relaxed border border-slate-800 shadow-inner">
                          {staffData.text}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer with One-Click Send All */}
        <div className="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            WhatsApp deep link integration enabled
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStartSendAll}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              Send All WhatsApp Messages
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
