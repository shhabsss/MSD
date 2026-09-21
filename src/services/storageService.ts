import {
  INITIAL_BOOKINGS,
  INITIAL_SETTINGS,
  INITIAL_SLOTS,
  INITIAL_STAFF,
  PONDICHERRY_LOCATIONS,
  WEBSITE_MSDFS_SERVICES,
} from '../data/initialData';
import {
  AppSettings,
  Booking,
  ConflictWarning,
  SlotDefinition,
  StaffMember,
} from '../types';
import {
  exportBookingsGoogleSheetCSV,
  getFreshGoogleAppsScriptTemplate,
  pushBookingToCloud,
} from './syncService';
import { isSameDay } from '../utils/dateUtils';

const STORAGE_KEYS = {
  BOOKINGS: 'msd_bookings_v3',
  STAFF: 'msd_staff_v2',
  SLOTS: 'msd_slots_v3',
  SETTINGS: 'msd_settings_v3',
};

// Clear all bookings for fresh start
export function clearAllBookings(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify([]));
    localStorage.removeItem('msd_bookings_v2');
    localStorage.removeItem('msd_bookings');
  } catch (e) {
    console.error('Failed to clear bookings', e);
  }
}

// Storage retrieval and persistence
export function resolveBookingStaffMobile(
  booking: Partial<Booking>,
  staffList?: StaffMember[]
): string {
  if (booking.staffMobile && booking.staffMobile.trim()) {
    return booking.staffMobile.trim();
  }

  const list = staffList && staffList.length > 0 ? staffList : getStoredStaff();
  const staffIds = booking.assignedStaffIds || [];
  const staffNames = booking.assignedStaffNames || [];

  const foundStaff: StaffMember[] = [];

  if (staffIds.length > 0) {
    for (const id of staffIds) {
      const s = list.find((item) => item.id === id);
      if (s && !foundStaff.some((existing) => existing.id === s.id)) {
        foundStaff.push(s);
      }
    }
  }

  if (foundStaff.length === 0 && staffNames.length > 0) {
    for (const name of staffNames) {
      const cleanName = name.replace(/^Mr\.\s*/i, '').trim().toLowerCase();
      const s = list.find(
        (item) => item.name.replace(/^Mr\.\s*/i, '').trim().toLowerCase() === cleanName
      );
      if (s && !foundStaff.some((existing) => existing.id === s.id)) {
        foundStaff.push(s);
      }
    }
  }

  if (foundStaff.length === 0) return '';
  if (foundStaff.length === 1) {
    return foundStaff[0].mobile || '';
  }

  // Multiple staff
  const withNames = foundStaff
    .filter((s) => s.mobile)
    .map((s) => `${s.name.replace(/^Mr\.\s*/i, '')}: ${s.mobile}`);
  if (withNames.length > 0) {
    return withNames.join(', ');
  }
  return foundStaff.map((s) => s.mobile).filter(Boolean).join(', ');
}

export function getStoredBookings(): Booking[] {
  try {
    // If old v2 exists, purge it to respect the user's fresh start request
    if (localStorage.getItem('msd_bookings_v2')) {
      localStorage.removeItem('msd_bookings_v2');
    }
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify([]));
      return [];
    }
    const list: Booking[] = JSON.parse(raw);
    const staffMembers = getStoredStaff();
    let mutated = false;
    const enriched = list.map((b) => {
      let changed = false;
      let mob = b.staffMobile;
      if (!mob && ((b.assignedStaffIds && b.assignedStaffIds.length > 0) || (b.assignedStaffNames && b.assignedStaffNames.length > 0))) {
        mob = resolveBookingStaffMobile(b, staffMembers);
        if (mob) changed = true;
      }
      let slotNum = b.slotNumber;
      if (!slotNum || typeof slotNum !== 'number' || isNaN(slotNum) || slotNum < 1 || slotNum > 10) {
        const pref = `${b.preferredTime || ''} ${(b as any).timeSlot || ''}`;
        const match = pref.match(/slot\s*(\d+)/i);
        if (match) {
          const parsed = parseInt(match[1], 10);
          if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
            slotNum = parsed;
            changed = true;
          }
        }
      }
      let details = b.serviceDetails;
      if (!details) {
        const qty = b.quantity && b.quantity > 0 ? b.quantity : 1;
        const sType = (b.serviceType || '').trim();
        const sDesc = (b.serviceDescription || '').trim();
        if (sDesc) {
          details = (sType && !sDesc.toLowerCase().includes(sType.toLowerCase()))
            ? `${sType} (Qty: ${qty}) - ${sDesc}`
            : sDesc;
        } else {
          details = qty > 1 ? `${sType} (Qty: ${qty})` : sType;
        }
        if (details) changed = true;
      }
      let pStatus = b.paymentStatus;
      let balAmt = b.balanceAmount;
      let finAmt = b.finalCollectedAmount;
      let advAmt = b.advanceAmount;

      const cleanAmt =
        typeof b.amount === 'number'
          ? b.amount
          : parseFloat(String(b.amount).replace(/[^\d.]/g, '')) || 0;

      // Cancelled bookings must have paymentStatus 'Cancelled' and balanceAmount 0
      if (b.bookingStatus === 'Cancelled') {
        if (pStatus !== 'Cancelled') {
          pStatus = 'Cancelled';
          changed = true;
        }
        if (balAmt !== 0) {
          balAmt = 0;
          changed = true;
        }
      }

      // Any non-zero booking already marked 'Completed' should default paymentStatus to 'Paid'
      if (b.bookingStatus === 'Completed' && cleanAmt > 0) {
        if (pStatus !== 'Paid' && pStatus !== 'Fully Paid') {
          pStatus = 'Paid';
          changed = true;
        }
        if (balAmt !== 0) {
          balAmt = 0;
          changed = true;
        }
        if (finAmt === undefined || finAmt === null) {
          finAmt = cleanAmt;
          changed = true;
        }
        if (advAmt === undefined || advAmt === null) {
          advAmt = cleanAmt;
          changed = true;
        }
      }

      if (changed) {
        mutated = true;
        return {
          ...b,
          staffMobile: mob,
          serviceDetails: details,
          slotNumber: (slotNum && slotNum >= 1 && slotNum <= 10) ? slotNum : b.slotNumber,
          paymentStatus: pStatus,
          balanceAmount: balAmt,
          finalCollectedAmount: finAmt,
          advanceAmount: advAmt,
        };
      }
      return b;
    });

    if (mutated) {
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(enriched));
    }
    return enriched;
  } catch (e) {
    console.error('Failed to load bookings from storage', e);
    return [];
  }
}

