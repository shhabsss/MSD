import {
  AlertCircle,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Copy,
  Edit2,
  Eye,
  FileSpreadsheet,
  Filter,
  MapPin,
  MessageCircle,
  Phone,
  PlayCircle,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  formatDisplayDate,
  getLocalDateString,
  getTomorrowDateString,
  isSameDay,
  normalizeDateString,
} from '../utils/dateUtils';
import {
  Booking,
  BookingStatus,
  PaymentStatus,
  SlotDefinition,
  StaffMember,
} from '../types';

export { formatDisplayDate };

export interface StatusVisualConfig {
  label: string;
  badgeClass: string;
  dotColor: string;
  icon: React.ElementType;
}

export const STATUS_VISUALS: Record<BookingStatus, StatusVisualConfig> = {
  Confirmed: {
    label: 'Confirmed',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    dotColor: 'bg-emerald-600',
    icon: CheckCircle2,
  },
  Pending: {
    label: 'Pending',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    dotColor: 'bg-amber-500',
    icon: Clock,
  },
  New: {
    label: 'New',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-300',
    dotColor: 'bg-sky-500',
    icon: AlertCircle,
  },
  'Staff Assigned': {
    label: 'Staff Assigned',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-300',
    dotColor: 'bg-indigo-600',
    icon: UserCheck,
  },
  'In Progress': {
    label: 'In Progress',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-300',
    dotColor: 'bg-purple-600 animate-pulse',
    icon: PlayCircle,
  },
  Completed: {
    label: 'Completed',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-300',
    dotColor: 'bg-teal-600',
    icon: CheckCheck,
  },
  Rescheduled: {
    label: 'Rescheduled',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-300',
    dotColor: 'bg-orange-500',
    icon: RotateCcw,
  },
  Postponed: {
    label: 'Postponed',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
    dotColor: 'bg-amber-600',
    icon: RotateCcw,
  },
  Cancelled: {
    label: 'Cancelled',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 line-through opacity-75',
    dotColor: 'bg-rose-500',
    icon: XCircle,
  },
};

export const getStatusVisual = (status: string): StatusVisualConfig => {
  if (status in STATUS_VISUALS) {
    return STATUS_VISUALS[status as BookingStatus];
  }
  return {
    label: status || 'Unknown',
    badgeClass: 'bg-slate-50 text-slate-800 border-slate-300',
    dotColor: 'bg-slate-400',
    icon: AlertCircle,
  };
};

export function formatAmount(amount?: number | string): string {
  if (amount === undefined || amount === null || amount === '') return '₹0';
  if (amount === 'After Visit' || amount === 'after_visit') return 'After Visit';
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (isNaN(num)) return String(amount);
  return `₹${num.toLocaleString('en-IN')}`;
}

interface DailyBookingBoardProps {
  selectedDate: string;
  setSelectedDate?: (date: string) => void;
  allSlots?: SlotDefinition[];
  bookingsForDate?: Booking[];
  bookings?: Booking[];
  allStaff?: StaffMember[];
  onViewBooking: (booking: Booking) => void;
  onEditBooking: (booking: Booking) => void;
  onDuplicateBooking?: (booking: Booking) => void;
  onDeleteBooking: (bookingId: string, bookingRef: string) => void;
  onQuickBookSlot?: (slotNumber: number) => void;
  onSlotClick?: (slotNumber: number, existingBooking?: Booking) => void;
  onNewBooking?: () => void;
  onQuickStatusChange: (bookingId: string, newStatus: BookingStatus) => void;
  onAssignStaff?: (bookingId: string, staffIds: string[]) => void;
  onOpenWhatsApp?: (booking: Booking, type: 'customer' | 'staff') => void;
  onOpenMessageModal?: (booking: Booking) => void;
  onOpenCompleteModal?: (booking: Booking) => void;
  onPaymentStatusChange?: (bookingId: string, newPaymentStatus: PaymentStatus) => void;
}

