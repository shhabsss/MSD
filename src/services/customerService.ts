import { Booking, Customer } from '../types';

const STORAGE_KEY_CUSTOMERS = 'msd_customers_v1';

/**
 * Normalizes any phone format (+91 9876543210, 09876543210, 98765 43210, etc.)
 * to standard 10-digit mobile number for reliable cross-device customer matching.
 */
export function normalizePhoneNumber(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = String(phone).replace(/[^\d]/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

/**
 * Formats a 10-digit phone number cleanly for Indian mobile display: "98765 43210"
 */
export function formatPhoneNumber(phone: string | undefined | null): string {
  const norm = normalizePhoneNumber(phone);
  if (norm.length === 10) {
    return `${norm.slice(0, 5)} ${norm.slice(5)}`;
  }
  return phone ? String(phone).trim() : '';
}

/**
 * Loads stored customers from localStorage, or seeds from existing bookings
 */
export function getStoredCustomers(existingBookings: Booking[] = []): Customer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOMERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load customers from storage:', err);
  }

  // If no customers stored, derive automatically from existing bookings
  if (existingBookings && existingBookings.length > 0) {
    const seeded = seedCustomersFromBookings(existingBookings);
    saveStoredCustomers(seeded);
    return seeded;
  }

  return [];
}

/**
 * Persists customers to localStorage
 */
export function saveStoredCustomers(customers: Customer[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(customers));
  } catch (err) {
    console.error('Failed to save customers to storage:', err);
  }
}

export const loadCustomers = getStoredCustomers;
export const saveCustomers = saveStoredCustomers;

/**
 * Seeds customers from an array of bookings, aggregating booking count & latest dates
 */
export function seedCustomersFromBookings(bookings: Booking[]): Customer[] {
  const customerMap = new Map<string, Customer>();

  // Process oldest to newest so newest information takes precedence
  const sorted = [...bookings].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  for (const b of sorted) {
    const mobileNorm = normalizePhoneNumber(b.customerMobile);
    if (!mobileNorm) continue;

    const existing = customerMap.get(mobileNorm);
    const bookingDate = b.scheduleDate || b.bookingDate || new Date().toISOString().split('T')[0];

    if (!existing) {
      customerMap.set(mobileNorm, {
        id: `cust_${mobileNorm}`,
        name: (b.customerName || 'Customer').trim(),
        mobile: mobileNorm,
        alternateMobile: b.alternateMobile || (b.customerWhatsApp !== b.customerMobile ? b.customerWhatsApp : ''),
        location: b.serviceLocation === 'Other' && b.customLocation ? b.customLocation : b.serviceLocation || 'Puducherry',
        fullAddress: b.fullAddress || '',
        totalBookings: 1,
        lastBookingDate: bookingDate,
        lastService: b.serviceType,
        lastAmount: b.amount,
        createdAt: b.createdAt || new Date().toISOString(),
        updatedAt: b.updatedAt || new Date().toISOString(),
      });
    } else {
      existing.totalBookings += 1;
      if (b.customerName && b.customerName.trim().length > 2) {
        existing.name = b.customerName.trim();
      }
      if (b.fullAddress && b.fullAddress.trim().length > 3) {
        existing.fullAddress = b.fullAddress.trim();
      }
      if (b.serviceLocation) {
        existing.location = b.serviceLocation === 'Other' && b.customLocation ? b.customLocation : b.serviceLocation;
      }
      if (bookingDate >= (existing.lastBookingDate || '')) {
        existing.lastBookingDate = bookingDate;
        existing.lastService = b.serviceType;
        existing.lastAmount = b.amount;
      }
      if (b.alternateMobile || b.customerWhatsApp) {
        existing.alternateMobile = b.alternateMobile || b.customerWhatsApp;
      }
      existing.updatedAt = b.updatedAt || new Date().toISOString();
    }
  }

  return Array.from(customerMap.values());
}

/**
 * Searches the customer database by mobile or partial name (case-insensitive)
 */
export function searchCustomers(query: string, customers: Customer[]): Customer[] {
  if (!query || !query.trim()) return [];

  const q = query.trim().toLowerCase();
  const qDigits = q.replace(/[^\d]/g, '');

  return customers
    .filter((c) => {
      // Mobile match (exact or substring)
      if (qDigits && c.mobile.includes(qDigits)) {
        return true;
      }
      if (qDigits && c.alternateMobile && normalizePhoneNumber(c.alternateMobile).includes(qDigits)) {
        return true;
      }
      // Name match (case-insensitive substring)
      if (c.name && c.name.toLowerCase().includes(q)) {
        return true;
      }
      // Location match
      if (c.location && c.location.toLowerCase().includes(q)) {
        return true;
      }
      // Address match
      if (c.fullAddress && c.fullAddress.toLowerCase().includes(q)) {
        return true;
      }
      return false;
    })
    .sort((a, b) => {
      // Prioritize exact mobile match
      if (qDigits) {
        const aExact = a.mobile === qDigits;
        const bExact = b.mobile === qDigits;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStarts = a.mobile.startsWith(qDigits);
        const bStarts = b.mobile.startsWith(qDigits);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
      }

      // Prioritize name starts with
      const aNameStarts = a.name.toLowerCase().startsWith(q);
      const bNameStarts = b.name.toLowerCase().startsWith(q);
      if (aNameStarts && !bNameStarts) return -1;
      if (!aNameStarts && bNameStarts) return 1;

      // Then by total bookings descending (most active customers first)
      return (b.totalBookings || 0) - (a.totalBookings || 0);
    });
}

