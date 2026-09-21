import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  History,
  MapPin,
  Phone,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  detectStaffConflicts,
  extractBookingSlotNumber,
  getCustomerHistory,
  getDeviceIdentifier,
  loadCustomers,
  normalizePhoneNumber,
  searchCustomers,
} from '../services/storageService';
import { isSameDay } from '../utils/dateUtils';
import { PONDICHERRY_LOCATIONS, WEBSITE_MSDFS_SERVICES } from '../data/initialData';
import {
  AppSettings,
  Booking,
  BookingStatus,
  ConflictWarning,
  Customer,
  PaymentStatus,
  SlotDefinition,
  SlotPeriod,
  StaffMember,
} from '../types';

interface BookingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (booking: Booking, isDetailsChanged?: boolean) => void;
  bookingToEdit: Booking | null;
  defaultDate: string;
  defaultSlotNumber?: number;
  allBookings?: Booking[];
  allStaff?: StaffMember[];
  allSlots?: SlotDefinition[];
  allCustomers?: Customer[];
  settings?: AppSettings;
  suggestedRef?: string;
}

export const BookingFormModal: React.FC<BookingFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  bookingToEdit,
  defaultDate,
  defaultSlotNumber = 1,
  allBookings = [],
  allStaff = [],
  allSlots = [],
  allCustomers = [],
  settings,
  suggestedRef = 'MSD-BK-001',
}) => {
  const serviceList = settings?.services && settings.services.length > 0 ? settings.services : [
    '1 Bathroom Cleaning',
    '2 Bathroom Cleaning',
    '3 Bathroom Cleaning',
    'Deep Kitchen Cleaning',
    'Full House Deep Cleaning',
    'Sofa Shampooing',
    'Water Tank Cleaning',
  ];
  const locationList = settings?.locations && settings.locations.length > 0 ? settings.locations : PONDICHERRY_LOCATIONS;
  // Form state
  const [bookingRef, setBookingRef] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerWhatsApp, setCustomerWhatsApp] = useState('');
  const [sameAsMobile, setSameAsMobile] = useState(true);

  // Customer Search & Auto-fill state
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isCustomerModified, setIsCustomerModified] = useState(false);

  // Customer database computation
  const customerList = useMemo(() => {
    if (allCustomers && allCustomers.length > 0) return allCustomers;
    return loadCustomers(allBookings);
  }, [allCustomers, allBookings]);

  // Live suggestions matching search query
  const customerSuggestions = useMemo(() => {
    if (!customerSearchQuery || customerSearchQuery.trim().length < 1) return [];
    return searchCustomers(customerSearchQuery, customerList).slice(0, 5);
  }, [customerSearchQuery, customerList]);

  // Customer past booking history
  const customerHistoryBookings = useMemo(() => {
    const mobileToUse = selectedCustomer ? selectedCustomer.mobile : customerMobile;
    if (!mobileToUse) return [];
    return getCustomerHistory(mobileToUse, allBookings);
  }, [selectedCustomer, customerMobile, allBookings]);

  // Real-time phone match auto-detection
  const detectedCustomerByMobile = useMemo(() => {
    const norm = normalizePhoneNumber(customerMobile);
    if (norm.length === 10 && (!selectedCustomer || selectedCustomer.mobile !== norm)) {
      return customerList.find((c) => c.mobile === norm) || null;
    }
    return null;
  }, [customerMobile, selectedCustomer, customerList]);

  const [serviceType, setServiceType] = useState('');
  const [customService, setCustomService] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');

  const [serviceLocation, setServiceLocation] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [fullAddress, setFullAddress] = useState('');

  const [slotNumber, setSlotNumber] = useState<number>(1);
  const [preferredTime, setPreferredTime] = useState('');

  const [quantity, setQuantity] = useState<number>(1);
  const [staffRequired, setStaffRequired] = useState<number>(1);
  const [assignedStaffIds, setAssignedStaffIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [amount, setAmount] = useState<string | number>('');
  const [isAfterVisitAmount, setIsAfterVisitAmount] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [balanceAmount, setBalanceAmount] = useState<number>(0);

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Pending');
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>('Confirmed');
  const [notes, setNotes] = useState('');

  // Conflict state
  const [conflicts, setConflicts] = useState<ConflictWarning[]>([]);
  const [slotOccupiedWarning, setSlotOccupiedWarning] = useState<Booking | null>(null);
  const [overrideConflict, setOverrideConflict] = useState(false);
  const [staffValidationError, setStaffValidationError] = useState<string | null>(null);
  const [slotValidationError, setSlotValidationError] = useState<string | null>(null);

  // Active bookings on the currently selected scheduleDate (excluding this booking if editing, and excluding cancelled)
  const activeBookingsOnDate = useMemo(() => {
    if (!scheduleDate) return [];
    return allBookings.filter((b) => {
      if (bookingToEdit && b.id === bookingToEdit.id) return false;
      if (b.bookingStatus === 'Cancelled') return false;
      const bDate = b.scheduleDate || b.bookingDate;
      return isSameDay(bDate, scheduleDate);
    });
  }, [scheduleDate, allBookings, bookingToEdit]);

  // Occupied slots map: slotNumber (1..10) -> Booking
  const occupiedSlotsMap = useMemo(() => {
    const map = new Map<number, Booking>();
    for (const b of activeBookingsOnDate) {
      const sNum = extractBookingSlotNumber(b);
      if (sNum && !map.has(sNum)) {
        map.set(sNum, b);
      }
    }
    return map;
  }, [activeBookingsOnDate]);

  // Busy staff map for the currently selected slot & date: staffId -> { booking, staffName }
  const busyStaffMap = useMemo(() => {
    const map = new Map<string, { booking: Booking; staffName: string }>();
    if (!scheduleDate || !slotNumber) return map;

    for (const b of activeBookingsOnDate) {
      const sNum = extractBookingSlotNumber(b);
      if (sNum === slotNumber) {
        if (b.assignedStaffIds && b.assignedStaffIds.length > 0) {
          for (const sId of b.assignedStaffIds) {
            const st = allStaff.find((s) => s.id === sId);
            map.set(sId, { booking: b, staffName: st?.name || sId });
          }
        }
        if (b.assignedStaffNames && b.assignedStaffNames.length > 0) {
          for (const sName of b.assignedStaffNames) {
            const cleanName = sName.replace(/^Mr\.\s*/i, '').trim().toLowerCase();
            const st = allStaff.find(
              (s) =>
                s.name.replace(/^Mr\.\s*/i, '').trim().toLowerCase() === cleanName ||
                s.id.toLowerCase() === cleanName
            );
            if (st && !map.has(st.id)) {
              map.set(st.id, { booking: b, staffName: st.name });
            }
          }
        }
      }
    }
    return map;
  }, [scheduleDate, slotNumber, activeBookingsOnDate, allStaff]);

  // Tracks whether the modal has been initialized for the current opening session
  const initializedSessionRef = useRef<string | null>(null);

  // Initialize form ONLY ONCE when modal opens or target booking changes
  useEffect(() => {
    if (!isOpen) {
      initializedSessionRef.current = null;
      return;
    }

    const currentSessionKey = bookingToEdit ? `edit_${bookingToEdit.id}` : 'new_booking_session';
    // If already initialized for this modal session, DO NOT re-initialize or wipe user inputs!
    if (initializedSessionRef.current === currentSessionKey) {
      return;
    }
    initializedSessionRef.current = currentSessionKey;

    if (bookingToEdit) {
      setBookingRef(bookingToEdit.bookingRef);
      setBookingDate(bookingToEdit.bookingDate || new Date().toISOString().split('T')[0]);
      setScheduleDate(bookingToEdit.scheduleDate || defaultDate);
      setCustomerName(bookingToEdit.customerName || '');
      setCustomerMobile(bookingToEdit.customerMobile || '');
      setCustomerWhatsApp(bookingToEdit.customerWhatsApp || bookingToEdit.customerMobile || '');
      setSameAsMobile(bookingToEdit.customerWhatsApp === bookingToEdit.customerMobile);

      // Try matching existing customer
      const norm = normalizePhoneNumber(bookingToEdit.customerMobile);
      const matchCust = customerList.find((c) => c.mobile === norm);
      setSelectedCustomer(matchCust || null);

      // Service
      const editService = (bookingToEdit.serviceType || bookingToEdit.serviceDetails || '').trim();
      if (serviceList.includes(editService)) {
        setServiceType(editService);
        setCustomService('');
      } else {
        setServiceType('Other');
        setCustomService(editService);
      }
      setServiceDescription(bookingToEdit.serviceDescription || '');

      // Location
      if (locationList.includes(bookingToEdit.serviceLocation)) {
        setServiceLocation(bookingToEdit.serviceLocation);
        setCustomLocation(bookingToEdit.customLocation || '');
      } else {
        setServiceLocation('Other');
        setCustomLocation(bookingToEdit.serviceLocation);
      }

      setFullAddress(bookingToEdit.fullAddress || '');
      setSlotNumber(bookingToEdit.slotNumber || 1);
      setPreferredTime(bookingToEdit.preferredTime || '');

      setStaffRequired(bookingToEdit.staffRequired || 1);
      setAssignedStaffIds(bookingToEdit.assignedStaffIds || []);
      setQuantity(bookingToEdit.quantity !== undefined && bookingToEdit.quantity > 0 ? bookingToEdit.quantity : 1);

      if (typeof bookingToEdit.amount === 'string' && isNaN(Number(bookingToEdit.amount))) {
        setIsAfterVisitAmount(true);
        setAmount('After Visit');
      } else {
        setIsAfterVisitAmount(false);
        setAmount(bookingToEdit.amount);
      }

      setAdvanceAmount(bookingToEdit.advanceAmount || 0);
      setBalanceAmount(bookingToEdit.balanceAmount || 0);
      setPaymentStatus(bookingToEdit.paymentStatus || 'Pending');
      setBookingStatus(bookingToEdit.bookingStatus || 'Confirmed');
      setNotes(bookingToEdit.notes || '');
    } else {
      // New booking initialization
      const today = new Date().toISOString().split('T')[0];
      setBookingRef(suggestedRef);
      setBookingDate(today);
      setScheduleDate(defaultDate || today);
      setCustomerName('');
      setCustomerMobile('');
      setCustomerWhatsApp('');
      setSameAsMobile(true);
      setSelectedCustomer(null);
      setServiceType(serviceList[0] || 'Bathroom Cleaning');
      setCustomService('');
      setServiceDescription('');
      setServiceLocation('Puducherry');
      setCustomLocation('');
      setFullAddress('');
      setSlotNumber(defaultSlotNumber || 1);
      setPreferredTime('');

      setStaffRequired(1);
      setAssignedStaffIds([]);
      setQuantity(1);
      setAmount('');
      setIsAfterVisitAmount(false);
      setAdvanceAmount(0);
      setBalanceAmount(0);
      setPaymentStatus('Pending');
      setBookingStatus('Confirmed');
      setNotes('');
    }

    setCustomerSearchQuery('');
    setShowSearchDropdown(false);
    setShowCustomerHistory(false);
    setIsCustomerModified(false);
    setIsSubmitting(false);
    setOverrideConflict(false);
  }, [isOpen, bookingToEdit, defaultDate, defaultSlotNumber, suggestedRef]);

  // Customer select handler - instantly populates fields without blocking
  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomer(cust);
    setCustomerName(cust.name || '');
    setCustomerMobile(cust.mobile || '');
    if (cust.alternateMobile) {
      setCustomerWhatsApp(cust.alternateMobile);
      setSameAsMobile(false);
    } else {
      setCustomerWhatsApp(cust.mobile || '');
      setSameAsMobile(true);
    }

    if (cust.location) {
      if (locationList.includes(cust.location)) {
        setServiceLocation(cust.location);
        setCustomLocation('');
      } else {
        setServiceLocation('Other');
        setCustomLocation(cust.location);
      }
    }

    if (cust.fullAddress) {
      setFullAddress(cust.fullAddress);
    }

    setCustomerSearchQuery('');
    setShowSearchDropdown(false);
    setIsCustomerModified(false);
  };

  const handleCreateNewCustomer = () => {
    setSelectedCustomer(null);
    setShowSearchDropdown(false);
    setShowCustomerHistory(false);
    setIsCustomerModified(false);
    const query = customerSearchQuery.trim();
    const digits = query.replace(/[^\d]/g, '');
    if (digits.length >= 10) {
      setCustomerMobile(digits);
      // Keep existing customerName if user already typed one!
    } else if (query.length > 0 && !customerName.trim()) {
      setCustomerName(query);
    }
    setCustomerSearchQuery('');
  };

  const handleApplyLastService = (serviceName?: string) => {
    if (!serviceName) return;
    if (serviceList.includes(serviceName)) {
      setServiceType(serviceName);
      setCustomService('');
    } else {
      setServiceType('Other');
      setCustomService(serviceName);
    }
  };

  // If the current slotNumber is occupied on this date, automatically switch to first available slot
  useEffect(() => {
    if (!isOpen) return;
    if (bookingStatus === 'Cancelled') return;
    if (occupiedSlotsMap.has(slotNumber)) {
      const freeSlot = allSlots.find((s) => !occupiedSlotsMap.has(s.slotNumber));
      if (freeSlot) {
        setSlotNumber(freeSlot.slotNumber);
        setSlotValidationError(null);
      }
    }
  }, [occupiedSlotsMap, slotNumber, allSlots, isOpen, bookingStatus]);

  // Deselect any staff member that is busy on the selected slot and date
  useEffect(() => {
    if (assignedStaffIds.length > 0 && busyStaffMap.size > 0) {
      const conflictingIds = assignedStaffIds.filter((id) => busyStaffMap.has(id));
      if (conflictingIds.length > 0) {
        setAssignedStaffIds((prev) => prev.filter((id) => !busyStaffMap.has(id)));
        const staffNames = conflictingIds
          .map((id) => busyStaffMap.get(id)?.staffName || id)
          .join(', ');
        setStaffValidationError(
          `Staff ${staffNames} is already assigned to this slot on this date and was removed from selection.`
        );
      }
    }
  }, [busyStaffMap]);

  // Handle slotNumber changes with occupied check
  const handleSlotChange = (newSlotNum: number) => {
    if (occupiedSlotsMap.has(newSlotNum)) {
      const errorMsg = `Slot ${newSlotNum} is already booked for this date. Please choose an available slot.`;
      setSlotValidationError(errorMsg);
      alert(errorMsg);
      return;
    }
    setSlotValidationError(null);
    setSlotNumber(newSlotNum);
  };

  // Sync WhatsApp number when sameAsMobile is checked
  useEffect(() => {
    if (sameAsMobile) {
      setCustomerWhatsApp(customerMobile);
    }
  }, [customerMobile, sameAsMobile]);

  // Auto calculate balance amount
  useEffect(() => {
    if (isAfterVisitAmount) {
      setBalanceAmount(0);
      return;
    }
    const numAmount = typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0;
    const numAdvance = advanceAmount || 0;
    const bal = Math.max(0, numAmount - numAdvance);
    setBalanceAmount(bal);

    // Auto-update payment status suggestion if appropriate
    if (numAmount > 0) {
      if (numAdvance >= numAmount) {
        setPaymentStatus('Fully Paid');
      } else if (numAdvance > 0) {
        setPaymentStatus('Advance Paid');
      }
    }
  }, [amount, advanceAmount, isAfterVisitAmount]);

  // Real-time Conflict Detection Check
  useEffect(() => {
    if (!scheduleDate || !slotNumber) return;

    // Check staff conflicts
    const foundConflicts = detectStaffConflicts(
      {
        scheduleDate,
        slotNumber,
        assignedStaffIds,
      },
      allBookings,
      allStaff,
      bookingToEdit?.id
    );
    setConflicts(foundConflicts);

    // Check if slot already has another active booking
    const slotExisting = allBookings.find(
      (b) =>
        b.id !== bookingToEdit?.id &&
        b.bookingStatus !== 'Cancelled' &&
        isSameDay(b.scheduleDate || b.bookingDate, scheduleDate) &&
        extractBookingSlotNumber(b) === slotNumber
    );
    setSlotOccupiedWarning(slotExisting || null);
  }, [scheduleDate, slotNumber, assignedStaffIds, allBookings, allStaff, bookingToEdit]);

  // Multi-staff toggle handlers with busy check
  const toggleStaff = (staffId: string) => {
    setStaffValidationError(null);
    if (busyStaffMap.has(staffId)) {
      const staffMember = allStaff.find((s) => s.id === staffId);
      const name = staffMember ? staffMember.name : staffId;
      const errorMsg = `Staff ${name} is already assigned to this slot on this date.`;
      setStaffValidationError(errorMsg);
      alert(errorMsg);
      return;
    }
    setAssignedStaffIds((prev) => {
      const exists = prev.includes(staffId);
      const next = exists ? prev.filter((id) => id !== staffId) : [...prev, staffId];
      setStaffRequired(Math.max(1, next.length));
      return next;
    });
  };

  const removeStaffChip = (staffId: string) => {
    setAssignedStaffIds((prev) => {
      const next = prev.filter((id) => id !== staffId);
      setStaffRequired(Math.max(1, next.length));
      return next;
    });
  };

  const selectAllStaff = () => {
    setStaffValidationError(null);
    const activeStaff = allStaff.filter((s) => s.status === 'active');
    const busyStaff = activeStaff.filter((s) => busyStaffMap.has(s.id));

    if (busyStaff.length > 0) {
      const busyNames = busyStaff.map((s) => s.name).join(', ');
      const errorMsg = `Staff ${busyNames} is already assigned to this slot on this date.`;
      setStaffValidationError(errorMsg);
      const availableIds = activeStaff.filter((s) => !busyStaffMap.has(s.id)).map((s) => s.id);
      setAssignedStaffIds(availableIds);
      setStaffRequired(Math.max(1, availableIds.length));
      alert(errorMsg);
      return;
    }

    const activeStaffIds = activeStaff.map((s) => s.id);
    setAssignedStaffIds(activeStaffIds);
    setStaffRequired(activeStaffIds.length);
  };

  const clearStaff = () => {
    setAssignedStaffIds([]);
    setStaffRequired(1);
  };

  if (!isOpen) return null;

  const currentSlotDef = allSlots.find((s) => s.slotNumber === slotNumber);
  const slotPeriod: SlotPeriod = currentSlotDef ? currentSlotDef.period : 'Morning';

  const isCancelledOrPostponed =
    bookingStatus === 'Cancelled' ||
    (bookingStatus as string) === 'Postponed' ||
    bookingStatus === 'Rescheduled';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Smart resolution of Customer Name and Mobile with multi-level fallbacks
    let effectiveName = customerName.trim();
    let effectiveMobile = customerMobile.trim();

    // Fallback 1: Use selected customer details if form field is empty
    if (!effectiveName && selectedCustomer?.name) {
      effectiveName = selectedCustomer.name.trim();
      setCustomerName(effectiveName);
    }
    // Fallback 2: If user entered text in customer search box
    if (!effectiveName && customerSearchQuery.trim()) {
      const q = customerSearchQuery.trim();
      if (!/^\d+$/.test(q)) {
        effectiveName = q;
        setCustomerName(effectiveName);
      }
    }

    // Fallback 3: Use selected customer mobile if form field is empty
    if (!effectiveMobile && selectedCustomer?.mobile) {
      effectiveMobile = selectedCustomer.mobile.trim();
      setCustomerMobile(effectiveMobile);
    }
    // Fallback 4: If user entered digits in customer search box
    if (!effectiveMobile && customerSearchQuery.trim()) {
      const digits = customerSearchQuery.replace(/[^\d]/g, '');
      if (digits.length >= 10) {
        effectiveMobile = digits;
        setCustomerMobile(effectiveMobile);
      }
    }

    // Verification of required fields
    if (!effectiveName) {
      alert('Please enter Customer Name');
      return;
    }
    if (!effectiveMobile) {
      alert('Please enter Customer Mobile Number');
      return;
    }

    // Strict Double-Booking Prevention:
    // Check if the selected slot on the selected date is already booked by an active booking
    if (bookingStatus !== 'Cancelled') {
      const occupiedBy = occupiedSlotsMap.get(slotNumber);
      if (occupiedBy) {
        const errorMsg = `Slot ${slotNumber} is already booked for this date. Please choose an available slot.`;
        setSlotValidationError(errorMsg);
        alert(errorMsg);
        return;
      }
    }

    // Strict Rule: Staff assignment validation
    // Mandatory ONLY when creating a new active booking or confirming/scheduling a booking.
    // When a booking's status is changed to "Cancelled" or "Postponed/Rescheduled", bypass completely!
    if (!isCancelledOrPostponed) {
      if (!assignedStaffIds || assignedStaffIds.length === 0) {
        const errorMsg = 'Please assign a staff member before confirming the booking.';
        setStaffValidationError(errorMsg);
        alert(errorMsg);
        return;
      }

      // Prevent assigning busy staff member
      for (const staffId of assignedStaffIds) {
        if (busyStaffMap.has(staffId)) {
          const staffMember = allStaff.find((s) => s.id === staffId);
          const name = staffMember ? staffMember.name : staffId;
          const errorMsg = `Staff ${name} is already assigned to this slot on this date.`;
          setStaffValidationError(errorMsg);
          alert(errorMsg);
          return;
        }
      }
    }

    setIsSubmitting(true);

    const assignedStaffMembers = assignedStaffIds
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

    const finalService = serviceType === 'Other' && customService ? customService : serviceType;
    const finalQty = Math.max(1, quantity || 1);
    const sDesc = serviceDescription.trim();
    let calculatedDetails = '';
    if (sDesc) {
      if (finalService && !sDesc.toLowerCase().includes(finalService.toLowerCase())) {
        calculatedDetails = `${finalService} (Qty: ${finalQty}) - ${sDesc}`;
      } else {
        calculatedDetails = sDesc;
      }
    } else {
      calculatedDetails = finalQty > 1 ? `${finalService} (Qty: ${finalQty})` : finalService;
    }

    const finalAmount = isAfterVisitAmount
      ? 'After Visit'
      : typeof amount === 'number'
      ? amount
      : parseFloat(String(amount)) || 0;

    const isDetailsChanged = Boolean(
      bookingToEdit && (
        bookingToEdit.scheduleDate !== scheduleDate ||
        bookingToEdit.slotNumber !== slotNumber ||
        bookingToEdit.slotPeriod !== slotPeriod ||
        bookingToEdit.serviceType !== finalService ||
        (bookingToEdit.serviceDescription || '') !== sDesc ||
        bookingToEdit.serviceLocation !== serviceLocation ||
        (bookingToEdit.fullAddress || '') !== fullAddress.trim() ||
        String(bookingToEdit.amount) !== String(finalAmount) ||
        bookingToEdit.quantity !== finalQty ||
        JSON.stringify(bookingToEdit.assignedStaffIds || []) !== JSON.stringify(assignedStaffIds || [])
      )
    );

    const savedBooking: Booking = {
      id: bookingToEdit ? bookingToEdit.id : `b-${Date.now()}`,
      bookingRef: bookingRef.trim() || suggestedRef,
      bookingDate: bookingDate || new Date().toISOString().split('T')[0],
      scheduleDate,
      customerName: effectiveName,
      customerMobile: effectiveMobile,
      alternateMobile: customerWhatsApp.trim() || effectiveMobile,
      customerWhatsApp: customerWhatsApp.trim() || effectiveMobile,
      serviceType: finalService,
      quantity: finalQty,
      serviceDescription: sDesc,
      serviceDetails: calculatedDetails,
      serviceLocation,
      customLocation: serviceLocation === 'Other' ? customLocation.trim() : undefined,
      fullAddress: fullAddress.trim(),
      slotNumber,
      slotPeriod,
      preferredTime: preferredTime.trim() || undefined,
      staffRequired: Math.max(1, assignedStaffIds.length || staffRequired),
      assignedStaffIds,
      assignedStaffNames: assignedNames,
      staffMobile: staffMobileStr,
      team: assignedNames.length > 1 ? assignedNames.join(' & ') : undefined,
      amount: finalAmount,
      advanceAmount: isAfterVisitAmount ? 0 : Number(advanceAmount) || 0,
      balanceAmount: isAfterVisitAmount ? 0 : Number(balanceAmount) || 0,
      paymentStatus,
      bookingStatus,
      notes: notes.trim(),
      createdBy: bookingToEdit?.createdBy || 'MSD Admin',
      createdDevice: bookingToEdit?.createdDevice || getDeviceIdentifier(),
      lastSync: new Date().toISOString(),
      createdAt: bookingToEdit ? bookingToEdit.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Preserve prior delivery statuses
      customerMessageStatus: isDetailsChanged ? 'Ready' : bookingToEdit?.customerMessageStatus,
      customerMessageOpenedAt: bookingToEdit?.customerMessageOpenedAt,
      customerMessageSentAt: bookingToEdit?.customerMessageSentAt,
      staffMessageStatuses: isDetailsChanged ? undefined : bookingToEdit?.staffMessageStatuses,
      staffMessageSentAt: bookingToEdit?.staffMessageSentAt,
      rawSheetExtra: bookingToEdit?.rawSheetExtra,
    };

    onSave(savedBooking, isDetailsChanged);
    setTimeout(() => setIsSubmitting(false), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm text-white shadow-xs">
              MSD
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">
                {bookingToEdit ? 'Edit Booking' : 'New Booking Entry'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Central MSD Database &bull; Reference: {bookingRef}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Conflict Alert Banner */}
          {conflicts.length > 0 && (
            <div className="bg-rose-50 border border-rose-300 rounded-xl p-3.5 space-y-2">
              <div className="flex items-start gap-2 text-rose-800 font-bold text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span>⚠️ Staff Conflict Detected!</span>
                  <div className="text-[11px] font-normal text-rose-700 mt-0.5">
                    The following staff member is already assigned to another booking during{' '}
                    <span className="font-semibold">
                      Slot {slotNumber} on {scheduleDate}
                    </span>
                    :
                  </div>
                </div>
              </div>
              <ul className="list-disc list-inside text-rose-800 text-[11px] font-medium space-y-0.5 pl-2">
                {conflicts.map((c, i) => (
                  <li key={i}>
                    <span className="font-bold">{c.staffName}</span> is already on booking{' '}
                    <span className="underline font-mono">{c.conflictingBookingRef}</span> (
                    {c.customerName})
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between pt-1 border-t border-rose-200">
                <label className="flex items-center gap-1.5 cursor-pointer text-rose-900 font-semibold text-[11px]">
                  <input
                    type="checkbox"
                    checked={overrideConflict}
                    onChange={(e) => setOverrideConflict(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>Allow assignment anyway (Manager Override)</span>
                </label>
              </div>
            </div>
          )}

          {/* Slot Occupied Notification */}
          {slotOccupiedWarning && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-amber-900 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Slot {slotNumber} is already booked by{' '}
                  <span className="font-bold">{slotOccupiedWarning.customerName}</span> (
                  {slotOccupiedWarning.bookingRef}). You can still proceed if this is a team job.
                </span>
              </div>
            </div>
          )}

          {/* Row 1: Booking Ref & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Booking Reference No.
              </label>
              <input
                type="text"
                value={bookingRef}
                onChange={(e) => setBookingRef(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Booking Entry Date
              </label>
              <input
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Schedule Service Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                required
                className="w-full bg-blue-50/50 border border-blue-300 font-semibold rounded-lg px-2.5 py-1.5 text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Row 2: Customer Details & Auto-fill Database */}
          <div className="bg-slate-50/90 p-3.5 rounded-xl border border-slate-200/90 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Customer Information</span>
                {selectedCustomer && (
                  <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Customer Linked
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={handleCreateNewCustomer}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-blue-700 bg-white hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded-md transition-colors"
                  >
                    <UserPlus className="w-3 h-3 text-slate-500" />
                    <span>+ New Customer</span>
                  </button>
                )}
              </div>
            </div>

            {/* Customer Search Bar */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                  <Search className="w-3 h-3 text-blue-600" />
                  <span>Search Existing Customer</span>
                </label>
                <span className="text-[10px] text-slate-500">
                  Search by Mobile or Customer Name
                </span>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={customerSearchQuery}
                  onChange={(e) => {
                    setCustomerSearchQuery(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  onFocus={() => setShowSearchDropdown(true)}
                  placeholder="Type mobile number or name (e.g. 9876543210 or Mr. Rahman)..."
                  className="w-full pl-8 pr-8 py-1.5 bg-white border border-blue-200 focus:border-blue-500 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                {customerSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerSearchQuery('');
                      setShowSearchDropdown(false);
                    }}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {showSearchDropdown && customerSearchQuery.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {customerSuggestions.length > 0 ? (
                    customerSuggestions.map((cust) => (
                      <div
                        key={cust.id || cust.mobile}
                        className="p-2.5 hover:bg-blue-50/70 transition-colors flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-800 truncate">
                              {cust.name}
                            </span>
                            <span className="font-mono text-[11px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                              {cust.mobile}
                            </span>
                            {cust.totalBookings > 0 && (
                              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                                {cust.totalBookings} Bookings
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {cust.fullAddress
                              ? cust.fullAddress
                              : cust.location || 'Puducherry'}
                          </div>
                          {cust.lastService && (
                            <div className="text-[10px] text-amber-700 mt-0.5">
                              Last service: <span className="font-medium">{cust.lastService}</span>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectCustomer(cust)}
                          className="shrink-0 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-md shadow-2xs transition-colors flex items-center gap-1"
                        >
                          <span>Select Customer</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center space-y-1.5">
                      <p className="text-xs text-slate-500">
                        No existing customer found matching "{customerSearchQuery}"
                      </p>
                      <button
                        type="button"
                        onClick={handleCreateNewCustomer}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                        <span>Create New Customer</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Direct Phone Auto-detect Banner */}
            {detectedCustomerByMobile && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between gap-2 text-xs animate-in fade-in">
                <div className="flex items-center gap-1.5 text-blue-900 min-w-0">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">
                    Found existing customer: <strong>{detectedCustomerByMobile.name}</strong> (
                    {detectedCustomerByMobile.location || 'Puducherry'})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectCustomer(detectedCustomerByMobile)}
                  className="shrink-0 px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-[11px] transition-colors"
                >
                  Auto-fill Details
                </button>
              </div>
            )}

            {/* Customer History Section (when customer is selected) */}
            {selectedCustomer && (
              <div className="bg-white border border-emerald-200/90 rounded-xl p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                    <History className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Customer History: {selectedCustomer.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCustomerHistory(!showCustomerHistory)}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                  >
                    <span>{showCustomerHistory ? 'Hide History' : 'View Customer History'}</span>
                    {showCustomerHistory ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Previous Bookings</span>
                    <span className="font-bold text-slate-800 text-xs">
                      {selectedCustomer.totalBookings || customerHistoryBookings.length}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Last Service</span>
                    <span className="font-semibold text-slate-800 text-xs truncate block" title={selectedCustomer.lastService}>
                      {selectedCustomer.lastService || 'General'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Last Booking</span>
                    <span className="font-medium text-slate-800 text-xs">
                      {selectedCustomer.lastBookingDate
                        ? new Date(selectedCustomer.lastBookingDate).toLocaleDateString('en-GB')
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Last Amount</span>
                    <span className="font-semibold text-emerald-700 text-xs">
                      {customerHistoryBookings[0]?.amount !== undefined
                        ? `₹${customerHistoryBookings[0].amount}`
                        : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Quick Action: Apply Previous Service */}
                {selectedCustomer.lastService && selectedCustomer.lastService !== serviceType && (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-500">Previously ordered:</span>
                    <button
                      type="button"
                      onClick={() => handleApplyLastService(selectedCustomer.lastService)}
                      className="text-[10px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors"
                    >
                      Use Last Service: {selectedCustomer.lastService}
                    </button>
                  </div>
                )}

                {/* Collapsible Detailed History List */}
                {showCustomerHistory && (
                  <div className="mt-2 pt-2 border-t border-slate-100 max-h-48 overflow-y-auto space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Past Bookings ({customerHistoryBookings.length}):
                    </span>
                    {customerHistoryBookings.length > 0 ? (
                      customerHistoryBookings.map((b) => (
                        <div
                          key={b.id || b.bookingRef}
                          className="p-1.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-800 mr-2">{b.serviceType}</span>
                            <span className="text-slate-500 font-mono text-[11px] mr-2">
                              {b.bookingRef}
                            </span>
                            <span className="text-slate-500 text-[10px]">
                              {b.scheduleDate || b.bookingDate}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-emerald-700">₹{b.amount}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                b.bookingStatus === 'Completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : b.bookingStatus === 'Cancelled'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {b.bookingStatus}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">No previous bookings found.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Standard Customer Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mr. Shahab Uddin"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    if (selectedCustomer) setIsCustomerModified(true);
                  }}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9042233122"
                  value={customerMobile}
                  onChange={(e) => {
                    setCustomerMobile(e.target.value);
                    if (selectedCustomer) setIsCustomerModified(true);
                  }}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-slate-600">WhatsApp Number</label>
                  <label className="flex items-center gap-1 text-[10px] text-blue-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sameAsMobile}
                      onChange={(e) => setSameAsMobile(e.target.checked)}
                      className="rounded"
                    />
                    <span>Same as Mobile</span>
                  </label>
                </div>
                <input
                  type="tel"
                  disabled={sameAsMobile}
                  placeholder="WhatsApp Number"
                  value={customerWhatsApp}
                  onChange={(e) => setCustomerWhatsApp(e.target.value)}
                  className="w-full bg-white disabled:bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {isCustomerModified && selectedCustomer && (
              <p className="text-[10px] text-amber-700 italic">
                Note: Modifications to customer details will update "{selectedCustomer.name}" in the customer database on save.
              </p>
            )}
          </div>

          {/* Field: Service Type and Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <label className="block font-semibold text-slate-700 mb-1">
                Service Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <optgroup label="Website Services (msdfs.in)">
                  {serviceList
                    .filter((srv) => WEBSITE_MSDFS_SERVICES.includes(srv))
                    .map((srv, idx) => (
                      <option key={`web-${idx}`} value={srv}>
                        {srv}
                      </option>
                    ))}
                </optgroup>
                {serviceList.filter((srv) => !WEBSITE_MSDFS_SERVICES.includes(srv)).length > 0 && (
                  <optgroup label="Other Available Services">
                    {serviceList
                      .filter((srv) => !WEBSITE_MSDFS_SERVICES.includes(srv))
                      .map((srv, idx) => (
                        <option key={`other-${idx}`} value={srv}>
                          {srv}
                        </option>
                      ))}
                  </optgroup>
                )}
                <option value="Other">Other (Type custom service)</option>
              </select>
              {serviceType === 'Other' && (
                <input
                  type="text"
                  placeholder="Type custom service name..."
                  value={customService}
                  onChange={(e) => setCustomService(e.target.value)}
                  className="w-full mt-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Quantity (QTY)
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Field: Work Description (Immediately after Service Type) */}
          <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-700" />
                <span>Work Description (Scope of Work / Task Details)</span>
              </label>
              <span className="text-[10px] text-amber-800 font-semibold bg-amber-100/90 border border-amber-200 px-2 py-0.5 rounded-full">
                Included in WhatsApp & Staff Alert
              </span>
            </div>
            <textarea
              rows={2}
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              placeholder="Specify detailed tasks (e.g. Deep clean 2 bathrooms with acid wash, clean 4 ceiling fans, scrub balcony tiles, kitchen chimney & sink...)"
              className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 leading-relaxed"
            />
            <div className="flex items-center justify-between text-[11px] text-amber-800/90 pt-0.5">
              <span>Detailed work descriptions provide clear instructions to the cleaning crew and customer.</span>
              {serviceDescription.length > 0 && (
                <span className="font-mono text-[10px] text-amber-700 bg-white/80 px-1.5 py-0.5 rounded border border-amber-200 font-semibold">
                  {serviceDescription.length} chars
                </span>
              )}
            </div>
          </div>

          {/* Field: Service Location */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Service Location <span className="text-rose-500">*</span>
            </label>
            <select
              value={serviceLocation}
              onChange={(e) => setServiceLocation(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {locationList.map((loc, idx) => (
                <option key={idx} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
            {serviceLocation === 'Other' && (
              <input
                type="text"
                placeholder="Enter location / town name..."
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                className="w-full mt-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          </div>

          {/* Field: Full Address / Landmarks */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Full Address / Landmarks
            </label>
            <input
              type="text"
              placeholder="Door No, Street Name, Landmark, Pin code"
              value={fullAddress}
              onChange={(e) => setFullAddress(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Row 4: Slot Selection (1 to 10) */}
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Daily Slot (1 to 10)</span>
              </span>
              <span className="text-[11px] font-semibold text-blue-700">
                Selected: Slot {slotNumber} ({slotPeriod})
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {allSlots.map((slot) => {
                const isSelected = slotNumber === slot.slotNumber;
                const isOccupied = occupiedSlotsMap.has(slot.slotNumber);
                const occupiedBooking = occupiedSlotsMap.get(slot.slotNumber);

                if (isOccupied) {
                  return (
                    <div
                      key={slot.id}
                      className="p-2 rounded-lg border text-center transition-all bg-slate-100/90 border-slate-200 text-slate-400 cursor-not-allowed select-none opacity-80"
                      title={`Slot ${slot.slotNumber} (${slot.period}) is already booked by ${occupiedBooking?.customerName || 'another customer'} on this date`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-slate-500 line-through">
                          Slot {slot.slotNumber}
                        </span>
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-tight">
                          Booked
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5 font-medium">
                        {occupiedBooking?.customerName ? occupiedBooking.customerName.split(' ')[0] : 'Occupied'}
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    type="button"
                    key={slot.id}
                    onClick={() => handleSlotChange(slot.slotNumber)}
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-700 font-bold shadow-2xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 font-medium'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Slot {slot.slotNumber}</span>
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`}
                      />
                    </div>
                    <div className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                      {slot.period}
                    </div>
                  </button>
                );
              })}
            </div>

            {slotValidationError && (
              <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{slotValidationError}</span>
              </div>
            )}

            <div className="pt-1">
              <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                Preferred Time / Timing Notes (Optional)
              </label>
              <input
                type="text"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                placeholder="e.g. Morning / Afternoon or specific timing if needed"
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800"
              />
            </div>
          </div>

          {/* Row 5: Staff Assignment UI (Section 7 & 8) */}
          <div
            className={`p-3.5 rounded-xl border space-y-3 transition-colors ${
              staffValidationError
                ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-200'
                : 'bg-blue-50/40 border-blue-200'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Users className="w-4 h-4 text-blue-600" />
                <span>
                  Staff Assignment ({assignedStaffIds.length} of {allStaff.length} Selected)
                </span>
                {isCancelledOrPostponed ? (
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    Optional for {bookingStatus}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200">
                    * Required
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={selectAllStaff}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 hover:bg-blue-200 text-blue-800 transition-colors cursor-pointer"
                >
                  Select Entire Team (All 6)
                </button>
                <button
                  type="button"
                  onClick={clearStaff}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-200/80 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {staffValidationError && (
              <div className="p-2.5 bg-rose-100/90 border border-rose-300 rounded-lg text-rose-900 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{staffValidationError}</span>
              </div>
            )}

            {/* Selected Staff Removable Chips [ Saidul x ] [ Farhad x ] */}
            {assignedStaffIds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-lg border border-blue-200 min-h-[36px] items-center">
                {assignedStaffIds.map((id) => {
                  const staff = allStaff.find((s) => s.id === id);
                  const isBusy = busyStaffMap.has(id);
                  return (
                    <span
                      key={id}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold shadow-2xs border ${
                        isBusy
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-blue-600 text-white border-blue-700'
                      }`}
                    >
                      <span>{staff ? staff.name.replace(/^Mr\.\s*/, '') : id}</span>
                      {isBusy && <span className="text-[10px] font-bold">(Busy)</span>}
                      <button
                        type="button"
                        onClick={() => removeStaffChip(id)}
                        className="hover:bg-black/20 rounded-full p-0.5 ml-0.5 transition-colors cursor-pointer"
                        title="Remove staff"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="p-2 bg-white rounded-lg border border-dashed border-slate-300 text-center text-slate-400 text-xs italic">
                {isCancelledOrPostponed
                  ? `Staff assignment is optional when booking status is ${bookingStatus}.`
                  : 'No staff selected yet. Choose from the staff checklist below:'}
              </div>
            )}

            {/* Staff Checkbox Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allStaff.map((staff) => {
                const isSelected = assignedStaffIds.includes(staff.id);
                const isBusy = busyStaffMap.has(staff.id);
                const busyInfo = busyStaffMap.get(staff.id);

                return (
                  <label
                    key={staff.id}
                    className={`flex items-start gap-2 p-2 rounded-lg border text-xs transition-colors ${
                      isBusy
                        ? 'bg-slate-100/90 border-slate-200 text-slate-400 cursor-not-allowed opacity-75'
                        : isSelected
                        ? 'bg-blue-50 border-blue-300 text-blue-950 font-semibold cursor-pointer'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer'
                    }`}
                    title={
                      isBusy
                        ? `${staff.name} is already assigned to Slot ${slotNumber} in booking ${busyInfo?.booking.bookingRef || ''}`
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isBusy}
                      onChange={() => toggleStaff(staff.id)}
                      className={`mt-0.5 rounded text-blue-600 focus:ring-blue-500 ${
                        isBusy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className={`truncate font-semibold ${isBusy ? 'text-slate-400' : ''}`}>
                        {staff.name}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {staff.mobile || 'No mobile'}
                      </div>
                      {isBusy ? (
                        <div className="text-[10px] text-rose-600 font-bold mt-0.5">
                          (Busy / Already Assigned)
                        </div>
                      ) : (
                        isSelected && (
                          <div className="text-[9px] text-blue-600 font-medium">Selected</div>
                        )
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Row 6: Pricing, Advance & Balance (Section 12) */}
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span>Payment &amp; Billing Calculation</span>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 font-normal cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAfterVisitAmount}
                  onChange={(e) => {
                    setIsAfterVisitAmount(e.target.checked);
                    if (e.target.checked) setAmount('After Visit');
                    else setAmount('');
                  }}
                  className="rounded text-blue-600"
                />
                <span>"After Visit" / Estimate on inspection</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Total Amount (₹)
                </label>
                <input
                  type={isAfterVisitAmount ? 'text' : 'number'}
                  disabled={isAfterVisitAmount}
                  placeholder="e.g. 2500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white disabled:bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Advance Paid (₹)
                </label>
                <input
                  type="number"
                  disabled={isAfterVisitAmount}
                  placeholder="0"
                  value={advanceAmount || ''}
                  onChange={(e) => setAdvanceAmount(Number(e.target.value))}
                  className="w-full bg-white disabled:bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Balance Due (₹)
                </label>
                <input
                  type="number"
                  disabled
                  value={balanceAmount}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-amber-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800"
                >
                  <option value="Pending">Pending</option>
                  <option value="Advance Paid">Advance Paid</option>
                  <option value="Fully Paid">Fully Paid</option>
                  <option value="Not Paid">Not Paid</option>
                </select>
              </div>
            </div>
          </div>

          {/* Row 7: Booking Status & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Booking Status
              </label>
              <select
                value={bookingStatus}
                onChange={(e) => {
                  const newStatus = e.target.value as BookingStatus;
                  setBookingStatus(newStatus);
                  if (
                    newStatus === 'Cancelled' ||
                    newStatus === 'Rescheduled' ||
                    (newStatus as string) === 'Postponed'
                  ) {
                    setStaffValidationError(null);
                    setSlotValidationError(null);
                  }
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-blue-900"
              >
                <option value="New">New</option>
                <option value="Pending">Pending</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Staff Assigned">Staff Assigned</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Rescheduled">Rescheduled</option>
                <option value="Postponed">Postponed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Special Instructions / Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Bring extra water tank equipment, key with security"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
              />
            </div>
          </div>

          {bookingStatus === 'Cancelled' && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Cancellation Mode:</strong> Saving will cancel the booking, release Slot {slotNumber}, and free up staff for other bookings. Staff assignment is bypassed.
              </span>
            </div>
          )}

          {staffValidationError && (
            <div className="mt-3 p-2.5 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{staffValidationError}</span>
            </div>
          )}
        </form>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-2 ${
              isSubmitting
                ? 'bg-slate-400 cursor-not-allowed'
                : bookingStatus === 'Cancelled'
                ? 'bg-rose-600 hover:bg-rose-500'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
            id="btn-save-booking"
          >
            <Send className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Saving Booking...'
                : bookingStatus === 'Cancelled'
                ? 'Confirm Cancellation & Release Slot'
                : bookingToEdit
                ? 'Save Booking & Check Messages'
                : 'Save Booking & Send Messages'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