export function normalizeBookingRecords(list: Booking[]): Booking[] {
  return list.map((b) => {
    let paymentStatus = b.paymentStatus;
    let balanceAmount = b.balanceAmount;
    let finalCollectedAmount = b.finalCollectedAmount;
    let advanceAmount = b.advanceAmount;

    const cleanAmt =
      typeof b.amount === 'number'
        ? b.amount
        : parseFloat(String(b.amount).replace(/[^\d.]/g, '')) || 0;

    // Rule 1: Cancelled bookings set paymentStatus to 'Cancelled' and balanceAmount to 0
    if (b.bookingStatus === 'Cancelled') {
      paymentStatus = 'Cancelled';
      balanceAmount = 0;
    }

    // Rule 2: Any non-zero booking already marked 'Completed' should default paymentStatus to 'Paid'
    if (b.bookingStatus === 'Completed' && cleanAmt > 0) {
      if (paymentStatus !== 'Paid' && paymentStatus !== 'Fully Paid') {
        paymentStatus = 'Paid';
      }
      balanceAmount = 0;
      if (finalCollectedAmount === undefined || finalCollectedAmount === null) {
        finalCollectedAmount = cleanAmt;
      }
      if (advanceAmount === undefined || advanceAmount === null) {
        advanceAmount = cleanAmt;
      }
    }

    return {
      ...b,
      paymentStatus,
      balanceAmount,
      finalCollectedAmount,
      advanceAmount,
    };
  });
}

export function saveStoredBookings(bookings: Booking[]): void {
  try {
    const normalized = normalizeBookingRecords(bookings);
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(normalized));
  } catch (e) {
    console.error('Failed to save bookings', e);
  }
}

export function getStoredStaff(): StaffMember[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STAFF);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(INITIAL_STAFF));
      return INITIAL_STAFF;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load staff from storage', e);
    return INITIAL_STAFF;
  }
}

export function saveStoredStaff(staff: StaffMember[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staff));
  } catch (e) {
    console.error('Failed to save staff', e);
  }
}

export function getStoredSlots(): SlotDefinition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SLOTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SLOTS, JSON.stringify(INITIAL_SLOTS));
      return INITIAL_SLOTS;
    }
    const parsed: SlotDefinition[] = JSON.parse(raw);
    return parsed.map((s) => ({ ...s, startTime: '', endTime: '' }));
  } catch (e) {
    console.error('Failed to load slots from storage', e);
    return INITIAL_SLOTS;
  }
}

export function saveStoredSlots(slots: SlotDefinition[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SLOTS, JSON.stringify(slots));
  } catch (e) {
    console.error('Failed to save slots', e);
  }
}