/**
 * Retrieves all previous bookings for a customer (by mobile number)
 * Preserves cancelled bookings as requested: Never deletes customer history
 */
export function getCustomerHistory(customerMobile: string, allBookings: Booking[]): Booking[] {
  const norm = normalizePhoneNumber(customerMobile);
  if (!norm) return [];

  return allBookings
    .filter((b) => normalizePhoneNumber(b.customerMobile) === norm)
    .sort((a, b) => (b.scheduleDate || b.bookingDate || '').localeCompare(a.scheduleDate || a.bookingDate || ''));
}

/**
 * Upserts a customer record when a booking is created or edited.
 * If customer exists (by mobile number), updates details & history without creating duplicates.
 */
export function upsertCustomerFromBooking(
  first: Booking | Customer[],
  second: Booking | Customer[]
): { updatedCustomers: Customer[]; customer: Customer } {
  const booking = (Array.isArray(first) ? second : first) as Booking;
  const existingCustomers = (Array.isArray(first) ? first : second) as Customer[];
  const normMobile = normalizePhoneNumber(booking.customerMobile);
  const now = new Date().toISOString();
  const bookingDate = booking.scheduleDate || booking.bookingDate || now.split('T')[0];

  const loc =
    booking.serviceLocation === 'Other' && booking.customLocation
      ? booking.customLocation.trim()
      : booking.serviceLocation?.trim() || 'Puducherry';

  const altMobile = booking.alternateMobile || (booking.customerWhatsApp !== booking.customerMobile ? booking.customerWhatsApp : undefined);

  let targetCustomer: Customer | undefined = existingCustomers.find(
    (c) => normalizePhoneNumber(c.mobile) === normMobile
  );

  let updatedList: Customer[];

  if (targetCustomer) {
    const updatedCustomer: Customer = {
      ...targetCustomer,
      name: booking.customerName?.trim() || targetCustomer.name,
      mobile: normMobile,
      alternateMobile: altMobile || targetCustomer.alternateMobile,
      location: loc || targetCustomer.location,
      fullAddress: booking.fullAddress?.trim() || targetCustomer.fullAddress,
      totalBookings: (targetCustomer.totalBookings || 0) + 1,
      lastBookingDate: bookingDate,
      lastService: booking.serviceType || targetCustomer.lastService,
      lastAmount: booking.amount !== undefined ? booking.amount : targetCustomer.lastAmount,
      updatedAt: now,
    };

    updatedList = existingCustomers.map((c) =>
      c.id === targetCustomer!.id || normalizePhoneNumber(c.mobile) === normMobile ? updatedCustomer : c
    );
    targetCustomer = updatedCustomer;
  } else {
    const newCustomer: Customer = {
      id: `cust_${normMobile || Date.now()}`,
      name: booking.customerName?.trim() || 'New Customer',
      mobile: normMobile,
      alternateMobile: altMobile,
      location: loc,
      fullAddress: booking.fullAddress?.trim() || '',
      totalBookings: 1,
      lastBookingDate: bookingDate,
      lastService: booking.serviceType,
      lastAmount: booking.amount,
      createdAt: now,
      updatedAt: now,
    };

    updatedList = [newCustomer, ...existingCustomers];
    targetCustomer = newCustomer;
  }

  saveStoredCustomers(updatedList);
  return { updatedCustomers: updatedList, customer: targetCustomer };
}

/**
 * Generates CSV string for Customers table in Google Sheets (12 columns)
 */
export function exportCustomersGoogleSheetCSV(customers: Customer[]): string {
  const headers = [
    'Customer ID',
    'Customer Name',
    'Mobile',
    'Alternate Mobile',
    'Email',
    'Location',
    'Full Address',
    'Total Bookings',
    'Last Booking Date',
    'Last Service',
    'Created At',
    'Updated At',
  ];

  const rows = customers.map((c) => [
    c.id,
    c.name,
    c.mobile,
    c.alternateMobile || '',
    c.email || '',
    c.location,
    c.fullAddress,
    c.totalBookings || 0,
    c.lastBookingDate || '',
    c.lastService || '',
    c.createdAt,
    c.updatedAt,
  ].map((field) => {
    const str = String(field ?? '').replace(/"/g, '""');
    return `"${str}"`;
  }).join(','));

  return [headers.join(','), ...rows].join('\n');
}
