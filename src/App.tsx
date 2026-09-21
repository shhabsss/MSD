import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { AllBookingsView } from './components/AllBookingsView';
import { BookingDetailModal } from './components/BookingDetailModal';
import { BookingFormModal } from './components/BookingFormModal';
import { BookingMessageModal } from './components/BookingMessageModal';
import { CompleteServiceModal } from './components/CompleteServiceModal';
import { CalendarView } from './components/CalendarView';
import { DailyBookingBoard } from './components/DailyBookingBoard';
import { DashboardStats } from './components/DashboardStats';
import { GoogleSheetSyncView } from './components/GoogleSheetSyncView';
import { Navbar } from './components/Navbar';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { SidebarDrawer } from './components/SidebarDrawer';
import { StaffScheduleView } from './components/StaffScheduleView';
import { getLocalDateString, isSameDay, normalizeDateString } from './utils/dateUtils';
import { INITIAL_HISTORICAL_BOOKINGS } from './data/initialData';
import {
  clearAllBookings,
  generateNextBookingRef,
  loadBookings,
  loadCompanyInfo,
  loadCustomers,
  loadSettings,
  loadSlots,
  loadStaff,
  pushBookingToCloud,
  saveBookings,
  normalizeBookingRecords,
  saveCompanyInfo,
  saveCustomers,
  saveSettings,
  saveSlots,
  saveStaff,
  syncAllWithGoogleSheets,
  upsertCustomerFromBooking,
} from './services/storageService';
import {
  AppSettings,
  Booking,
  BookingStatus,
  CompanyInfo,
  Customer,
  PaymentStatus,
  SlotDefinition,
  StaffMember,
  SyncStatus,
} from './types';