export function getStoredSettings(): AppSettings {
  try {
    let raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    // If v3 does not exist yet, check if v2 exists
    if (!raw) {
      const oldV2 = localStorage.getItem('msd_settings_v2');
      if (oldV2) {
        raw = oldV2;
      }
    }

    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
      return INITIAL_SETTINGS;
    }

    const parsed: AppSettings = JSON.parse(raw);
    let updated = false;

    // Filter out all multi/numbered bathroom cleaning variations like "1 Bathroom Cleaning", "2 Bathrooms cleaning", etc.
    const isUnwantedBathroomVariant = (s: string) => {
      const lower = s.trim().toLowerCase();
      return lower.includes('bathroom') && lower !== 'bathroom cleaning';
    };

    let currentServices = Array.isArray(parsed.services)
      ? parsed.services.filter((srv) => {
          if (isUnwantedBathroomVariant(srv)) {
            updated = true;
            return false;
          }
          return true;
        })
      : [];

    // Ensure 'Bathroom Cleaning' is always present
    if (!currentServices.includes('Bathroom Cleaning')) {
      currentServices.push('Bathroom Cleaning');
      updated = true;
    }

    // Ensure all services from WEBSITE_MSDFS_SERVICES are available in catalog
    for (const srv of WEBSITE_MSDFS_SERVICES) {
      if (!currentServices.includes(srv)) {
        currentServices.push(srv);
        updated = true;
      }
    }

    // Ensure company info has official address, PAN and Kotak bank details
    if (!parsed.company?.panNo || !parsed.company?.bankAccountNo || (parsed.company.address && parsed.company.address.includes('No 72'))) {
      parsed.company = {
        ...INITIAL_SETTINGS.company,
        ...parsed.company,
        address: 'No 73, 6th Cross, JJ Nagar, Moolakulam, Pondicherry, 605010',
        panNo: 'BWAPB3440A',
        bankName: 'Kotak Mahindra Bank Limited, Puducherry Pondicherr',
        bankAccountNo: '7812479352',
        bankIfsc: 'KKBK0008955',
        bankAccountHolder: 'Baharul Islam Borbhuyan',
        logoUrl: '/logo1.png',
      };
      updated = true;
    }

    // Ensure WhatsApp templates are refreshed to the clean location format without redundant full address in customer message
    if (
      !parsed.whatsappTemplates ||
      !parsed.whatsappTemplates.customerTemplate ||
      parsed.whatsappTemplates.customerTemplate.includes('Full Address / Landmarks:') ||
      parsed.whatsappTemplates.customerTemplate.includes('🏠 Full Address')
    ) {
      parsed.whatsappTemplates = INITIAL_SETTINGS.whatsappTemplates;
      updated = true;
    }

    // Ensure default googleSheetWebAppUrl is configured for instant multi-device synchronization
    if (!parsed.googleSheetWebAppUrl || !parsed.googleSheetWebAppUrl.trim()) {
      parsed.googleSheetWebAppUrl = INITIAL_SETTINGS.googleSheetWebAppUrl;
      updated = true;
    }
    if (parsed.autoSyncEnabled === undefined) {
      parsed.autoSyncEnabled = true;
      updated = true;
    }

    // Ensure full comprehensive list of Pondicherry locations is populated
    if (!Array.isArray(parsed.locations) || parsed.locations.length < PONDICHERRY_LOCATIONS.length) {
      const existingLocs = new Set(Array.isArray(parsed.locations) ? parsed.locations : []);
      const mergedLocations: string[] = [];
      for (const loc of PONDICHERRY_LOCATIONS) {
        if (loc !== 'Other') {
          mergedLocations.push(loc);
        }
      }
      for (const loc of existingLocs) {
        if (!mergedLocations.includes(loc) && loc !== 'Other') {
          mergedLocations.push(loc);
        }
      }
      mergedLocations.push('Other');
      parsed.locations = mergedLocations;
      updated = true;
    }

    if (updated) {
      parsed.services = currentServices;
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(parsed));
    }

    return parsed;
  } catch (e) {
    console.error('Failed to load settings from storage', e);
    return INITIAL_SETTINGS;
  }
}

export function saveStoredSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings', e);
  }
}

// Convenient alias exports
export const loadBookings = getStoredBookings;
export const saveBookings = saveStoredBookings;
export const loadStaff = getStoredStaff;
export const saveStaff = saveStoredStaff;
export const loadSlots = getStoredSlots;
export const saveSlots = saveStoredSlots;
export const loadSettings = getStoredSettings;
export const saveSettings = saveStoredSettings;

export function loadCompanyInfo() {
  return getStoredSettings().company;
}

export function saveCompanyInfo(company: AppSettings['company']) {
  const s = getStoredSettings();
  saveStoredSettings({ ...s, company });
}

// Generate unique booking reference in requested format: MSD/PDY/YYYY/XXXX or MSD/PDY/1032
export function generateNextBookingRef(existingBookings: Booking[], settings?: AppSettings): string {
  const currentSettings = settings || getStoredSettings();
  // Find highest numeric ref in existing bookings
  let maxNum = currentSettings.nextRefNumber || 1032;
  existingBookings.forEach((b) => {
    const match = b.bookingRef?.match(/\d+$/);
    if (match) {
      const n = parseInt(match[0], 10);
      if (n >= maxNum) {
        maxNum = n + 1;
      }
    }
  });

  const year = new Date().getFullYear();
  // Standard compact format widely used in MSD sheet: MSD/PDY/1032 or MSD/PDY/2026/0032
  return `MSD/PDY/${year}/${String(maxNum).padStart(4, '0')}`;
}


// Normalizer helper: extract numeric slot 1-10 from booking
export function extractBookingSlotNumber(b: Partial<Booking>): number | null {
  if (typeof b.slotNumber === 'number' && b.slotNumber >= 1 && b.slotNumber <= 10) {
    return b.slotNumber;
  }
  if (b.slotNumber) {
    const parsed = parseInt(String(b.slotNumber), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
      return parsed;
    }
  }
  const text = `${b.preferredTime || ''} ${(b as any)?.timeSlot || ''} ${b.serviceDetails || ''}`;
  const match = text.match(/slot\s*(\d+)/i);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
      return parsed;
    }
  }
  return null;
}