export const DailyBookingBoard: React.FC<DailyBookingBoardProps> = ({
  selectedDate,
  setSelectedDate,
  allSlots = [],
  bookingsForDate = [],
  bookings = [],
  allStaff = [],
  onViewBooking,
  onEditBooking,
  onDuplicateBooking,
  onDeleteBooking,
  onNewBooking,
  onQuickStatusChange,
  onPaymentStatusChange,
  onAssignStaff,
  onOpenMessageModal,
  onOpenCompleteModal,
}) => {
  // Compute standard system dates (local calendar date, avoids UTC offset issues)
  const todayStr = useMemo(() => getLocalDateString(), []);
  const tomorrowStr = useMemo(() => getTomorrowDateString(), []);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  // Date filter mode: 'today' | 'tomorrow' | 'custom' | 'all'
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'tomorrow' | 'custom' | 'all'>('today');
  const [customSelectedDate, setCustomSelectedDate] = useState<string>(() =>
    selectedDate ? normalizeDateString(selectedDate) : todayStr
  );
  const [staffFilter, setStaffFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');

  // Synchronize internal customSelectedDate when parent selectedDate prop changes
  useEffect(() => {
    if (selectedDate) {
      const normalizedProp = normalizeDateString(selectedDate);
      if (normalizedProp) {
        setCustomSelectedDate(normalizedProp);
        if (isSameDay(normalizedProp, todayStr)) {
          setDateFilterMode('today');
        } else if (isSameDay(normalizedProp, tomorrowStr)) {
          setDateFilterMode('tomorrow');
        } else {
          setDateFilterMode('custom');
        }
      }
    }
  }, [selectedDate, todayStr, tomorrowStr]);

  // Quick staff assignment dialog state
  const [staffAssignBooking, setStaffAssignBooking] = useState<Booking | null>(null);
  const [tempSelectedStaffIds, setTempSelectedStaffIds] = useState<string[]>([]);

  // Collect unique services for dropdown filter
  const uniqueServices = useMemo(() => {
    const svcs = new Set<string>();
    (bookings || []).forEach((b) => {
      if (b.serviceType) svcs.add(b.serviceType);
    });
    return Array.from(svcs).sort();
  }, [bookings]);

  // Determine active date filter string (normalized YYYY-MM-DD or null for all)
  const activeDateTarget = useMemo(() => {
    if (dateFilterMode === 'today') return todayStr;
    if (dateFilterMode === 'tomorrow') return tomorrowStr;
    if (dateFilterMode === 'custom') return normalizeDateString(customSelectedDate);
    return null; // 'all'
  }, [dateFilterMode, todayStr, tomorrowStr, customSelectedDate]);

  // ACTIVE VIEW METRICS (Accurately computed for the selected date or all dates)
  const activeDateBookings = useMemo(() => {
    return (bookings || []).filter((b) => {
      if (b.bookingStatus === 'Cancelled') return false;
      if (activeDateTarget === null) return true;
      const bDate = b.scheduleDate || b.bookingDate;
      return isSameDay(bDate, activeDateTarget);
    });
  }, [bookings, activeDateTarget]);

  const activeDateBookingsCount = activeDateBookings.length;
  const totalSlotsCount = allSlots.length > 0 ? allSlots.length : 10;
  const bookedSlotNumbers = new Set(
    activeDateBookings.filter((b) => b.slotNumber > 0).map((b) => b.slotNumber)
  );
  const bookedSlotsCount = bookedSlotNumbers.size || Math.min(activeDateBookingsCount, totalSlotsCount);
  const availableSlotsCount = Math.max(0, totalSlotsCount - bookedSlotsCount);

  // Filter bookings list
  const filteredBookings = useMemo(() => {
    return (bookings || []).filter((b) => {
      // Date filter: correctly compare scheduleDate (or fallback bookingDate) with activeDateTarget
      if (activeDateTarget !== null) {
        const bDate = b.scheduleDate || b.bookingDate;
        if (!isSameDay(bDate, activeDateTarget)) return false;
      }

      // Staff filter
      if (staffFilter === 'unassigned') {
        if (b.assignedStaffIds && b.assignedStaffIds.length > 0) return false;
      } else if (staffFilter !== 'all') {
        if (!b.assignedStaffIds || !b.assignedStaffIds.includes(staffFilter)) return false;
      }

      // Booking status filter
      if (statusFilter !== 'all' && b.bookingStatus !== statusFilter) {
        return false;
      }

      // Payment status filter
      if (paymentFilter !== 'all' && b.paymentStatus !== paymentFilter) {
        return false;
      }

      // Service filter
      if (serviceFilter !== 'all' && b.serviceType !== serviceFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const staffMatch = (b.assignedStaffNames || []).some((n) => n.toLowerCase().includes(q));
        const refMatch = (b.bookingRef || '').toLowerCase().includes(q);
        const nameMatch = (b.customerName || '').toLowerCase().includes(q);
        const mobileMatch = (b.customerMobile || '').includes(q);
        const serviceMatch = (b.serviceType || '').toLowerCase().includes(q);
        const descMatch = (b.serviceDescription || '').toLowerCase().includes(q);
        const addressMatch = (b.fullAddress || '').toLowerCase().includes(q) ||
                             (b.serviceLocation || '').toLowerCase().includes(q);

        if (
          !refMatch &&
          !nameMatch &&
          !mobileMatch &&
          !serviceMatch &&
          !descMatch &&
          !addressMatch &&
          !staffMatch
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    bookings,
    activeDateTarget,
    staffFilter,
    statusFilter,
    paymentFilter,
    serviceFilter,
    searchQuery,
  ]);

  // Keep latest booking at top
  const sortedBookings = useMemo(() => {
    return [...filteredBookings].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.bookingDate || 0).getTime();
      const timeB = new Date(b.createdAt || b.bookingDate || 0).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return b.bookingRef.localeCompare(a.bookingRef);
    });
  }, [filteredBookings]);

  // Check if any filter is active
  const hasActiveFilters = Boolean(
    searchQuery ||
    dateFilterMode !== 'today' ||
    staffFilter !== 'all' ||
    statusFilter !== 'all' ||
    paymentFilter !== 'all' ||
    serviceFilter !== 'all'
  );

  const handleClearFilters = () => {
    setSearchQuery('');
    setDateFilterMode('today');
    setCustomSelectedDate(todayStr);
    setStaffFilter('all');
    setStatusFilter('all');
    setPaymentFilter('all');
    setServiceFilter('all');
    if (setSelectedDate) setSelectedDate(todayStr);
  };

  // Open Quick Staff Assignment Modal
  const handleOpenStaffModal = (b: Booking) => {
    setStaffAssignBooking(b);
    setTempSelectedStaffIds(b.assignedStaffIds || []);
  };

  const handleToggleStaffId = (id: string) => {
    setTempSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSaveStaffAssignment = () => {
    if (!staffAssignBooking) return;
    if (onAssignStaff) {
      onAssignStaff(staffAssignBooking.id, tempSelectedStaffIds);
    } else {
      // Fallback: use onEditBooking with updated staff
      const assignedStaffMembers = tempSelectedStaffIds
        .map((id) => allStaff.find((s) => s.id === id))
        .filter(Boolean);
      const assignedNames = assignedStaffMembers.map((s) => s!.name);

      let staffMobileStr = '';
      if (assignedStaffMembers.length === 1) {
        staffMobileStr = assignedStaffMembers[0]!.mobile || '';
      } else if (assignedStaffMembers.length > 1) {
        const withNames = assignedStaffMembers
          .filter((s) => s!.mobile)
          .map((s) => `${s!.name.replace(/^Mr\.\s*/i, '')}: ${s!.mobile}`);
        staffMobileStr = withNames.length > 0
          ? withNames.join(', ')
          : assignedStaffMembers.map((s) => s!.mobile).filter(Boolean).join(', ');
      }

      onEditBooking({
        ...staffAssignBooking,
        assignedStaffIds: tempSelectedStaffIds,
        assignedStaffNames: assignedNames,
        staffMobile: staffMobileStr,
        bookingStatus:
          staffAssignBooking.bookingStatus === 'New' || staffAssignBooking.bookingStatus === 'Pending'
            ? 'Staff Assigned'
            : staffAssignBooking.bookingStatus,
      });
    }
    setStaffAssignBooking(null);
  };

  const handleDeleteWithConfirm = (id: string, ref: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete booking ${ref}? This action cannot be undone.`);
    if (confirmed) {
      onDeleteBooking(id, ref);
    }
  };

  return (
    <div className="space-y-3 font-sans text-slate-800" id="excel-booking-management">
      {/* 1. DAILY VIEW HEADER: Required top stats */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
            <span className="text-xs sm:text-sm font-semibold text-slate-700">
              {dateFilterMode === 'today'
                ? "Today's Bookings:"
                : dateFilterMode === 'tomorrow'
                ? "Tomorrow's Bookings:"
                : dateFilterMode === 'all'
                ? 'All Active Bookings:'
                : `Bookings (${formatDisplayDate(activeDateTarget)}):`}
            </span>
            <span className="text-xs sm:text-sm font-bold text-blue-950 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {activeDateBookingsCount}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
            <span className="text-xs sm:text-sm font-semibold text-slate-700">Booked Slots:</span>
            <span className="text-xs sm:text-sm font-bold text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {bookedSlotsCount}/{totalSlotsCount}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span className="text-xs sm:text-sm font-semibold text-slate-700">Available Slots:</span>
            <span className="text-xs sm:text-sm font-bold text-amber-950 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {availableSlotsCount}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNewBooking && (
            <button
              type="button"
              onClick={onNewBooking}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              id="btn-add-booking-header"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create Booking</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. FILTERS CONTAINER */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5 shadow-2xs">
        {/* Row 1: Search Booking & Date Quick Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5 justify-between">
          {/* Search Booking Input */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Booking (Ref, Customer, Mobile, Service, Staff, Address)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              id="input-search-booking-excel"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 text-xs cursor-pointer"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Date Filters: Today, Tomorrow, All Dates, Select Date */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 mr-1">Date:</span>
            <button
              type="button"
              onClick={() => {
                setDateFilterMode('today');
                setCustomSelectedDate(todayStr);
                if (setSelectedDate) setSelectedDate(todayStr);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                dateFilterMode === 'today'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
              id="filter-btn-today"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => {
                setDateFilterMode('tomorrow');
                setCustomSelectedDate(tomorrowStr);
                if (setSelectedDate) setSelectedDate(tomorrowStr);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                dateFilterMode === 'tomorrow'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
              id="filter-btn-tomorrow"
            >
              Tomorrow
            </button>

            <button
              type="button"
              onClick={() => setDateFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                dateFilterMode === 'all'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
              id="filter-btn-all-dates"
            >
              All Dates
            </button>

            {/* Select Date Picker */}
            <div
              className={`flex items-center gap-1 bg-white border rounded-lg px-2 py-1 transition-colors ${
                dateFilterMode === 'custom' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-300'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <input
                type="date"
                value={normalizeDateString(customSelectedDate)}
                onChange={(e) => {
                  const val = e.target.value;
                  const normalized = normalizeDateString(val);
                  setCustomSelectedDate(normalized);
                  setDateFilterMode('custom');
                  if (setSelectedDate && normalized) setSelectedDate(normalized);
                }}
                className="text-xs bg-transparent border-0 p-0 text-slate-800 focus:ring-0 focus:outline-none cursor-pointer"
                title="Select Date"
                id="filter-select-date"
              />
            </div>
          </div>
        </div>

        {/* Row 2: Secondary Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 text-xs">
          {/* Staff Filter */}
          <div className="flex items-center gap-1">
            <label className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">Staff:</label>
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              id="filter-select-staff"
            >
              <option value="all">All Staff</option>
              {allStaff.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
              <option value="unassigned">Unassigned Only</option>
            </select>
          </div>

          {/* Booking Status Filter */}
          <div className="flex items-center gap-1">
            <label className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              id="filter-select-status"
            >
              <option value="all">All Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Pending">Pending</option>
              <option value="Staff Assigned">Staff Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="New">New</option>
              <option value="Rescheduled">Rescheduled</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div className="flex items-center gap-1">
            <label className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">Payment:</label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              id="filter-select-payment"
            >
              <option value="all">All Payments</option>
              <option value="Paid">Paid</option>
              <option value="Fully Paid">Fully Paid</option>
              <option value="Advance Paid">Advance Paid</option>
              <option value="Pending">Pending</option>
              <option value="Not Paid">Not Paid</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Service Filter */}
          <div className="flex items-center gap-1">
            <label className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">Service:</label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[170px] truncate cursor-pointer"
              id="filter-select-service"
            >
              <option value="all">All Services</option>
              {uniqueServices.map((svc) => (
                <option key={svc} value={svc}>
                  {svc}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
              id="btn-clear-all-filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter summary subheader */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
        <div className="flex items-center gap-2">
          <span>
            Showing <strong className="text-slate-800">{sortedBookings.length}</strong> {sortedBookings.length === 1 ? 'booking' : 'bookings'}
          </span>
          {activeDateTarget && (
            <span className="text-slate-400">
              &bull; Date: {formatDisplayDate(activeDateTarget)} {activeDateTarget === todayStr ? '(Today)' : activeDateTarget === tomorrowStr ? '(Tomorrow)' : ''}
            </span>
          )}
        </div>
        <span className="text-slate-400 hidden sm:inline">Excel Spreadsheet Mode &bull; 1 Booking per Row</span>
      </div>

      {/* 3. EXCEL-STYLE HORIZONTAL TABLE: Stays row-and-column on mobile with horizontal scroll */}
      <div className="overflow-x-auto w-full border border-slate-200 rounded-xl bg-white shadow-xs max-h-[72vh] relative">
        <table className="w-full text-left text-xs border-collapse min-w-[1300px]">
          {/* Sticky Header */}
          <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 border-b border-slate-300 text-[11px] uppercase tracking-wider font-bold select-none">
            <tr>
              {/* Col 1: Ref No (Sticky Left on horizontal scroll) */}
              <th className="py-2.5 px-3 border-r border-slate-300 sticky left-0 z-30 bg-slate-100 min-w-[110px]">
                Ref No
              </th>
              {/* Col 2: Booking Date */}
              <th className="py-2.5 px-3 border-r border-slate-300 min-w-[100px]">Booking Date</th>
              {/* Col 3: Schedule Date */}
              <th className="py-2.5 px-3 border-r border-slate-300 min-w-[105px]">Schedule Date</th>
              {/* Col 4: Time Slot */}
              <th className="py-2.5 px-3 border-r border-slate-300 min-w-[110px]">Time Slot</th>
              {/* Col 5: Customer Name */}
              <th className="py-2.5 px-3 border-r border-slate-300 min-w-[140px]">Customer Name</th>
              {/* Col 6: Mobile Number */}
              <th className="py-2.5 px-3 border-r border-slate-300 min-w-[110px]">Mobile Number</th>
              {/* Col 7: Address */}
              <th className="py-2.5 px-3 border-r border-slate-300 min-w-[180px]">Address</th>
              {/* Col 8: Service */}
              <th className="py-2.5 px-3 border-r border-slate-300 min-w-[160px]">Service</th>
              {/* Col 9: Quantity */}
              <th className="py-2.5 px-2 text-center border-r border-slate-300 min-w-[65px]">Quantity</th>
              {/* Col 10: Assigned Staff */}
              <th className="py-2.5 px-3 border-r border-slate-300 min-w-[140px]">Assigned Staff</th>
              {/* Col 11: Amount */}
              <th className="py-2.5 px-3 text-right border-r border-slate-300 min-w-[95px]">Amount</th>
              {/* Col 12: Payment Status */}
              <th className="py-2.5 px-3 text-center border-r border-slate-300 min-w-[115px]">Payment Status</th>
              {/* Col 13: Booking Status */}
              <th className="py-2.5 px-3 text-center border-r border-slate-300 min-w-[130px]">Booking Status</th>
              {/* Col 14: Action */}
              <th className="py-2.5 px-3 text-center min-w-[190px]">Action</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-200">
            {sortedBookings.length > 0 ? (
              sortedBookings.map((b, idx) => {
                const statusVisual = getStatusVisual(b.bookingStatus);
                const hasAssignedStaff = b.assignedStaffNames && b.assignedStaffNames.length > 0;
                const staffDisplay = hasAssignedStaff
                  ? b.assignedStaffNames.map((s) => s.replace(/^Mr\.\s*/, '')).join(', ')
                  : 'Unassigned';

                const timeDisplay = b.preferredTime && b.preferredTime.trim()
                  ? b.preferredTime
                  : b.slotNumber
                  ? `Slot ${b.slotNumber} (${b.slotPeriod || 'Day'})`
                  : '-';

                const addressDisplay = b.fullAddress || b.serviceLocation || '-';

                return (
                  <tr
                    key={b.id || idx}
                    className="hover:bg-blue-50/40 transition-colors group text-slate-800"
                    id={`booking-row-${b.bookingRef}`}
                  >
                    {/* 1. Ref No (Sticky left column) */}
                    <td className="py-2 px-3 border-r border-slate-200 font-mono font-bold text-blue-900 sticky left-0 z-10 bg-white group-hover:bg-blue-50/60 shadow-2xs whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onViewBooking(b)}
                        className="hover:underline text-left text-blue-700 hover:text-blue-900 cursor-pointer"
                        title="Click to view complete details"
                      >
                        {b.bookingRef}
                      </button>
                    </td>

                    {/* 2. Booking Date */}
                    <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap font-medium text-slate-600">
                      {formatDisplayDate(b.bookingDate)}
                    </td>

                    {/* 3. Schedule Date */}
                    <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap font-semibold text-slate-800">
                      {formatDisplayDate(b.scheduleDate || b.bookingDate)}
                    </td>

                    {/* 4. Time Slot */}
                    <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap text-slate-700">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[120px]" title={timeDisplay}>
                          {timeDisplay}
                        </span>
                      </div>
                    </td>

                    {/* 5. Customer Name */}
                    <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap font-semibold text-slate-900">
                      <div className="truncate max-w-[160px]" title={b.customerName}>
                        {b.customerName}
                      </div>
                    </td>

                    {/* 6. Mobile Number */}
                    <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap font-mono text-slate-700">
                      {b.customerMobile ? (
                        <a
                          href={`tel:${b.customerMobile}`}
                          className="text-blue-600 hover:underline inline-flex items-center gap-1"
                          title="Call Customer"
                        >
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{b.customerMobile}</span>
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* 7. Address */}
                    <td className="py-2 px-3 border-r border-slate-200 text-slate-700">
                      <div
                        className="truncate max-w-[200px]"
                        title={addressDisplay}
                      >
                        {addressDisplay}
                      </div>
                    </td>

                    {/* 8. Service */}
                    <td className="py-2 px-3 border-r border-slate-200 font-medium text-slate-800">
                      <div
                        className="truncate max-w-[180px]"
                        title={
                          b.serviceDescription
                            ? `${b.serviceType} - ${b.serviceDescription}`
                            : b.serviceType
                        }
                      >
                        {b.serviceType}
                      </div>
                    </td>

                    {/* 9. Quantity */}
                    <td className="py-2 px-2 border-r border-slate-200 text-center font-bold text-slate-700 whitespace-nowrap">
                      {b.quantity !== undefined && b.quantity > 0 ? b.quantity : 1}
                    </td>

                    {/* 10. Assigned Staff */}
                    <td className="py-2 px-3 border-r border-slate-200 text-slate-700 whitespace-nowrap">
                      {hasAssignedStaff ? (
                        <div className="flex items-center gap-1 text-slate-800 font-medium">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[130px]" title={b.assignedStaffNames.join(', ')}>
                            {staffDisplay}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-100 rounded">
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* 11. Amount */}
                    <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatAmount(b.amount)}
                    </td>

                    {/* 12. Payment Status: Interactive Dropdown */}
                    <td className="py-2 px-3 border-r border-slate-200 text-center whitespace-nowrap">
                      {onPaymentStatusChange ? (
                        <select
                          value={b.paymentStatus || (b.bookingStatus === 'Cancelled' ? 'Cancelled' : 'Pending')}
                          onChange={(e) => {
                            const newPayStatus = e.target.value as PaymentStatus;
                            onPaymentStatusChange(b.id, newPayStatus);
                          }}
                          className={`text-[11px] font-semibold rounded px-2 py-0.5 border shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                            b.paymentStatus === 'Paid' || b.paymentStatus === 'Fully Paid'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : b.paymentStatus === 'Advance Paid'
                              ? 'bg-blue-50 text-blue-800 border-blue-300'
                              : b.paymentStatus === 'Cancelled' || b.bookingStatus === 'Cancelled'
                              ? 'bg-slate-100 text-slate-600 border-slate-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}
                          title="Change payment status"
                        >
                          <option value="Paid">Paid</option>
                          <option value="Pending">Pending</option>
                          <option value="Advance Paid">Advance Paid</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            b.paymentStatus === 'Paid' || b.paymentStatus === 'Fully Paid'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : b.paymentStatus === 'Advance Paid'
                              ? 'bg-blue-50 text-blue-800 border-blue-300'
                              : b.paymentStatus === 'Cancelled' || b.bookingStatus === 'Cancelled'
                              ? 'bg-slate-100 text-slate-600 border-slate-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}
                        >
                          {b.bookingStatus === 'Cancelled' ? 'Cancelled' : (b.paymentStatus || 'Pending')}
                        </span>
                      )}
                    </td>

                    {/* 13. Booking Status: Badge + 1-Click Dropdown */}
                    <td className="py-2 px-3 border-r border-slate-200 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${statusVisual.dotColor}`}
                          title={b.bookingStatus}
                        />
                        <select
                          value={b.bookingStatus}
                          onChange={(e) => {
                            const newStatus = e.target.value as BookingStatus;
                            const cleanAmt = typeof b.amount === 'number'
                              ? b.amount
                              : parseFloat(String(b.amount).replace(/[^\d.]/g, '')) || 0;

                            if (newStatus === 'Completed') {
                              if (cleanAmt <= 0 && onOpenCompleteModal) {
                                onOpenCompleteModal(b);
                                return;
                              }
                            }
                            const hasStaff =
                              (b.assignedStaffIds && b.assignedStaffIds.length > 0) ||
                              (b.assignedStaffNames && b.assignedStaffNames.length > 0);

                            if ((newStatus === 'Confirmed' || newStatus === 'Staff Assigned') && !hasStaff) {
                              alert('Please assign a staff member before confirming the booking.');
                              handleOpenStaffModal(b);
                              return;
                            }
                            onQuickStatusChange(b.id, newStatus);
                          }}
                          className={`text-xs font-semibold rounded px-2 py-1 border shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${statusVisual.badgeClass}`}
                          title="Change status"
                        >
                          <option value="Confirmed">Confirmed</option>
                          <option value="Pending">Pending</option>
                          <option value="Staff Assigned">Staff Assigned</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="New">New</option>
                          <option value="Rescheduled">Rescheduled</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                    </td>

                    {/* 14. Action Column: View, Edit, Assign Staff, Change Status, Delete */}
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {/* View Details */}
                        <button
                          type="button"
                          onClick={() => onViewBooking(b)}
                          title="View Complete Booking Details"
                          className="px-2 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => onEditBooking(b)}
                          title="Edit Booking"
                          className="px-2 py-1 rounded text-xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        {/* Assign Staff */}
                        <button
                          type="button"
                          onClick={() => handleOpenStaffModal(b)}
                          title="Assign Staff"
                          className="px-2 py-1 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Users className="w-3 h-3" />
                          <span>Staff</span>
                        </button>

                        {/* Complete Service / Invoice Action */}
                        {onOpenCompleteModal && (
                          <button
                            type="button"
                            onClick={() => onOpenCompleteModal(b)}
                            title={
                              b.bookingStatus === 'Completed'
                                ? 'View / Print Tax Invoice & Bill'
                                : 'Complete Service & Generate Bill / Invoice'
                            }
                            className={`px-2 py-1 rounded text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1 ${
                              b.bookingStatus === 'Completed'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            <Receipt className="w-3 h-3 text-emerald-700" />
                            <span>{b.bookingStatus === 'Completed' ? 'Invoice' : 'Bill'}</span>
                          </button>
                        )}

                        {/* WhatsApp Message */}
                        {onOpenMessageModal && (
                          <button
                            type="button"
                            onClick={() => onOpenMessageModal(b)}
                            title="Send WhatsApp Alert"
                            className="p-1 rounded text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition-colors cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteWithConfirm(b.id, b.bookingRef)}
                          title="Delete Booking"
                          className="p-1 rounded text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={14} className="py-12 text-center text-slate-500">
                  <div className="max-w-md mx-auto space-y-2.5">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <Search className="w-5 h-5" />
                    </div>
                    <div className="font-semibold text-slate-800 text-sm">
                      {searchQuery
                        ? `No bookings match "${searchQuery}"`
                        : 'No bookings found matching selected filters'}
                    </div>
                    <p className="text-xs text-slate-500">
                      Try clearing filters or click &ldquo;+ Create Booking&rdquo; above to add a new booking to the table.
                    </p>
                    {hasActiveFilters && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleClearFilters}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs border border-blue-200 transition-colors cursor-pointer"
                        >
                          Reset Filters to Today
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 4. QUICK STAFF ASSIGNMENT MODAL */}
      {staffAssignBooking && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">
                  Assign Staff &bull; {staffAssignBooking.bookingRef}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStaffAssignBooking(null)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <p>
                  <strong>Customer:</strong> {staffAssignBooking.customerName}
                </p>
                <p>
                  <strong>Service:</strong> {staffAssignBooking.serviceType}
                </p>
                <p>
                  <strong>Schedule:</strong> {formatDisplayDate(staffAssignBooking.scheduleDate)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Select Staff Members:
                </label>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {allStaff.map((staff) => {
                    const isSelected = tempSelectedStaffIds.includes(staff.id);
                    return (
                      <label
                        key={staff.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors text-xs ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-semibold'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleStaffId(staff.id)}
                            className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span>{staff.name}</span>
                        </div>
                        {staff.mobile && (
                          <span className="font-mono text-[11px] text-slate-400">
                            {staff.mobile}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setStaffAssignBooking(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStaffAssignment}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm cursor-pointer"
              >
                Save Staff Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
