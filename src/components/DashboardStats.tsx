import {
  AlertTriangle,
  BarChart3,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  IndianRupee,
  TrendingUp,
  UserCheck,
  UserX,
  Wallet,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { formatBookingAmount } from '../services/storageService';
import {
  formatLongDisplayDate,
  getDateMonthKey,
  getLocalDateString,
  getTomorrowDateString,
  normalizeDateString,
} from '../utils/dateUtils';
import { Booking, SlotDefinition } from '../types';

interface DashboardStatsProps {
  selectedDate: string; // YYYY-MM-DD
  setSelectedDate: (date: string) => void;
  bookingsForDate?: Booking[];
  allBookings?: Booking[];
  allSlots?: SlotDefinition[];
  onSelectSlotToBook?: (slotNumber: number) => void;
  onSlotClick?: (slotNumber: number, existingBooking?: Booking) => void;
  onNewBooking?: () => void;
  onNavigateToReports?: () => void;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  selectedDate,
  setSelectedDate,
  bookingsForDate = [],
  allBookings = [],
  allSlots = [],
  onSelectSlotToBook,
  onSlotClick,
  onNewBooking,
  onNavigateToReports,
}) => {
  const handleSlotAction = (slotNumber: number, booking?: Booking) => {
    if (onSelectSlotToBook) {
      onSelectSlotToBook(slotNumber);
    } else if (onSlotClick) {
      onSlotClick(slotNumber, booking);
    } else if (onNewBooking) {
      onNewBooking();
    }
  };

  // Current calendar month key (YYYY-MM)
  const currentCalendarMonth = useMemo(() => {
    return getDateMonthKey(getLocalDateString());
  }, []);

  // State for active financial month view, defaulting to selected date's month or current month
  const selectedDateMonth = getDateMonthKey(selectedDate);
  const [activeMonthKey, setActiveMonthKey] = useState<string>(selectedDateMonth || currentCalendarMonth);

  useEffect(() => {
    if (selectedDateMonth && selectedDateMonth !== activeMonthKey) {
      setActiveMonthKey(selectedDateMonth);
    }
  }, [selectedDateMonth]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = activeMonthKey.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    const prevKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setActiveMonthKey(prevKey);
  };

  const handleNextMonth = () => {
    const [y, m] = activeMonthKey.split('-').map(Number);
    const d = new Date(y, m, 1);
    const nextKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setActiveMonthKey(nextKey);
  };

  // Formatted active month name (e.g. "September 2026")
  const monthName = useMemo(() => {
    const [yearStr, monthStr] = activeMonthKey.split('-');
    const monthDate = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
    return monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }, [activeMonthKey]);

  // Filter all bookings for the active month (excluding Cancelled)
  const monthBookings = useMemo(() => {
    return allBookings.filter((b) => {
      const bMonth = getDateMonthKey(b.scheduleDate || b.bookingDate);
      return bMonth === activeMonthKey && b.bookingStatus !== 'Cancelled';
    });
  }, [allBookings, activeMonthKey]);

  // Financial calculations for current month
  const monthFinancials = useMemo(() => {
    let totalRevenue = 0;
    let totalAdvance = 0;
    let totalCollected = 0;
    let totalBalance = 0;
    let afterVisitCount = 0;
    let fixedAmountCount = 0;
    let fullyPaidCount = 0;
    let pendingBalanceCount = 0;

    for (const b of monthBookings) {
      const { isAfterVisit } = formatBookingAmount(b.amount);
      const cleanAmt =
        typeof b.amount === 'number'
          ? b.amount
          : parseFloat(String(b.amount).replace(/[^\d.]/g, '')) || 0;

      const adv = Number(b.advanceAmount) || 0;
      const isCompletedOrPaid =
        b.bookingStatus === 'Completed' ||
        b.paymentStatus === 'Fully Paid' ||
        b.paymentStatus === 'Paid';

      // If booking is Completed or Fully Paid / Paid, collected is finalCollectedAmount or cleanAmt
      const collectedForBooking = isCompletedOrPaid
        ? b.finalCollectedAmount !== undefined && b.finalCollectedAmount !== null
          ? Number(b.finalCollectedAmount)
          : Math.max(cleanAmt, adv)
        : adv;

      const bal =
        isCompletedOrPaid
          ? 0
          : b.balanceAmount !== undefined && b.balanceAmount !== null && !isNaN(Number(b.balanceAmount))
          ? Number(b.balanceAmount)
          : Math.max(0, cleanAmt - adv);

      if (isAfterVisit && !isCompletedOrPaid) {
        afterVisitCount++;
        totalAdvance += adv;
        totalCollected += collectedForBooking;
      } else {
        fixedAmountCount++;
        totalRevenue += cleanAmt;
        totalAdvance += adv;
        totalCollected += collectedForBooking;
        totalBalance += bal;
      }

      if (isCompletedOrPaid || (bal === 0 && cleanAmt > 0)) {
        fullyPaidCount++;
      } else if (bal > 0) {
        pendingBalanceCount++;
      }
    }

    const collectionRate = totalRevenue > 0 ? Math.round((totalCollected / totalRevenue) * 100) : 0;

    return {
      totalRevenue,
      totalAdvance,
      totalCollected,
      totalBalance,
      afterVisitCount,
      fixedAmountCount,
      fullyPaidCount,
      pendingBalanceCount,
      collectionRate,
      totalBookingsCount: monthBookings.length,
    };
  }, [monthBookings]);

  // Date manipulation helpers
  const handlePrevDay = () => {
    const norm = normalizeDateString(selectedDate) || getLocalDateString();
    const [y, m, d] = norm.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() - 1);
    setSelectedDate(getLocalDateString(dateObj));
  };

  const handleNextDay = () => {
    const norm = normalizeDateString(selectedDate) || getLocalDateString();
    const [y, m, d] = norm.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + 1);
    setSelectedDate(getLocalDateString(dateObj));
  };

  const handleSetToday = () => {
    setSelectedDate(getLocalDateString());
  };

  const handleSetTomorrow = () => {
    setSelectedDate(getTomorrowDateString());
  };

  // Metrics for selected day - Strict logical reconciliation
  const cancelled = bookingsForDate.filter((b) => b.bookingStatus === 'Cancelled').length;
  const activeBookings = bookingsForDate.filter((b) => b.bookingStatus !== 'Cancelled');
  const activeTotal = activeBookings.length;
  
  const confirmed = activeBookings.filter(
    (b) => b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Staff Assigned'
  ).length;
  const pending = activeBookings.filter(
    (b) => b.bookingStatus === 'New' || b.bookingStatus === 'Pending'
  ).length;
  const completed = activeBookings.filter((b) => b.bookingStatus === 'Completed').length;

  const staffAssigned = activeBookings.filter(
    (b) =>
      (b.assignedStaffIds && b.assignedStaffIds.length > 0) ||
      (b.assignedStaffNames && b.assignedStaffNames.length > 0)
  ).length;
  const unassigned = Math.max(0, activeTotal - staffAssigned);

  // Synchronize slots 1-10 with bookings for the date
  const slotMapping = useMemo(() => {
    const occupiedMap = new Map<number, Booking>();
    const unallocatedBookings: Booking[] = [];

    for (const b of activeBookings) {
      let slotNum: number | null = null;
      if (typeof b.slotNumber === 'number' && b.slotNumber >= 1 && b.slotNumber <= 10) {
        slotNum = b.slotNumber;
      } else if (b.slotNumber) {
        const parsed = parseInt(String(b.slotNumber), 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
          slotNum = parsed;
        }
      }

      if (!slotNum) {
        const text = `${b.preferredTime || ''} ${(b as any).timeSlot || ''} ${b.serviceDetails || ''}`;
        const match = text.match(/slot\s*(\d+)/i);
        if (match) {
          const parsed = parseInt(match[1], 10);
          if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
            slotNum = parsed;
          }
        }
      }

      if (slotNum && !occupiedMap.has(slotNum)) {
        occupiedMap.set(slotNum, b);
      } else {
        unallocatedBookings.push(b);
      }
    }

    // Allocate any active bookings that lack an explicit slot number into remaining free slots
    for (const b of unallocatedBookings) {
      for (let s = 1; s <= 10; s++) {
        if (!occupiedMap.has(s)) {
          occupiedMap.set(s, b);
          break;
        }
      }
    }

    return occupiedMap;
  }, [activeBookings]);

  const busySlotsCount = slotMapping.size;
  const availableSlotsCount = Math.max(0, 10 - busySlotsCount);

  // Formatted date display (e.g. "Tuesday, 15 Sep 2026")
  const formattedDate = formatLongDisplayDate(selectedDate);

  return (
    <div className="space-y-4 mb-6">
      {/* Monthly Financial Stats Widget (Total Revenue, Total Advance Received, Total Balance Due) */}
      <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 shadow-xs border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Monthly Revenue & Financial Overview</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
                  {monthName}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Calculated across {monthFinancials.totalBookingsCount} active bookings in {monthName}
              </p>
            </div>
          </div>

          {/* Month selector & quick navigation */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 p-1 rounded-lg border border-slate-700">
            <button
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-1 rounded hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-semibold text-slate-200">
              {monthName}
            </span>
            <button
              onClick={handleNextMonth}
              title="Next Month"
              className="p-1 rounded hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {activeMonthKey !== currentCalendarMonth && (
              <button
                onClick={() => setActiveMonthKey(currentCalendarMonth)}
                className="ml-1 px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
              >
                Current Month
              </button>
            )}

            {onNavigateToReports && (
              <button
                onClick={onNavigateToReports}
                className="ml-1.5 px-2.5 py-1 text-[11px] font-semibold rounded bg-blue-600/90 hover:bg-blue-600 text-white transition-colors flex items-center gap-1 cursor-pointer"
                title="View full reports, charts and export records"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reports &amp; Analytics</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 Core Financial Metric Cards requested by user */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3.5">
          {/* 1. Total Revenue */}
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Total Revenue</span>
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
                ₹{monthFinancials.totalRevenue.toLocaleString('en-IN')}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                <span>{monthFinancials.fixedAmountCount} Fixed Bookings</span>
                {monthFinancials.afterVisitCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-medium border border-amber-500/30">
                    +{monthFinancials.afterVisitCount} After Visit
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2. Total Collected / Received */}
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Total Collected / Received</span>
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                <Wallet className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-blue-400 tracking-tight">
                ₹{monthFinancials.totalCollected.toLocaleString('en-IN')}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                <span>Total Collected</span>
                <span className="text-blue-300 font-bold">{monthFinancials.collectionRate}%</span>
              </div>
              <div className="w-full bg-slate-700/80 h-1.5 rounded-full overflow-hidden mt-1.5">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, monthFinancials.collectionRate)}%` }}
                />
              </div>
            </div>
          </div>

          {/* 3. Total Balance Due */}
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Total Balance Due</span>
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <CreditCard className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">
                ₹{monthFinancials.totalBalance.toLocaleString('en-IN')}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  {monthFinancials.pendingBalanceCount > 0
                    ? `${monthFinancials.pendingBalanceCount} Pending Collection`
                    : 'All Cleared'}
                </span>
                {monthFinancials.fullyPaidCount > 0 && (
                  <span className="text-emerald-400 font-medium text-[10px]">
                    {monthFinancials.fullyPaidCount} Fully Paid
                  </span>
                )}
              </div>
              <div className="w-full bg-slate-700/80 h-1.5 rounded-full overflow-hidden mt-1.5">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      monthFinancials.totalRevenue > 0
                        ? Math.min(100, Math.round((monthFinancials.totalBalance / monthFinancials.totalRevenue) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Date Navigation & Daily Slot Operations */}
      <div className="bg-white rounded-xl shadow-2xs border border-slate-200 p-4">
        {/* Date Navigation Bar - Clean, Native-Mobile, No Horizontal Overflow */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 w-full">
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 flex-1 sm:flex-none justify-between sm:justify-start">
              <button
                type="button"
                onClick={handlePrevDay}
                title="Previous Day"
                className="p-1.5 rounded hover:bg-white text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-2 sm:px-3 flex items-center gap-1.5 sm:gap-2 text-slate-900 font-bold text-xs sm:text-base text-center">
                <CalendarIcon className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{formattedDate}</span>
              </div>
              <button
                type="button"
                onClick={handleNextDay}
                title="Next Day"
                className="p-1.5 rounded hover:bg-white text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {normalizeDateString(selectedDate) !== getLocalDateString() && (
              <button
                type="button"
                onClick={handleSetToday}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors shrink-0 cursor-pointer"
              >
                Today
              </button>
            )}
          </div>

          {/* Quick Summary Pill Badges */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
              {availableSlotsCount} of 10 Slots Available
            </span>
            {unassigned > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 font-medium border border-amber-200">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {unassigned} Unassigned Staff
              </span>
            )}
          </div>
        </div>

        {/* Metrics Row for Selected Day (Mathematically Reconciled Active Workload) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 pt-3">
          {/* 1. Active Day's Bookings */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
            <div className="text-xs font-medium text-slate-500">Day's Bookings</div>
            <div className="text-2xl font-extrabold text-slate-800 mt-1">{activeTotal}</div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
              {cancelled > 0 ? `${activeTotal} active (${cancelled} cancelled)` : `On ${selectedDate}`}
            </div>
          </div>

          {/* 2. Confirmed */}
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-lg p-3">
            <div className="text-xs font-medium text-blue-700 flex items-center justify-between">
              <span>Confirmed</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-2xl font-extrabold text-blue-900 mt-1">{confirmed}</div>
            <div className="text-[11px] text-blue-600/80 mt-0.5">Ready for service</div>
          </div>

          {/* 3. Pending / New */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3">
            <div className="text-xs font-medium text-amber-700 flex items-center justify-between">
              <span>Pending / New</span>
              <Clock className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-2xl font-extrabold text-amber-900 mt-1">{pending}</div>
            <div className="text-[11px] text-amber-700/80 mt-0.5">Awaiting review</div>
          </div>

          {/* 4. Staff Assigned */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-3">
            <div className="text-xs font-medium text-emerald-700 flex items-center justify-between">
              <span>Staff Assigned</span>
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-900 mt-1">{staffAssigned}</div>
            <div className="text-[11px] text-emerald-700/80 mt-0.5">
              {unassigned > 0 ? `${unassigned} unassigned` : 'All allocated'}
            </div>
          </div>

          {/* 5. Completed / Done */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
            <div className="text-xs font-medium text-slate-600 flex items-center justify-between">
              <span>Completed / Done</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-2xl font-extrabold text-slate-700 mt-1">{completed}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Service delivered</div>
          </div>

          {/* 6. Cancelled - Dedicated KPI Card as Requested */}
          <div className="bg-rose-50/70 border border-rose-200/80 rounded-lg p-3">
            <div className="text-xs font-medium text-rose-700 flex items-center justify-between">
              <span>Cancelled</span>
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="text-2xl font-extrabold text-rose-900 mt-1">{cancelled}</div>
            <div className="text-[11px] text-rose-600/80 mt-0.5">Excluded from workload</div>
          </div>
        </div>

        {/* Visual Daily Schedule Ribbon (Slots 1-10) */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Daily Slot Ribbon (10 Slots)
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                ({busySlotsCount} Booked &bull; {availableSlotsCount} Available)
              </span>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Click empty slot to book &bull; Click occupied slot to view
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5">
            {allSlots.map((slot) => {
              const primaryBooking = slotMapping.get(slot.slotNumber);
              const isBooked = !!primaryBooking;

              return (
                <div
                  key={slot.id || slot.slotNumber}
                  onClick={() => {
                    if (isBooked && onSlotClick) {
                      onSlotClick(slot.slotNumber, primaryBooking);
                    } else if (!isBooked) {
                      handleSlotAction(slot.slotNumber);
                    }
                  }}
                  className={`p-2 rounded-lg text-left transition-all border text-xs relative ${
                    isBooked
                      ? 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-2xs cursor-pointer hover:bg-amber-100/90 ring-1 ring-amber-200/50'
                      : 'bg-emerald-50/50 hover:bg-emerald-100/70 border-emerald-200/70 text-emerald-800 hover:border-emerald-300 cursor-pointer'
                  }`}
                  title={
                    isBooked
                      ? `Slot ${slot.slotNumber}: Occupied by ${primaryBooking.customerName || 'Customer'} (${primaryBooking.serviceType || 'Service'}) - Click to view booking`
                      : `Slot ${slot.slotNumber}: Available (Click to book)`
                  }
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>Slot {slot.slotNumber}</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isBooked ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5 font-normal">
                    {slot.period}
                  </div>
                  <div className="mt-1 font-medium">
                    {isBooked ? (
                      <div>
                        <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900 uppercase tracking-tight">
                          Occupied
                        </span>
                        <span className="text-amber-950 font-bold truncate block text-[11px] mt-1">
                          {primaryBooking.customerName ? primaryBooking.customerName.split(' ')[0] : 'Booked'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                        + Book
                      </span>
                    )}
                  </div>
                  {isBooked && (
                    <div className="text-[9px] text-amber-800/90 truncate font-medium mt-0.5">
                      {primaryBooking.assignedStaffNames?.[0]
                        ? primaryBooking.assignedStaffNames[0].replace(/^Mr\.\s*/, '')
                        : primaryBooking.serviceType || 'Assigned'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