// Conflict detection: checks whether any selected staff member is already assigned on same date & slot
export function detectStaffConflicts(
  booking: Partial<Booking>,
  allBookings: Booking[],
  staffList: StaffMember[],
  excludeBookingId?: string
): ConflictWarning[] {
  const targetSlot = extractBookingSlotNumber(booking);
  const targetDate = booking.scheduleDate || booking.bookingDate;
  if (!targetDate || !targetSlot || !booking.assignedStaffIds?.length) {
    return [];
  }

  const conflicts: ConflictWarning[] = [];

  const otherBookings = allBookings.filter(
    (b) =>
      b.id !== excludeBookingId &&
      b.bookingStatus !== 'Cancelled' &&
      isSameDay(b.scheduleDate || b.bookingDate, targetDate) &&
      extractBookingSlotNumber(b) === targetSlot
  );

  for (const staffId of booking.assignedStaffIds) {
    const conflictingBooking = otherBookings.find((b) =>
      b.assignedStaffIds?.includes(staffId)
    );

    if (conflictingBooking) {
      const staffMember = staffList.find((s) => s.id === staffId);
      const staffName = staffMember ? staffMember.name : staffId;
      conflicts.push({
        staffId,
        staffName,
        conflictingBookingRef: conflictingBooking.bookingRef,
        customerName: conflictingBooking.customerName,
        timeSlot: `Slot ${targetSlot} (${conflictingBooking.slotPeriod || 'Active'})`,
      });
    }
  }

  return conflicts;
}

// Format helper for monetary amount
export function formatBookingAmount(amount: number | string | undefined): { isAfterVisit: boolean; display: string } {
  if (
    amount === undefined ||
    amount === null ||
    amount === '' ||
    String(amount).trim() === '' ||
    String(amount).toLowerCase().includes('after visit') ||
    amount === 0 ||
    amount === '0'
  ) {
    return { isAfterVisit: true, display: 'After Visit' };
  }

  const cleanNum = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^\d.]/g, ''));
  if (isNaN(cleanNum) || cleanNum === 0) {
    return { isAfterVisit: true, display: 'After Visit' };
  }

  return { isAfterVisit: false, display: `₹${cleanNum.toLocaleString('en-IN')}` };
}

// Clean phone number for WhatsApp deep link
export function cleanWhatsAppNumber(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/[^\d]/g, '');
  if (digits.length === 10) {
    digits = '91' + digits;
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = '91' + digits.slice(1);
  }
  return digits;
}

export function buildCompletionInvoiceWhatsAppMessage(
  booking: Booking,
  companyInfo?: {
    name?: string;
    mobile?: string;
    email?: string;
    website?: string;
    address?: string;
    panNo?: string;
    bankName?: string;
    bankAccountNo?: string;
    bankIfsc?: string;
    bankAccountHolder?: string;
  }
): string {
  const company = {
    name: companyInfo?.name || 'MSD Facility Services',
    mobile: companyInfo?.mobile || '9042233122',
    email: companyInfo?.email || 'msdfacilityservices@gmail.com',
    website: companyInfo?.website || 'https://msdfs.in/',
    address: companyInfo?.address || 'No 73, 6th Cross, JJ Nagar, Moolakulam, Pondicherry, 605010',
    panNo: companyInfo?.panNo || 'BWAPB3440A',
    bankName: companyInfo?.bankName || 'Kotak Mahindra Bank Limited, Puducherry Pondicherr',
    bankAccountNo: companyInfo?.bankAccountNo || '7812479352',
    bankIfsc: companyInfo?.bankIfsc || 'KKBK0008955',
    bankAccountHolder: companyInfo?.bankAccountHolder || 'Baharul Islam Borbhuyan',
  };

  const customerName = booking.customerName?.trim() || 'Valued Customer';
  const primaryService = booking.serviceType?.trim() || 'General Cleaning';

  // Primary amount (original before add-ons)
  let origAmt = 0;
  if (typeof booking.originalBookingAmount === 'number') {
    origAmt = booking.originalBookingAmount;
  } else if (booking.originalBookingAmount) {
    origAmt = parseFloat(String(booking.originalBookingAmount).replace(/[^\d.]/g, '')) || 0;
  } else if (typeof booking.amount === 'number') {
    origAmt = booking.amount;
  } else {
    origAmt = parseFloat(String(booking.amount).replace(/[^\d.]/g, '')) || 0;
  }

  // Add-ons
  const addOns = booking.addOnServices || [];
  let addOnsTotal = 0;
  const addOnLines = addOns.map((item) => {
    const itemTotal = Number(item.amount) || 0;
    addOnsTotal += itemTotal;
    const qtyStr = item.quantity > 1 ? ` (Qty: ${item.quantity})` : '';
    return `- ${item.name}${qtyStr}: +₹${itemTotal.toLocaleString('en-IN')}`;
  });

  const subtotal = origAmt + addOnsTotal;
  const discount = Number(booking.discountAmount) || 0;
  const finalAmount =
    booking.finalCollectedAmount !== undefined && booking.finalCollectedAmount !== null
      ? Number(booking.finalCollectedAmount)
      : Math.max(0, subtotal - discount);

  const received =
    booking.finalCollectedAmount !== undefined && booking.finalCollectedAmount !== null
      ? Number(booking.finalCollectedAmount)
      : (booking.paymentMode === 'Credit' ? 0 : finalAmount);

  const balance =
    booking.balanceAmount !== undefined && booking.balanceAmount !== null
      ? Number(booking.balanceAmount)
      : Math.max(0, finalAmount - received);

  const paymentMode = booking.paymentMode || 'Cash';
  const staffNames =
    booking.assignedStaffNames && booking.assignedStaffNames.length > 0
      ? booking.assignedStaffNames.join(', ')
      : 'MSDFS Crew';

  const rawRef = booking.bookingRef || '1032';

  return [
    `🧾 *MSD Facility Services - Bill of Supply*`,
    `_Professional Facility Management & Cleaning Services_`,
    `📍 ${company.address}`,
    `PAN No: ${company.panNo} | Phone: ${company.mobile}`,
    `----------------------------------------`,
    `*Customer:* ${customerName}`,
    `*Location:* ${booking.serviceLocation || 'Puducherry'}${booking.fullAddress ? ` (${booking.fullAddress})` : ''}`,
    `*Invoice / Bill No:* ${rawRef}`,
    `*Date:* ${booking.scheduleDate || booking.bookingDate}`,
    `*Assigned Staff:* ${staffNames}`,
    `----------------------------------------`,
    `*Services Rendered:*`,
    `- ${primaryService}${booking.quantity && booking.quantity > 1 ? ` (Qty: ${booking.quantity})` : ''}: ₹${origAmt.toLocaleString('en-IN')}`,
    ...addOnLines,
    '',
    `*Sub Total:* ₹${subtotal.toLocaleString('en-IN')}`,
    ...(discount > 0 ? [`*You Saved:* ₹${discount.toLocaleString('en-IN')}`] : []),
    `*Total Bill Amount:* ₹${finalAmount.toLocaleString('en-IN')}`,
    `*Payment Mode:* ${paymentMode}`,
    `*Amount Received:* ₹${received.toLocaleString('en-IN')}`,
    ...(balance > 0 ? [`*Balance Due:* ₹${balance.toLocaleString('en-IN')}`] : [`*Payment Status:* FULLY SETTLED ✅`]),
    `----------------------------------------`,
    `*Bank Details for UPI / Transfer:*`,
    `Bank: ${company.bankName}`,
    `A/c No: ${company.bankAccountNo}`,
    `IFSC: ${company.bankIfsc}`,
    `A/c Name: ${company.bankAccountHolder}`,
    `UPI ID: ${company.bankAccountNo}@kotak (or 9042233122@kotak)`,
    `----------------------------------------`,
    `📄 *Official Printable & PDF Bill:*`,
    `An official signed Bill of Supply PDF has been recorded in the company system.`,
    `Thank you for doing business with MSD Facility Services!`,
    `For inquiries: ${company.mobile} | ${company.email}`,
  ].join('\n');
}