export default function App() {
  // Core application state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [slots, setSlots] = useState<SlotDefinition[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(loadCompanyInfo());
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => loadSettings().lastSyncedAt || '');

  // Navigation & View state
  const [currentTab, setCurrentTab] = useState<
    'board' | 'all-bookings' | 'calendar' | 'staff-schedule' | 'reports' | 'google-sheets' | 'settings'
  >('board');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Selected date for daily board & staff view (defaults to today in local calendar date)
  const [selectedDate, setSelectedDate] = useState<string>(
    () => getLocalDateString()
  );
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);
  const [defaultSlotForNew, setDefaultSlotForNew] = useState<number>(1);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedBookingForDetail, setSelectedBookingForDetail] = useState<Booking | null>(null);

  // Complete Service & Generate Invoice state
  const [completeServiceBooking, setCompleteServiceBooking] = useState<Booking | null>(null);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Automatic Booking Message Workflow state
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [selectedBookingForMessages, setSelectedBookingForMessages] = useState<Booking | null>(null);
  const [isDetailsChangedNotice, setIsDetailsChangedNotice] = useState(false);
  const [googleSheetSyncNotice, setGoogleSheetSyncNotice] = useState<{
    success: boolean;
    message: string;
    remoteSaved?: boolean;
  } | null>(null);

  // Initialize data on mount
  useEffect(() => {
    // Purge legacy storage keys to guarantee a clean fresh start as requested
    try {
      localStorage.removeItem('msd_bookings_v2');
      localStorage.removeItem('msd_bookings');
    } catch (_) {}

    const loadedBookings = normalizeBookingRecords(loadBookings());
    setBookings(loadedBookings);
    saveBookings(loadedBookings);

    const loadedCustomers = loadCustomers(loadedBookings);
    setCustomers(loadedCustomers);

    const loadedStaff = loadStaff();
    setStaffList(loadedStaff);

    const loadedSlots = loadSlots();
    setSlots(loadedSlots);

    const loadedCompany = loadCompanyInfo();
    setCompanyInfo(loadedCompany);

    const loadedSettings = loadSettings();
    setSettings(loadedSettings);

    // Immediately fetch and sync data from Google Sheets on initial startup
    if (loadedSettings.googleSheetWebAppUrl && navigator.onLine) {
      setSyncStatus('syncing');
      syncAllWithGoogleSheets({
        webAppUrl: loadedSettings.googleSheetWebAppUrl,
        localBookings: loadedBookings,
        localCustomers: loadedCustomers,
      })
        .then((result) => {
          if (result.success) {
            if (result.mergedBookings && result.mergedBookings.length > 0) {
              const normalized = normalizeBookingRecords(result.mergedBookings);
              setBookings(normalized);
              saveBookings(normalized);
            }
            if (result.mergedCustomers && result.mergedCustomers.length > 0) {
              setCustomers(result.mergedCustomers);
              saveCustomers(result.mergedCustomers);
            }
            setSyncStatus('synced');
            setLastSyncTime(new Date().toISOString());
          } else {
            setSyncStatus('synced');
          }
        })
        .catch(() => {
          setSyncStatus('synced');
        });
    }
  }, []);

  // Central Cloud Multi-Device Synchronization
  const triggerCloudSync = async (silent: boolean = false) => {
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    if (!settings.googleSheetWebAppUrl) {
      if (!silent) setSyncStatus('synced');
      return;
    }

    setSyncStatus('syncing');
    try {
      const result = await syncAllWithGoogleSheets({
        webAppUrl: settings.googleSheetWebAppUrl,
        localBookings: bookings,
        localCustomers: customers,
      });

      if (result.success) {
        if (result.mergedBookings) {
          setBookings(result.mergedBookings);
          saveBookings(result.mergedBookings);
        }
        if (result.mergedCustomers) {
          setCustomers(result.mergedCustomers);
          saveCustomers(result.mergedCustomers);
        }
        setSyncStatus('synced');
        const now = new Date().toISOString();
        setLastSyncTime(now);
      } else {
        setSyncStatus('error');
      }
    } catch {
      setSyncStatus('error');
    }
  };

  // Auto-sync periodically and on window focus/network reconnect
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus('syncing');
      triggerCloudSync(true);
    };

    const handleOffline = () => {
      setSyncStatus('offline');
    };

    const handleFocus = () => {
      if (settings.googleSheetWebAppUrl) {
        triggerCloudSync(true);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);

    // Periodic auto-sync interval
    const intervalSec = (settings.syncIntervalSeconds || 30) * 1000;
    const intervalId = setInterval(() => {
      if (settings.autoSyncEnabled !== false && settings.googleSheetWebAppUrl) {
        triggerCloudSync(true);
      }
    }, intervalSec);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
      clearInterval(intervalId);
    };
  }, [settings.googleSheetWebAppUrl, settings.autoSyncEnabled, settings.syncIntervalSeconds, bookings, customers]);

  // Filter bookings for the selected date
  const bookingsForSelectedDate = useMemo(() => {
    return bookings.filter((b) => isSameDay(b.scheduleDate || b.bookingDate, selectedDate));
  }, [bookings, selectedDate]);

  // Suggested next booking reference
  const suggestedNextRef = useMemo(() => {
    return generateNextBookingRef(bookings);
  }, [bookings]);

  // Handler: Create or Update Booking with Automated Messaging & Multi-Device Sync
  const handleSaveBooking = async (booking: Booking, isDetailsChanged?: boolean) => {
    const isCancelledOrPostponed =
      booking.bookingStatus === 'Cancelled' ||
      (booking.bookingStatus as string) === 'Postponed' ||
      booking.bookingStatus === 'Rescheduled';

    if (!isCancelledOrPostponed) {
      const hasStaff =
        (booking.assignedStaffIds && booking.assignedStaffIds.length > 0) ||
        (booking.assignedStaffNames && booking.assignedStaffNames.length > 0);

      if (!hasStaff) {
        alert('Please assign a staff member before confirming the booking.');
        return;
      }
    }

    const exists = bookings.some((b) => b.id === booking.id);
    let updated: Booking[];

    if (exists) {
      updated = bookings.map((b) => (b.id === booking.id ? booking : b));
    } else {
      updated = [booking, ...bookings];
    }

    setBookings(updated);
    saveBookings(updated);
    setIsFormModalOpen(false);
    setBookingToEdit(null);

    // Automatically update customer profile in customer database
    const { updatedCustomers } = upsertCustomerFromBooking(customers, booking);
    setCustomers(updatedCustomers);
    saveCustomers(updatedCustomers);

    // If detail modal is open for this booking, update it too
    if (selectedBookingForDetail && selectedBookingForDetail.id === booking.id) {
      setSelectedBookingForDetail(booking);
    }

    // Step 7: Push booking to cloud database immediately for real-time multi-device sync
    setSyncStatus('syncing');
    const cloudPush = await pushBookingToCloud(
      booking,
      exists ? 'UPDATE' : 'CREATE',
      settings.googleSheetWebAppUrl
    );
    if (cloudPush.success) {
      setSyncStatus('synced');
      setLastSyncTime(new Date().toISOString());
    } else {
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
    }

    setGoogleSheetSyncNotice({
      success: cloudPush.success,
      remoteSaved: !cloudPush.queued,
      message: cloudPush.message,
    });

    // Step 8, 9, 10: Show the message status screen immediately after save
    setSelectedBookingForMessages(booking);
    setIsDetailsChangedNotice(Boolean(isDetailsChanged));
    setIsMessageModalOpen(true);
  };

  // Handler: Open Message Modal for any existing booking
  const handleOpenMessageModal = (booking: Booking) => {
    setSelectedBookingForMessages(booking);
    setIsDetailsChangedNotice(false);
    setGoogleSheetSyncNotice(null);
    setIsMessageModalOpen(true);
  };

  // Handler: Update Booking statuses from Message Modal
  const handleUpdateBookingFromModal = (updatedBooking: Booking) => {
    const updated = bookings.map((b) => (b.id === updatedBooking.id ? updatedBooking : b));
    setBookings(updated);
    saveBookings(updated);
    setSelectedBookingForMessages(updatedBooking);
    if (selectedBookingForDetail && selectedBookingForDetail.id === updatedBooking.id) {
      setSelectedBookingForDetail(updatedBooking);
    }
  };

  // Handler: Delete Booking
  const handleDeleteBooking = async (id: string, ref: string) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete booking ${ref}?\nThis cannot be undone.`
    );
    if (!confirmDelete) return;

    const targetBooking = bookings.find((b) => b.id === id);
    const updated = bookings.filter((b) => b.id !== id);
    setBookings(updated);
    saveBookings(updated);

    if (selectedBookingForDetail && selectedBookingForDetail.id === id) {
      setIsDetailModalOpen(false);
      setSelectedBookingForDetail(null);
    }

    if (targetBooking && settings.googleSheetWebAppUrl) {
      setSyncStatus('syncing');
      await pushBookingToCloud(
        { ...targetBooking, bookingStatus: 'Cancelled' },
        'CANCEL',
        settings.googleSheetWebAppUrl
      );
      setSyncStatus('synced');
    }
  };

  // Handler: Duplicate Booking
  const handleDuplicateBooking = (booking: Booking) => {
    const duplicated: Booking = {
      ...booking,
      id: `b-${Date.now()}`,
      bookingRef: generateNextBookingRef(bookings),
      bookingDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      bookingStatus: 'New',
    };
    setBookingToEdit(duplicated);
    setIsFormModalOpen(true);
  };

  // Handler: Open Complete Service & Generate Invoice Modal
  const handleOpenCompleteModal = (booking: Booking) => {
    setCompleteServiceBooking(booking);
    setIsCompleteModalOpen(true);
  };

  // Handler: Save Completed Service with Add-ons, Discount & Final Total
  const handleSaveCompletedService = async (completedBooking: Booking) => {
    const updated = bookings.map((b) => (b.id === completedBooking.id ? completedBooking : b));
    setBookings(updated);
    saveBookings(updated);

    // Sync updated customer profile in customer database
    const { updatedCustomers } = upsertCustomerFromBooking(customers, completedBooking);
    setCustomers(updatedCustomers);
    saveCustomers(updatedCustomers);

    // If detail modal is open for this booking, update it too
    if (selectedBookingForDetail && selectedBookingForDetail.id === completedBooking.id) {
      setSelectedBookingForDetail(completedBooking);
    }

    // Show visual toast notification
    setToastMessage('Service completed & bill saved successfully!');
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);

    // Push to Google Sheets if configured
    if (settings.googleSheetWebAppUrl) {
      setSyncStatus('syncing');
      const cloudPush = await pushBookingToCloud(
        completedBooking,
        'UPDATE',
        settings.googleSheetWebAppUrl
      );
      if (cloudPush.success) {
        setSyncStatus('synced');
        setLastSyncTime(new Date().toISOString());
      } else {
        setSyncStatus(navigator.onLine ? 'error' : 'offline');
      }
    }
  };

  // Handler: Quick Status Change from Board/Table
  const handleQuickStatusChange = async (bookingId: string, newStatus: BookingStatus) => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return;

    const cleanAmt =
      typeof target.amount === 'number'
        ? target.amount
        : parseFloat(String(target.amount).replace(/[^\d.]/g, '')) || 0;

    // Direct change to 'Completed':
    if (newStatus === 'Completed') {
      // If amount is 0 (such as an unfinalised After-Visit booking), prevent direct completion and force open modal
      if (cleanAmt <= 0) {
        handleOpenCompleteModal(target);
        return;
      }

      // If the booking already has a valid amount (> ₹0), automatically set paymentStatus to 'Paid' and balanceAmount = 0
      const updatedBooking: Booking = {
        ...target,
        bookingStatus: 'Completed',
        paymentStatus: 'Paid',
        balanceAmount: 0,
        finalCollectedAmount: target.finalCollectedAmount || cleanAmt,
        advanceAmount: target.advanceAmount || cleanAmt,
        completedAt: target.completedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updated = bookings.map((b) => (b.id === bookingId ? updatedBooking : b));
      setBookings(updated);
      saveBookings(updated);

      const { updatedCustomers } = upsertCustomerFromBooking(customers, updatedBooking);
      setCustomers(updatedCustomers);
      saveCustomers(updatedCustomers);

      if (settings.googleSheetWebAppUrl) {
        pushBookingToCloud(updatedBooking, 'UPDATE', settings.googleSheetWebAppUrl);
      }

      if (selectedBookingForDetail && selectedBookingForDetail.id === bookingId) {
        setSelectedBookingForDetail(updatedBooking);
      }

      setToastMessage('Booking marked Completed and Payment Status set to Paid.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    // Direct change to 'Cancelled':
    if (newStatus === 'Cancelled') {
      const updatedBooking: Booking = {
        ...target,
        bookingStatus: 'Cancelled',
        paymentStatus: 'Cancelled',
        balanceAmount: 0,
        updatedAt: new Date().toISOString(),
      };

      const updated = bookings.map((b) => (b.id === bookingId ? updatedBooking : b));
      setBookings(updated);
      saveBookings(updated);

      const { updatedCustomers } = upsertCustomerFromBooking(customers, updatedBooking);
      setCustomers(updatedCustomers);
      saveCustomers(updatedCustomers);

      if (settings.googleSheetWebAppUrl) {
        pushBookingToCloud(updatedBooking, 'CANCEL', settings.googleSheetWebAppUrl);
      }

      if (selectedBookingForDetail && selectedBookingForDetail.id === bookingId) {
        setSelectedBookingForDetail(updatedBooking);
      }

      setToastMessage('Booking marked Cancelled and Payment Status set to Cancelled.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    const hasStaff =
      (target?.assignedStaffIds && target.assignedStaffIds.length > 0) ||
      (target?.assignedStaffNames && target.assignedStaffNames.length > 0);

    if ((newStatus === 'Confirmed' || newStatus === 'Staff Assigned') && !hasStaff) {
      alert('Please assign a staff member before confirming the booking.');
      return;
    }

    const updatedBooking: Booking = {
      ...target,
      bookingStatus: newStatus,
      updatedAt: new Date().toISOString(),
    };

    const updated = bookings.map((b) => (b.id === bookingId ? updatedBooking : b));
    setBookings(updated);
    saveBookings(updated);

    if (settings.googleSheetWebAppUrl) {
      pushBookingToCloud(updatedBooking, 'UPDATE', settings.googleSheetWebAppUrl);
    }

    if (selectedBookingForDetail && selectedBookingForDetail.id === bookingId) {
      setSelectedBookingForDetail(updatedBooking);
    }
  };

  // Handler: Manual Payment Status Change from Table/Modal Dropdown
  const handlePaymentStatusChange = async (bookingId: string, newPaymentStatus: PaymentStatus) => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return;

    const cleanAmt =
      typeof target.amount === 'number'
        ? target.amount
        : parseFloat(String(target.amount).replace(/[^\d.]/g, '')) || 0;

    let balanceAmount = target.balanceAmount;
    let finalCollectedAmount = target.finalCollectedAmount;
    let advanceAmount = target.advanceAmount;

    if (newPaymentStatus === 'Paid' || newPaymentStatus === 'Fully Paid') {
      balanceAmount = 0;
      finalCollectedAmount = target.finalCollectedAmount || cleanAmt;
      advanceAmount = target.advanceAmount || cleanAmt;
    } else if (newPaymentStatus === 'Cancelled') {
      balanceAmount = 0;
    } else if (newPaymentStatus === 'Pending' || newPaymentStatus === 'Not Paid') {
      balanceAmount = cleanAmt;
      finalCollectedAmount = 0;
      advanceAmount = 0;
    }

    const updatedBooking: Booking = {
      ...target,
      paymentStatus: newPaymentStatus,
      balanceAmount,
      finalCollectedAmount,
      advanceAmount,
      updatedAt: new Date().toISOString(),
    };

    const updated = bookings.map((b) => (b.id === bookingId ? updatedBooking : b));
    setBookings(updated);
    saveBookings(updated);

    const { updatedCustomers } = upsertCustomerFromBooking(customers, updatedBooking);
    setCustomers(updatedCustomers);
    saveCustomers(updatedCustomers);

    if (settings.googleSheetWebAppUrl) {
      pushBookingToCloud(updatedBooking, 'UPDATE', settings.googleSheetWebAppUrl);
    }

    if (selectedBookingForDetail && selectedBookingForDetail.id === bookingId) {
      setSelectedBookingForDetail(updatedBooking);
    }

    setToastMessage(`Payment status updated to "${newPaymentStatus}"`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Handler: Assign Staff from Board Table
  const handleAssignStaff = (bookingId: string, staffIds: string[]) => {
    const assignedStaffMembers = staffIds
      .map((id) => staffList.find((s) => s.id === id))
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

    const updated = bookings.map((b) =>
      b.id === bookingId
        ? {
            ...b,
            assignedStaffIds: staffIds,
            assignedStaffNames: assignedNames,
            staffMobile: staffMobileStr,
            bookingStatus:
              b.bookingStatus === 'New' || b.bookingStatus === 'Pending'
                ? ('Staff Assigned' as BookingStatus)
                : b.bookingStatus,
            updatedAt: new Date().toISOString(),
          }
        : b
    );
    setBookings(updated);
    saveBookings(updated);

    const changedBooking = updated.find((b) => b.id === bookingId);
    if (changedBooking && settings.googleSheetWebAppUrl) {
      pushBookingToCloud(changedBooking, 'UPDATE', settings.googleSheetWebAppUrl);
    }

    if (selectedBookingForDetail && selectedBookingForDetail.id === bookingId) {
      setSelectedBookingForDetail((prev) =>
        prev
          ? {
              ...prev,
              assignedStaffIds: staffIds,
              assignedStaffNames: assignedNames,
              staffMobile: staffMobileStr,
              bookingStatus:
                prev.bookingStatus === 'New' || prev.bookingStatus === 'Pending'
                  ? ('Staff Assigned' as BookingStatus)
                  : prev.bookingStatus,
              updatedAt: new Date().toISOString(),
            }
          : null
      );
    }
  };

  // Handler: Slot Click (from Board ribbon or Slot column)
  const handleSlotClick = (slotNumber: number, existingBooking?: Booking) => {
    if (existingBooking) {
      setSelectedBookingForDetail(existingBooking);
      setIsDetailModalOpen(true);
    } else {
      setBookingToEdit(null);
      setDefaultSlotForNew(slotNumber);
      setIsFormModalOpen(true);
    }
  };

  // Handler: New Booking from top navbar or buttons
  const handleOpenNewBooking = () => {
    setBookingToEdit(null);
    setDefaultSlotForNew(1);
    setIsFormModalOpen(true);
  };

  // Handler: Open Detail View
  const handleViewBooking = (booking: Booking) => {
    setSelectedBookingForDetail(booking);
    setIsDetailModalOpen(true);
  };

  // Handler: Open Edit Modal
  const handleEditBooking = (booking: Booking) => {
    setBookingToEdit(booking);
    setIsFormModalOpen(true);
  };

  // Handler: New booking for a specific date (from Calendar)
  const handleNewBookingForDate = (date: string) => {
    setSelectedDate(date);
    setBookingToEdit(null);
    setDefaultSlotForNew(1);
    setIsFormModalOpen(true);
  };

  // Reset database back to seed records if desired
  const handleResetToSeedData = () => {
    if (
      window.confirm(
        'Reset database to the initial 22 historical bookings from MSD Facility Services?'
      )
    ) {
      setBookings(INITIAL_HISTORICAL_BOOKINGS);
      saveBookings(INITIAL_HISTORICAL_BOOKINGS);
    }
  };

  // Handler: Delete all bookings to start completely fresh
  const handleClearAllBookings = () => {
    if (
      window.confirm(
        'Are you sure you want to delete ALL bookings?\n\nThis will permanently delete all booking records from the schedule so you can start completely fresh. This cannot be undone.'
      )
    ) {
      setBookings([]);
      saveBookings([]);
      clearAllBookings();
      setSelectedBookingForDetail(null);
      setSelectedBookingForMessages(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 antialiased selection:bg-blue-600 selection:text-white w-full max-w-[100vw] overflow-x-hidden">
      {/* Top Main Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onNewBooking={handleOpenNewBooking}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        companyInfo={companyInfo}
        totalBookingsCount={bookings.length}
        isDrawerOpen={isDrawerOpen}
        onToggleDrawer={() => setIsDrawerOpen((prev) => !prev)}
        toggleDrawer={() => setIsDrawerOpen((prev) => !prev)}
        syncStatus={syncStatus}
        onTriggerSync={() => triggerCloudSync(false)}
        lastSyncTime={lastSyncTime}
      />

      {/* Mobile Navigation Drawer */}
      <SidebarDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onNewBooking={handleOpenNewBooking}
        companyInfo={companyInfo}
        totalBookingsCount={bookings.length}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 space-y-4 overflow-x-hidden">
        {/* View 1: Daily Booking Board (The primary Google Sheet style board) */}
        {currentTab === 'board' && (
          <div className="space-y-4">
            {/* Dashboard metrics and visual slot ribbon */}
            <DashboardStats
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              bookingsForDate={bookingsForSelectedDate}
              allBookings={bookings}
              allSlots={slots}
              onSlotClick={handleSlotClick}
              onNewBooking={handleOpenNewBooking}
              onNavigateToReports={() => setCurrentTab('reports')}
            />

            {/* Daily Excel Spreadsheet Booking Board */}
            <DailyBookingBoard
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              bookings={bookings}
              allSlots={slots}
              allStaff={staffList}
              onViewBooking={handleViewBooking}
              onEditBooking={handleEditBooking}
              onDuplicateBooking={handleDuplicateBooking}
              onDeleteBooking={handleDeleteBooking}
              onQuickStatusChange={handleQuickStatusChange}
              onPaymentStatusChange={handlePaymentStatusChange}
              onAssignStaff={handleAssignStaff}
              onSlotClick={handleSlotClick}
              onNewBooking={handleOpenNewBooking}
              onOpenMessageModal={handleOpenMessageModal}
              onOpenCompleteModal={handleOpenCompleteModal}
            />
          </div>
        )}

        {/* View 2: All Bookings (Search & Multi-Filters) */}
        {currentTab === 'all-bookings' && (
          <AllBookingsView
            bookings={bookings}
            allStaff={staffList}
            onViewBooking={handleViewBooking}
            onEditBooking={handleEditBooking}
            onDuplicateBooking={handleDuplicateBooking}
            onDeleteBooking={handleDeleteBooking}
            onQuickStatusChange={handleQuickStatusChange}
            onPaymentStatusChange={handlePaymentStatusChange}
            onNewBooking={handleOpenNewBooking}
            onOpenMessageModal={handleOpenMessageModal}
            onOpenCompleteModal={handleOpenCompleteModal}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        )}

        {/* View 3: Calendar View */}
        {currentTab === 'calendar' && (
          <CalendarView
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            allBookings={bookings}
            allStaff={staffList}
            onViewBooking={handleViewBooking}
            onEditBooking={handleEditBooking}
            onNewBookingForDate={handleNewBookingForDate}
          />
        )}

        {/* View 4: Staff Schedule & Workload */}
        {currentTab === 'staff-schedule' && (
          <StaffScheduleView
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            allStaff={staffList}
            allSlots={slots}
            allBookings={bookings}
            onViewBooking={handleViewBooking}
            onEditBooking={handleEditBooking}
            settings={settings}
          />
        )}

        {/* View 5: Reports & Analytics */}
        {currentTab === 'reports' && (
          <ReportsView
            bookings={bookings}
            allStaff={staffList}
            companyInfo={companyInfo}
            onViewBooking={handleViewBooking}
            onEditBooking={handleEditBooking}
          />
        )}

        {/* View 6: Google Sheet Central Database & Sync */}
        {currentTab === 'google-sheets' && (
          <GoogleSheetSyncView
            bookings={bookings}
            setBookings={(newBookings) => {
              setBookings(newBookings);
              saveBookings(newBookings);
            }}
            customers={customers}
            setCustomers={(newCustomers) => {
              setCustomers(newCustomers);
              saveCustomers(newCustomers);
            }}
            allStaff={staffList}
            settings={settings}
            onSaveSettings={(newSettings) => {
              setSettings(newSettings);
              saveSettings(newSettings);
            }}
            globalSyncStatus={syncStatus}
            onTriggerGlobalSync={() => triggerCloudSync(false)}
            lastSyncTime={lastSyncTime}
          />
        )}

        {/* View 6: Settings */}
        {currentTab === 'settings' && (
          <SettingsView
            companyInfo={companyInfo}
            onSaveCompanyInfo={(newInfo) => {
              setCompanyInfo(newInfo);
              saveCompanyInfo(newInfo);
            }}
            staffList={staffList}
            onSaveStaffList={(newList) => {
              setStaffList(newList);
              saveStaff(newList);
            }}
            slots={slots}
            onSaveSlots={(newSlots) => {
              setSlots(newSlots);
              saveSlots(newSlots);
            }}
            settings={settings}
            onSaveSettings={(newSettings) => {
              setSettings(newSettings);
              saveSettings(newSettings);
            }}
            totalBookingsCount={bookings.length}
            allBookings={bookings}
            onClearAllBookings={handleClearAllBookings}
            onResetToSampleData={handleResetToSeedData}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-4 px-4 sm:px-6 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="font-bold text-slate-200">{companyInfo.name}</span> &bull;{' '}
            <span>{companyInfo.address}</span> &bull;{' '}
            <span>Mobile: {companyInfo.mobile}</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="text-slate-400">
              Database: <strong className="text-slate-200 font-semibold">{bookings.length}</strong> bookings recorded
            </span>
            <span>&bull;</span>
            <span className="text-emerald-400 font-medium">Google Sheet Synchronized</span>
          </div>
        </div>
      </footer>

      {/* Booking Create / Edit Modal */}
      <BookingFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setBookingToEdit(null);
        }}
        onSave={handleSaveBooking}
        bookingToEdit={bookingToEdit}
        defaultDate={selectedDate}
        defaultSlotNumber={defaultSlotForNew}
        allBookings={bookings}
        allCustomers={customers}
        allStaff={staffList}
        allSlots={slots}
        settings={settings}
        suggestedRef={suggestedNextRef}
      />

      {/* Booking Details & WhatsApp Modal */}
      <BookingDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedBookingForDetail(null);
        }}
        booking={selectedBookingForDetail}
        onEdit={(b) => {
          setIsDetailModalOpen(false);
          setBookingToEdit(b);
          setIsFormModalOpen(true);
        }}
        onStatusChange={handleQuickStatusChange}
        onPaymentStatusChange={handlePaymentStatusChange}
        onOpenMessageModal={handleOpenMessageModal}
        onOpenCompleteModal={handleOpenCompleteModal}
        companyInfo={companyInfo}
        allStaff={staffList}
        settings={settings}
      />

      {/* Complete Service & Generate Invoice Modal */}
      <CompleteServiceModal
        isOpen={isCompleteModalOpen}
        onClose={() => {
          setIsCompleteModalOpen(false);
          setCompleteServiceBooking(null);
        }}
        booking={completeServiceBooking}
        allStaff={staffList}
        companyInfo={companyInfo}
        onSave={handleSaveCompletedService}
        onSaveCompletedService={handleSaveCompletedService}
      />

      {/* Automatic WhatsApp Booking Message System Modal */}
      <BookingMessageModal
        isOpen={isMessageModalOpen}
        onClose={() => {
          setIsMessageModalOpen(false);
          setSelectedBookingForMessages(null);
          setGoogleSheetSyncNotice(null);
        }}
        booking={selectedBookingForMessages}
        allStaff={staffList}
        companyInfo={companyInfo}
        settings={settings}
        onUpdateBooking={handleUpdateBookingFromModal}
        isDetailsChangedNotice={isDetailsChangedNotice}
        googleSheetSyncResult={googleSheetSyncNotice}
      />

      {/* Success Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 font-semibold text-xs sm:text-sm animate-in slide-in-from-bottom-5 duration-200 border border-emerald-600">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 hover:bg-emerald-600 rounded p-1 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