// WhatsApp Message Formatters with UTF-8 Emojis Preservation
export function buildCustomerWhatsAppMessage(
  booking: Booking,
  allStaff: StaffMember[],
  companyInfo?: { name: string; mobile: string; email: string; website: string }
): string {
  // If booking is completed, generate the official Tax Invoice & Bill receipt
  if (booking.bookingStatus === 'Completed') {
    return buildCompletionInvoiceWhatsAppMessage(booking, companyInfo);
  }

  const company = companyInfo || {
    name: 'MSD Facility Services',
    mobile: '9042233122',
    email: 'msdfacilityservices@gmail.com',
    website: 'https://msdfs.in/',
  };

  const customerName = booking.customerName?.trim() || 'Valued Customer';
  const service = booking.serviceType?.trim() || 'General Cleaning';

  // 1. Service Location (Full Address / Landmarks hidden from customer message line)
  const location =
    booking.serviceLocation === 'Other' && booking.customLocation
      ? booking.customLocation.trim()
      : booking.serviceLocation?.trim() || 'Puducherry';

  // Slot display: "2026-09-15 | Morning Slot"
  const timeSlot = booking.slotPeriod
    ? `${booking.slotPeriod} Slot`
    : booking.preferredTime || `Slot ${booking.slotNumber}`;

  // 2. Staff section logic:
  // If 1 staff: show first staff name and mobile.
  // If > 1 staff: show first staff name & phone, plus team list (only names).
  const assignedStaffNames = booking.assignedStaffNames || [];
  const assignedStaffIds = booking.assignedStaffIds || [];

  const firstStaffName = assignedStaffNames[0] || '';
  const firstStaffId = assignedStaffIds[0];

  let primaryStaffPhone = '';
  if (firstStaffId) {
    const found = allStaff.find((s) => s.id === firstStaffId);
    if (found?.mobile && found.mobile.trim()) {
      primaryStaffPhone = found.mobile.trim();
    }
  }
  if (!primaryStaffPhone && firstStaffName) {
    const found = allStaff.find((s) => s.name.toLowerCase() === firstStaffName.toLowerCase());
    if (found?.mobile && found.mobile.trim()) {
      primaryStaffPhone = found.mobile.trim();
    }
  }
  const staffPhoneDisplay = primaryStaffPhone || `${company.mobile} (Office)`;

  let staffLines: string[] = [];
  if (assignedStaffNames.length === 0) {
    staffLines = [
      `👷 Assigned Staff: Team Assigned`,
      `📞 Staff Phone: ${company.mobile} (Office)`,
    ];
  } else if (assignedStaffNames.length === 1) {
    staffLines = [
      `👷 Assigned Staff: ${firstStaffName}`,
      `📞 Staff Phone: ${staffPhoneDisplay}`,
    ];
  } else {
    // More than 1 staff selected: First staff name & phone, and only staff names for the team
    const teamMembersList = assignedStaffNames.join(', ');
    staffLines = [
      `👷 Assigned Staff: ${firstStaffName}`,
      `📞 Staff Phone: ${staffPhoneDisplay}`,
      `👥 Team: ${teamMembersList}`,
    ];
  }

  // 3. Payment & Billing Calculation:
  // When amount is not fixed ("After Visit"), show simply "Amount: After Visit"
  const { isAfterVisit } = formatBookingAmount(booking.amount);
  let paymentLines: string[] = [];

  if (isAfterVisit) {
    paymentLines = [
      `💰 Amount: After Visit`,
    ];
  } else {
    const totalNum = typeof booking.amount === 'number' ? booking.amount : parseFloat(String(booking.amount)) || 0;
    const advNum = Number(booking.advanceAmount) || 0;
    const balNum = booking.balanceAmount !== undefined && booking.balanceAmount !== null
      ? Number(booking.balanceAmount)
      : Math.max(0, totalNum - advNum);

    const balanceText = balNum === 0 && advNum >= totalNum && totalNum > 0
      ? '₹0 (Fully Paid)'
      : `₹${balNum.toLocaleString('en-IN')}`;

    paymentLines = [
      `💰 Total Amount (₹): ₹${totalNum.toLocaleString('en-IN')}`,
      `💵 Advance Paid (₹): ₹${advNum.toLocaleString('en-IN')}`,
      `💳 Balance Due (₹): ${balanceText}`,
    ];
  }

  return [
    `Hello ${customerName},`,
    '',
    `Your booking with MSD Facility Services has been confirmed successfully.`,
    '',
    `📋 Ref No: ${booking.bookingRef}`,
    `🧹 Service: ${service}`,
    ...(booking.serviceDescription ? [`📝 Work Details: ${booking.serviceDescription}`] : []),
    `📅 Date & Time: ${booking.scheduleDate} | ${timeSlot}`,
    `📍 Service Location: ${location}`,
    ...staffLines,
    ...paymentLines,
    '',
    `Thank you for choosing MSD Facility Services!`,
    '',
    `---`,
    '',
    `${company.name}`,
    `📞 ${company.mobile}`,
    `📧 ${company.email}`,
    `🌐 ${company.website.startsWith('http') ? company.website : 'https://' + company.website}`,
  ].join('\n');
}

export function buildStaffWhatsAppMessage(
  booking: Booking,
  staffMember: StaffMember,
  companyInfo?: { name: string; mobile: string; email: string; website: string }
): string {
  const company = companyInfo || {
    name: 'MSD Facility Services',
    mobile: '9042233122',
    email: 'msdfacilityservices@gmail.com',
    website: 'https://msdfs.in/',
  };

  const customerName = booking.customerName?.trim() || 'Customer';
  const customerMobile = booking.customerMobile?.trim() || 'N/A';
  const service = booking.serviceType?.trim() || 'Cleaning Service';

  const location =
    booking.serviceLocation === 'Other' && booking.customLocation
      ? booking.customLocation.trim()
      : booking.serviceLocation?.trim() || 'Puducherry';
  const fullAddress = booking.fullAddress?.trim();

  // Slot display: "2026-09-13 | Evening Slot"
  const timeSlot = booking.slotPeriod
    ? `${booking.slotPeriod} Slot`
    : booking.preferredTime || `Slot ${booking.slotNumber}`;

  // Payment & Billing for staff
  const { isAfterVisit } = formatBookingAmount(booking.amount);
  let paymentLines: string[] = [];

  if (isAfterVisit) {
    paymentLines = [
      `💰 Amount: After Visit`,
    ];
  } else {
    const totalNum = typeof booking.amount === 'number' ? booking.amount : parseFloat(String(booking.amount)) || 0;
    const advNum = Number(booking.advanceAmount) || 0;
    const balNum = booking.balanceAmount !== undefined && booking.balanceAmount !== null
      ? Number(booking.balanceAmount)
      : Math.max(0, totalNum - advNum);

    paymentLines = [
      `💰 Total Amount (₹): ₹${totalNum.toLocaleString('en-IN')}`,
      `💵 Advance Paid (₹): ₹${advNum.toLocaleString('en-IN')}`,
      `💳 Balance to Collect (₹): ${balNum === 0 ? '₹0 (Already Paid)' : `₹${balNum.toLocaleString('en-IN')}`}`,
    ];
  }

  // If multiple staff members are assigned, show team names
  const assignedStaffNames = booking.assignedStaffNames || [];
  const teamSection = assignedStaffNames.length > 1
    ? [`👥 Team: ${assignedStaffNames.join(', ')}`]
    : [];

  return [
    `New Job Assignment (MSD Facility Services):`,
    '',
    `📋 Ref No: ${booking.bookingRef}`,
    `👤 Customer: ${customerName}`,
    `📞 Phone: ${customerMobile}`,
    `📍 Service Location: ${location}`,
    ...(fullAddress ? [`🏠 Full Address: ${fullAddress}`] : []),
    `🧹 Service: ${service}`,
    ...(booking.serviceDescription ? [`📝 Work Details: ${booking.serviceDescription}`] : []),
    `📅 Date & Time: ${booking.scheduleDate} | ${timeSlot}`,
    ...teamSection,
    ...paymentLines,
    '',
    `Please reach on time!`,
    '',
    `---`,
    '',
    `${company.name}`,
    `📞 ${company.mobile}`,
    `📧 ${company.email}`,
    `🌐 ${company.website.startsWith('http') ? company.website : 'https://' + company.website}`,
  ].join('\n');
}

export function formatCustomerWhatsAppMessage(
  booking: Booking,
  template?: string,
  allStaff?: StaffMember[],
  companyInfo?: { name: string; mobile: string; email: string; website: string }
): string {
  if (!template || (allStaff && allStaff.length > 0)) {
    return buildCustomerWhatsAppMessage(booking, allStaff || [], companyInfo);
  }

  const assignedStaffNames = booking.assignedStaffNames || [];
  const firstStaffName = assignedStaffNames[0] || 'Team Assigned';
  const teamNames = assignedStaffNames.join(', ') || firstStaffName;

  const { isAfterVisit } = formatBookingAmount(booking.amount);
  const totalNum = typeof booking.amount === 'number' ? booking.amount : parseFloat(String(booking.amount)) || 0;
  const advNum = Number(booking.advanceAmount) || 0;
  const balNum = booking.balanceAmount !== undefined && booking.balanceAmount !== null
    ? Number(booking.balanceAmount)
    : Math.max(0, totalNum - advNum);

  const totalDisplay = isAfterVisit ? 'After Visit' : `₹${totalNum.toLocaleString('en-IN')}`;
  const advanceDisplay = advNum > 0 ? `₹${advNum.toLocaleString('en-IN')}` : '₹0';
  const balanceDisplay = isAfterVisit
    ? 'After Visit'
    : balNum === 0 && advNum >= totalNum && totalNum > 0
    ? '₹0 (Fully Paid)'
    : `₹${balNum.toLocaleString('en-IN')}`;

  const service = booking.serviceType || '';
  const workDetails = booking.serviceDescription || '';
  const location =
    booking.serviceLocation === 'Other' && booking.customLocation
      ? booking.customLocation.trim()
      : booking.serviceLocation?.trim() || 'Puducherry';
  const address = booking.fullAddress?.trim() || location;
  const timeSlot = booking.slotPeriod ? `${booking.slotPeriod} Slot` : booking.preferredTime || `Slot ${booking.slotNumber}`;

  return template
    .replace(/,\s*Full Address \/ Landmarks:\s*\[Full Address\]/gi, '')
    .replace(/,\s*Full Address:\s*\[Full Address\]/gi, '')
    .replace(/\[Customer Name\]/gi, booking.customerName || 'Customer')
    .replace(/\{CUSTOMER_NAME\}/g, booking.customerName || 'Customer')
    .replace(/\[Booking Reference\]/gi, booking.bookingRef)
    .replace(/\{REF\}/g, booking.bookingRef)
    .replace(/\[Booking Date\]/gi, booking.bookingDate || '')
    .replace(/\[Schedule Date\]/gi, booking.scheduleDate || '')
    .replace(/\{DATE\}/g, booking.scheduleDate || '')
    .replace(/\[Time Slot\]/gi, timeSlot)
    .replace(/\[Time\]/gi, timeSlot)
    .replace(/\{TIME\}/g, timeSlot)
    .replace(/\[Service Name\]/gi, service)
    .replace(/\[Service\]/gi, service)
    .replace(/\{SERVICE\}/g, service)
    .replace(/\[Work Description\]/gi, workDetails)
    .replace(/\[Work Details\]/gi, workDetails)
    .replace(/\{WORK_DETAILS\}/g, workDetails)
    .replace(/\[Service Location\]/gi, location)
    .replace(/\[Location\]/gi, location)
    .replace(/\{LOCATION\}/g, location)
    .replace(/\[Full Address \/ Landmarks\]/gi, address)
    .replace(/\[Full Address\]/gi, address)
    .replace(/\[Address\]/gi, address)
    .replace(/\{ADDRESS\}/g, address)
    .replace(/\[Staff Name\]/gi, firstStaffName)
    .replace(/\[Staff Names\]/gi, teamNames)
    .replace(/\[Staff Phone\]/gi, companyInfo?.mobile || '9042233122')
    .replace(/\[Primary Staff Mobile Number\]/gi, companyInfo?.mobile || '9042233122')
    .replace(/\{STAFF_NAME\}/g, firstStaffName)
    .replace(/\{STAFF_PHONE\}/g, companyInfo?.mobile || '9042233122')
    .replace(/\[Team Members\]/gi, teamNames)
    .replace(/\[Team\]/gi, teamNames)
    .replace(/\{TEAM\}/g, teamNames)
    .replace(/\[Total Amount\]/gi, totalDisplay)
    .replace(/\{TOTAL_AMOUNT\}/g, totalDisplay)
    .replace(/\[Advance Paid\]/gi, advanceDisplay)
    .replace(/\{ADVANCE_PAID\}/g, advanceDisplay)
    .replace(/\[Balance Due\]/gi, balanceDisplay)
    .replace(/\{BALANCE_DUE\}/g, balanceDisplay)
    .replace(/₹?\[Amount\]/gi, totalDisplay)
    .replace(/\{AMOUNT\}/g, totalDisplay);
}

export function formatStaffWhatsAppMessage(
  booking: Booking,
  staffMember: StaffMember,
  template?: string,
  companyInfo?: { name: string; mobile: string; email: string; website: string }
): string {
  if (!template) {
    return buildStaffWhatsAppMessage(booking, staffMember, companyInfo);
  }

  const location =
    booking.serviceLocation === 'Other' && booking.customLocation
      ? booking.customLocation.trim()
      : booking.serviceLocation?.trim() || 'Puducherry';
  const address = booking.fullAddress?.trim() || location;

  const { isAfterVisit } = formatBookingAmount(booking.amount);
  const totalNum = typeof booking.amount === 'number' ? booking.amount : parseFloat(String(booking.amount)) || 0;
  const advNum = Number(booking.advanceAmount) || 0;
  const balNum = booking.balanceAmount !== undefined && booking.balanceAmount !== null
    ? Number(booking.balanceAmount)
    : Math.max(0, totalNum - advNum);

  const totalDisplay = isAfterVisit ? 'After Visit' : `₹${totalNum.toLocaleString('en-IN')}`;
  const advanceDisplay = advNum > 0 ? `₹${advNum.toLocaleString('en-IN')}` : '₹0';
  const balanceDisplay = isAfterVisit
    ? 'After Visit'
    : balNum === 0 && advNum >= totalNum && totalNum > 0
    ? '₹0 (Fully Paid)'
    : `₹${balNum.toLocaleString('en-IN')}`;

  const service = booking.serviceType || '';
  const workDetails = booking.serviceDescription || '';
  const timeSlot = booking.slotPeriod ? `${booking.slotPeriod} Slot` : booking.preferredTime || `Slot ${booking.slotNumber}`;
  const teamNames = booking.assignedStaffNames?.join(', ') || staffMember.name;

  return template
    .replace(/\[Staff Name\]/gi, staffMember.name.replace(/^Mr\.\s*/, ''))
    .replace(/\{STAFF_NAME\}/g, staffMember.name.replace(/^Mr\.\s*/, ''))
    .replace(/\[Booking Reference\]/gi, booking.bookingRef)
    .replace(/\{REF\}/g, booking.bookingRef)
    .replace(/\[Customer Name\]/gi, booking.customerName || '')
    .replace(/\{CUSTOMER_NAME\}/g, booking.customerName || '')
    .replace(/\[Customer Mobile\]/gi, booking.customerMobile || '')
    .replace(/\{CUSTOMER_MOBILE\}/g, booking.customerMobile || '')
    .replace(/\[Service\]/gi, service)
    .replace(/\[Service Name\]/gi, service)
    .replace(/\{SERVICE\}/g, service)
    .replace(/\[Work Details\]/gi, workDetails)
    .replace(/\[Work Description\]/gi, workDetails)
    .replace(/\{WORK_DETAILS\}/g, workDetails)
    .replace(/\[Schedule Date\]/gi, booking.scheduleDate || '')
    .replace(/\{DATE\}/g, booking.scheduleDate || '')
    .replace(/\[Time Slot\]/gi, timeSlot)
    .replace(/\[Time\]/gi, timeSlot)
    .replace(/\{TIME\}/g, timeSlot)
    .replace(/\[Service Location\]/gi, location)
    .replace(/\[Location\]/gi, location)
    .replace(/\{LOCATION\}/g, location)
    .replace(/\[Full Address \/ Landmarks\]/gi, address)
    .replace(/\[Full Address\]/gi, address)
    .replace(/\[Address\]/gi, address)
    .replace(/\{ADDRESS\}/g, address)
    .replace(/\[Team Members\]/gi, teamNames)
    .replace(/\[Team\]/gi, teamNames)
    .replace(/\{TEAM\}/g, teamNames)
    .replace(/\[Total Amount\]/gi, totalDisplay)
    .replace(/\{TOTAL_AMOUNT\}/g, totalDisplay)
    .replace(/\[Advance Paid\]/gi, advanceDisplay)
    .replace(/\{ADVANCE_PAID\}/g, advanceDisplay)
    .replace(/\[Balance Due\]/gi, balanceDisplay)
    .replace(/\{BALANCE_DUE\}/g, balanceDisplay)
    .replace(/₹?\[Amount\]/gi, totalDisplay)
    .replace(/\{AMOUNT\}/g, totalDisplay);
}

export function createWhatsAppWebUrl(phone: string, text: string): string {
  const cleaned = cleanWhatsAppNumber(phone);
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
}

// Export Customer and Multi-Device Sync Services
export * from './customerService';
export * from './syncService';

// Sync Booking directly to Google Sheet via Google Apps Script Web App
export async function syncBookingToGoogleSheet(
  booking: Booking,
  webAppUrl?: string
): Promise<{ success: boolean; message: string; remoteSaved?: boolean }> {
  if (!webAppUrl || !webAppUrl.trim().startsWith('http')) {
    return {
      success: true,
      remoteSaved: false,
      message: 'Booking saved safely to local database. (Configure Google Sheet Web App URL in Settings for instant cloud synchronization)',
    };
  }

  const result = await pushBookingToCloud(booking, 'UPDATE', webAppUrl);
  return {
    success: result.success,
    remoteSaved: !result.queued,
    message: result.message,
  };
}

// Google Sheets CSV Exporter with WhatsApp Status Columns
export function exportGoogleSheetCSV(bookings: Booking[], staffList?: StaffMember[]): string {
  return exportBookingsGoogleSheetCSV(bookings);
}

// Google Apps Script generator code
export function getGoogleAppsScriptTemplate(): string {
  return getFreshGoogleAppsScriptTemplate();
}

export { cleanGoogleSheetDuplicates } from './syncService';
