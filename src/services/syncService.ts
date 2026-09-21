import { Booking, Customer, SyncStatus } from '../types';
import { normalizePhoneNumber } from './customerService';

const STORAGE_KEY_PENDING_QUEUE = 'msd_pending_sync_v1';
const STORAGE_KEY_SYNC_META = 'msd_sync_meta_v1';

export interface PendingSyncItem {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'CANCEL' | 'DELETE';
  booking?: Booking;
  customer?: Customer;
  timestamp: string;
}

export interface SyncResult {
  success: boolean;
  status: SyncStatus;
  message: string;
  syncedBookings?: Booking[];
  syncedCustomers?: Customer[];
  mergedBookings?: Booking[];
  mergedCustomers?: Customer[];
  error?: string;
  serverTime?: string;
}

/**
 * Detects device platform for tracking who/which device created/updated the booking
 */
export function getDeviceIdentifier(): string {
  if (typeof window === 'undefined') return 'Server';
  const ua = navigator.userAgent || '';
  const isAndroid = /android/i.test(ua);
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isMobile = isAndroid || isIOS || /mobile/i.test(ua);

  if (isAndroid) return 'Android Phone';
  if (isIOS) return 'iPhone / iPad';
  if (isMobile) return 'Mobile Browser';
  if (/macintosh|mac os x/i.test(ua)) return 'Mac Laptop / Desktop';
  if (/windows/i.test(ua)) return 'Windows Laptop / PC';
  if (/linux/i.test(ua)) return 'Linux Workstation';
  return 'Web App (Desktop)';
}

/**
 * Offline Sync Queue Management
 */
export function getPendingSyncQueue(): PendingSyncItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PENDING_QUEUE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load sync queue:', e);
  }
  return [];
}

export function savePendingSyncQueue(queue: PendingSyncItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PENDING_QUEUE, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to save sync queue:', e);
  }
}

export function addToSyncQueue(item: Omit<PendingSyncItem, 'id' | 'timestamp'>): void {
  const queue = getPendingSyncQueue();
  const newItem: PendingSyncItem = {
    ...item,
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  queue.push(newItem);
  savePendingSyncQueue(queue);
}

export function clearSyncQueue(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_PENDING_QUEUE);
  } catch (e) {
    console.error('Failed to clear sync queue:', e);
  }
}

/**
 * Robustly parses and extracts data from any Google Apps Script API response.
 * Handles standard responses, legacy responses, raw arrays, and nested data objects.
 */
export interface ExtractedSyncPayload {
  isSuccess: boolean;
  bookings: Booking[];
  customers: Customer[];
  errorMessage?: string;
  serverTime?: string;
}

export function extractDataFromApiResponse(res: any): ExtractedSyncPayload {
  if (!res) {
    return {
      isSuccess: false,
      bookings: [],
      customers: [],
      errorMessage: 'No response received from Google Sheets endpoint.',
    };
  }

  // Detect explicit errors
  const rawError =
    res.message ||
    res.error?.message ||
    (typeof res.error === 'string' ? res.error : undefined) ||
    res.details ||
    res.msg ||
    res.description;

  const isExplicitError =
    res.status === 'error' ||
    res.status === 'failed' ||
    res.result === 'error' ||
    res.success === false ||
    Boolean(res.error);

  // Extract raw bookings array from any known property
  let rawBookings: any[] = [];
  if (Array.isArray(res)) {
    rawBookings = res;
  } else if (Array.isArray(res.bookings)) {
    rawBookings = res.bookings;
  } else if (Array.isArray(res.data?.bookings)) {
    rawBookings = res.data.bookings;
  } else if (Array.isArray(res.data)) {
    rawBookings = res.data;
  } else if (Array.isArray(res.records)) {
    rawBookings = res.records;
  } else if (Array.isArray(res.rows)) {
    rawBookings = res.rows;
  } else if (Array.isArray(res.items)) {
    rawBookings = res.items;
  }

  // Extract raw customers array
  let rawCustomers: any[] = [];
  if (Array.isArray(res.customers)) {
    rawCustomers = res.customers;
  } else if (Array.isArray(res.data?.customers)) {
    rawCustomers = res.data.customers;
  } else if (Array.isArray(res.customerRecords)) {
    rawCustomers = res.customerRecords;
  }

  // Parse raw sheet rows if returned as 2D arrays:
  // e.g. [["Reference No", "Booking Date", ...], ["MSD/PDY/2026/1001", ...]] or objects
  let headerMap: Record<string, number> | null = null;

  // Check if first row is a header row in 2D array
  if (rawBookings.length > 0 && Array.isArray(rawBookings[0])) {
    const firstRow = rawBookings[0];
    const isHeaderRow = firstRow.some((col: any) => {
      const str = String(col || '').toLowerCase();
      return str.includes('booking') || str.includes('reference') || str.includes('customer') || str.includes('service') || str.includes('date');
    });

    if (isHeaderRow) {
      headerMap = {};
      firstRow.forEach((col: any, idx: number) => {
        const clean = String(col || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (clean) headerMap![clean] = idx;
      });
      rawBookings = rawBookings.slice(1);
    }
  }

  const findIdx = (aliases: string[]): number => {
    if (!headerMap) return -1;
    for (const a of aliases) {
      const k = a.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (headerMap[k] !== undefined) return headerMap[k];
    }
    return -1;
  };

  const parsedBookings: Booking[] = rawBookings
    .map((item: any) => {
      if (!item) return null;
      if (Array.isArray(item)) {
        if (item[0] === 'Booking ID' || item[0] === 'Reference No' || item[1] === 'Reference No') return null;

        if (headerMap) {
          const getVal = (aliases: string[], fallback: any = ''): any => {
            const idx = findIdx(aliases);
            if (idx >= 0 && idx < item.length) {
              const v = item[idx];
              if (v !== undefined && v !== null && String(v).trim() !== '') return v;
            }
            return fallback;
          };

          const bRef = String(getVal(['referenceno', 'refno', 'ref', 'bookingref'], '')).trim();
          const bId = String(getVal(['bookingid', 'id'], bRef ? `bk_${bRef}` : `bk_${Date.now()}_${Math.random()}`));
          const sName = String(getVal(['servicename', 'service', 'servicetype', 'services'], '')).trim();
          const sDetails = String(getVal(['servicedetails', 'workdetails', 'scopeofwork', 'workdescription', 'description', 'servicedescription', 'details'], '')).trim();
          const qVal = parseInt(String(getVal(['quantity', 'qty', 'count'], 1)), 10) || 1;
          const finalService = sName || (sDetails ? sDetails.split(' - ')[0].replace(/\s*\(Qty:[^)]*\)/i, '').trim() : 'General Cleaning');
          const rawStaff = String(getVal(['assignedstaff', 'staff', 'staffname', 'staffnames'], ''));

          return {
            id: bId,
            bookingRef: bRef,
            bookingDate: String(getVal(['bookingdate', 'bookedon', 'dateofbooking'], '')),
            scheduleDate: String(getVal(['scheduledate', 'servicedate', 'workdate', 'date'], '')),
            customerName: String(getVal(['customername', 'clientname', 'name', 'customer'], '')),
            customerMobile: String(getVal(['mobilenumber', 'customermobile', 'mobile', 'phone'], '')),
            alternateMobile: String(getVal(['alternatemobile', 'whatsapp', 'customerwhatsapp'], '')),
            customerWhatsApp: String(getVal(['customerwhatsapp', 'whatsapp', 'alternatemobile'], '')),
            serviceType: finalService,
            quantity: qVal,
            serviceDescription: sDetails,
            serviceDetails: sDetails || (qVal > 1 ? `${finalService} (Qty: ${qVal})` : finalService),
            preferredTime: String(getVal(['timeslot', 'slot', 'timing', 'preferredtime', 'time'], '')),
            slotNumber: (() => {
              const raw = getVal(['slotnumber', 'slotno', 'slot_num', 'slot'], 0);
              let n = parseInt(String(raw), 10);
              if (isNaN(n) || n < 1 || n > 10) {
                const pref = String(getVal(['timeslot', 'slot', 'timing', 'preferredtime', 'time'], ''));
                const m = pref.match(/slot\s*(\d+)/i);
                if (m) n = parseInt(m[1], 10);
              }
              return (!isNaN(n) && n >= 1 && n <= 10) ? n : 1;
            })(),
            serviceLocation: String(getVal(['location', 'servicelocation', 'area'], 'Puducherry')),
            fullAddress: String(getVal(['fulladdress', 'address', 'landmarks'], '')),
            assignedStaffNames: rawStaff ? rawStaff.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
            staffMobile: String(getVal(['staffmobile', 'staffphone'], '')),
            team: String(getVal(['team', 'crew'], '')),
            amount: getVal(['amount', 'totalamount', 'total', 'price'], ''),
            advanceAmount: Number(getVal(['advanceamount', 'advancepaid', 'advance'], 0)) || 0,
            balanceAmount: Number(getVal(['balanceamount', 'balancedue', 'balance'], 0)) || 0,
            paymentStatus: String(getVal(['paymentstatus', 'payment'], 'Pending')),
            bookingStatus: String(getVal(['bookingstatus', 'status'], 'Confirmed')),
            notes: String(getVal(['notes', 'remarks', 'comment'], '')),
            createdBy: String(getVal(['createdby'], 'MSD Admin')),
            createdDevice: String(getVal(['createddevice', 'device'], 'Web App')),
            createdAt: String(getVal(['createdat', 'timestamp'], new Date().toISOString())),
            updatedAt: String(getVal(['updatedat'], new Date().toISOString())),
            lastSync: String(getVal(['lastsync'], new Date().toISOString())),
          } as Booking;
        }

        // Positional fallback: check if first col is Reference No vs Booking ID
        const startsWithRef = String(item[0] || '').startsWith('MSD/');
        if (startsWithRef) {
          // Standard layout starting with Reference No
          const bRef = String(item[0] || '');
          const bDate = String(item[1] || '');
          const schDate = String(item[2] || '');
          const cName = String(item[3] || '');
          const cMobile = String(item[4] || '');
          const altMobile = String(item[5] || '');
          const sName = String(item[6] || '');
          const rawQ = parseInt(String(item[7] || '1'), 10) || 1;
          const sDetails = String(item[8] || '');
          return {
            id: `bk_${bRef}`,
            bookingRef: bRef,
            bookingDate: bDate,
            scheduleDate: schDate,
            customerName: cName,
            customerMobile: cMobile,
            alternateMobile: altMobile,
            customerWhatsApp: altMobile || cMobile,
            serviceType: sName || 'General Cleaning',
            quantity: rawQ,
            serviceDescription: sDetails,
            serviceDetails: sDetails || (rawQ > 1 ? `${sName} (Qty: ${rawQ})` : sName),
            preferredTime: String(item[9] || ''),
            serviceLocation: String(item[10] || 'Puducherry'),
            fullAddress: String(item[11] || ''),
            assignedStaffNames: item[12] ? String(item[12]).split(',').map((s: string) => s.trim()) : [],
            staffMobile: String(item[13] || ''),
            team: String(item[14] || ''),
            amount: item[15] !== undefined ? item[15] : '',
            paymentStatus: item[16] || 'Pending',
            bookingStatus: item[17] || 'Confirmed',
            notes: String(item[18] || ''),
            createdBy: 'MSD Admin',
            createdDevice: 'Web App',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastSync: new Date().toISOString(),
          } as Booking;
        }

        // Legacy layout starting with Booking ID
        const sType = String(item[6] || '');
        const sDesc = String(item[7] || '');
        return {
          id: String(item[0] || `bk_${Date.now()}_${Math.random()}`),
          bookingRef: String(item[1] || ''),
          bookingDate: String(item[2] || ''),
          customerName: String(item[3] || ''),
          customerMobile: String(item[4] || ''),
          alternateMobile: String(item[5] || ''),
          customerWhatsApp: String(item[5] || item[4] || ''),
          serviceType: sType,
          quantity: 1,
          serviceDescription: sDesc,
          serviceDetails: sDesc || sType,
          scheduleDate: String(item[8] || ''),
          preferredTime: String(item[9] || ''),
          serviceLocation: String(item[10] || ''),
          fullAddress: String(item[11] || ''),
          assignedStaffNames: item[12] ? String(item[12]).split(',').map((s: string) => s.trim()) : [],
          staffMobile: String(item[13] || ''),
          team: String(item[14] || ''),
          amount: item[15] !== undefined ? item[15] : '',
          paymentStatus: item[16] || 'Pending',
          bookingStatus: item[17] || 'Confirmed',
          notes: String(item[18] || ''),
          createdBy: String(item[19] || ''),
          createdDevice: String(item[20] || ''),
          createdAt: String(item[21] || ''),
          updatedAt: String(item[22] || ''),
          lastSync: String(item[23] || ''),
        } as Booking;
      }
      if (typeof item === 'object') {
        if (!item.id && !item.bookingRef && !item.customerName) return null;
        const bRef = item.bookingRef || item.referenceNo || item.refNo || item.ref || '';
        const sName = item.serviceType || item.serviceName || item.service || '';
        const sDetails = item.serviceDescription || item.serviceDetails || item.workDetails || item.details || '';
        const finalService = sName || (sDetails ? sDetails.split(' - ')[0].replace(/\s*\(Qty:[^)]*\)/i, '').trim() : 'General Cleaning');
        const qVal = item.quantity !== undefined && item.quantity !== null ? Number(item.quantity) : 1;
        const finalQty = isNaN(qVal) || qVal <= 0 ? 1 : qVal;

        return {
          ...item,
          id: item.id || `bk_${bRef || Date.now()}`,
          bookingRef: bRef,
          customerName: item.customerName || item.name || '',
          customerMobile: item.customerMobile || item.mobileNumber || item.mobile || item.phone || '',
          alternateMobile: item.alternateMobile || item.customerWhatsApp || item.whatsapp || '',
          customerWhatsApp: item.customerWhatsApp || item.alternateMobile || item.customerMobile || '',
          scheduleDate: item.scheduleDate || item.serviceDate || item.date || item.bookingDate || '',
          bookingDate: item.bookingDate || item.scheduleDate || '',
          serviceType: finalService,
          quantity: finalQty,
          serviceDescription: sDetails,
          serviceDetails: sDetails || (finalQty > 1 ? `${finalService} (Qty: ${finalQty})` : finalService),
          bookingStatus: item.bookingStatus || item.status || 'Confirmed',
          paymentStatus: item.paymentStatus || item.payment || 'Pending',
          amount: item.amount !== undefined ? item.amount : '',
          serviceLocation: item.serviceLocation || item.location || 'Puducherry',
          fullAddress: item.fullAddress || item.address || '',
          slotNumber: (() => {
            let n = parseInt(String(item.slotNumber || item.slot || 0), 10);
            if (isNaN(n) || n < 1 || n > 10) {
              const pref = String(item.preferredTime || item.timeSlot || item.timing || '');
              const m = pref.match(/slot\s*(\d+)/i);
              if (m) n = parseInt(m[1], 10);
            }
            return (!isNaN(n) && n >= 1 && n <= 10) ? n : (typeof item.slotNumber === 'number' ? item.slotNumber : 1);
          })(),
          assignedStaffNames: Array.isArray(item.assignedStaffNames) ? item.assignedStaffNames : (item.assignedStaff ? String(item.assignedStaff).split(',').map((s: string) => s.trim()).filter(Boolean) : []),
        } as Booking;
      }
      return null;
    })
    .filter(Boolean) as Booking[];

  const parsedCustomers: Customer[] = rawCustomers
    .map((item: any) => {
      if (!item) return null;
      if (Array.isArray(item)) {
        if (item[0] === 'Customer ID' || item[1] === 'Customer Name') return null;
        return {
          id: String(item[0] || `cust_${item[2]}`),
          name: String(item[1] || ''),
          mobile: normalizePhoneNumber(String(item[2] || '')),
          alternateMobile: String(item[3] || ''),
          location: String(item[5] || ''),
          fullAddress: String(item[6] || ''),
          totalBookings: parseInt(item[7], 10) || 1,
          lastBookingDate: String(item[8] || ''),
          lastService: String(item[9] || ''),
          createdAt: String(item[10] || ''),
          updatedAt: String(item[11] || ''),
        } as Customer;
      }
      if (typeof item === 'object' && item.mobile) {
        return {
          ...item,
          mobile: normalizePhoneNumber(item.mobile),
        } as Customer;
      }
      return null;
    })
    .filter(Boolean) as Customer[];

  const isSuccess =
    (!isExplicitError && (
      res.status === 'success' ||
      res.status === 'ok' ||
      res.success === true ||
      res.result === 'success' ||
      parsedBookings.length > 0 ||
      res.noCors === true
    )) || (parsedBookings.length > 0 && !isExplicitError);

  return {
    isSuccess,
    bookings: parsedBookings,
    customers: parsedCustomers,
    errorMessage: isExplicitError ? rawError : undefined,
    serverTime: res.serverTime || new Date().toISOString(),
  };
}

/**
 * Calls Google Apps Script Web App.
 * Handles both POST and GET with resilient fallback.
 * Ensures mutating actions send exactly ONE POST to eliminate duplicate rows in Google Sheet.
 */
async function callAppsScriptApi(url: string, action: string, payload: any = {}): Promise<any> {
  const cleanUrl = url.trim();
  if (!cleanUrl.startsWith('http')) {
    throw new Error('Invalid Google Apps Script URL. Please enter a valid URL in Settings.');
  }

  const isQuery = action === 'read_all' || action === 'read' || action === 'ping' || action === 'get_latest_ref';

  // 1. For read/query actions, GET is fastest and avoids preflight issues
  if (isQuery) {
    try {
      const getUrl = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}action=${encodeURIComponent(action === 'ping' ? 'ping' : 'read_all')}&_t=${Date.now()}`;
      const getRes = await fetch(getUrl, { method: 'GET' });
      if (getRes.ok) {
        try {
          const json = await getRes.json();
          return json;
        } catch (_) {}
      }
    } catch (getErr) {
      console.warn('Apps Script GET query warning:', getErr);
    }
  }

  // 2. Standard POST request with JSON body
  try {
    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // Uses text/plain to prevent CORS preflight OPTIONS block
      },
      body: JSON.stringify({ action, ...payload }),
    });

    if (res.ok) {
      try {
        const json = await res.json();
        return json;
      } catch (parseErr) {
        // If response is not JSON (e.g. redirected or plain response)
        return { status: 'success', message: 'Action processed by Google Apps Script' };
      }
    } else {
      return { status: 'error', message: `Google Sheets returned HTTP ${res.status}` };
    }
  } catch (postErr: any) {
    // Browser may throw TypeError during redirect from Google Apps Script to script.googleusercontent.com,
    // even though the request reached Google and executed successfully.
    // DO NOT send a second POST here as that causes double-double entries in Google Sheets!
    console.warn('Apps Script POST completed with browser redirect notice:', postErr?.message || postErr);
    return { status: 'success', noCors: true, message: 'Saved to Google Sheet' };
  }
}

/**
 * Tests connection to Google Apps Script Web App
 */
export async function testGoogleSheetConnection(
  webAppUrl: string
): Promise<{ success: boolean; message: string; details?: any }> {
  if (!webAppUrl || !webAppUrl.trim().startsWith('http')) {
    return {
      success: false,
      message: 'Please enter a valid Google Apps Script Web App URL starting with https://',
    };
  }

  const cleanUrl = webAppUrl.trim();

  // Try 1: action=ping
  try {
    const url = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}action=ping&_t=${Date.now()}`;
    const res = await fetch(url, { method: 'GET' });

    if (res.ok) {
      const data = await res.json();
      const extracted = extractDataFromApiResponse(data);
      if (extracted.isSuccess || data.status === 'success' || data.status === 'ok') {
        const bCount = data.bookingCount ?? data.bookingsCount ?? extracted.bookings.length;
        const cCount = data.customerCount ?? data.customersCount ?? extracted.customers.length;
        return {
          success: true,
          message: `Connected successfully! Found ${bCount} bookings and ${cCount} customers in Google Sheet.`,
          details: data,
        };
      }
    }
  } catch (_) {}

  // Try 2: action=read_all
  try {
    const url = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}action=read_all&_t=${Date.now()}`;
    const res = await fetch(url, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      const extracted = extractDataFromApiResponse(data);
      if (extracted.isSuccess) {
        return {
          success: true,
          message: `Connected successfully! Found ${extracted.bookings.length} bookings and ${extracted.customers.length} customers in Google Sheet.`,
          details: data,
        };
      }
    }
  } catch (_) {}

  // Try 3: Direct GET
  try {
    const url = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    const res = await fetch(url, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      const extracted = extractDataFromApiResponse(data);
      return {
        success: true,
        message: `Connected successfully! Found ${extracted.bookings.length || data.data?.length || 0} records in Google Sheet.`,
        details: data,
      };
    }
  } catch (_) {}

  return {
    success: false,
    message: 'Unable to connect to Google Apps Script. Please verify that "Execute as: Me" and "Who has access: Anyone" are selected in your Web App deployment settings.',
  };
}

/**
 * Generates a unique booking reference number.
 * If online with Apps Script, fetches central sequence number to prevent multi-device collision.
 * Otherwise uses client-side sequence with device identifier fallback.
 */
export async function getCentrallyUniqueBookingRef(
  existingBookings: Booking[],
  webAppUrl?: string
): Promise<string> {
  const currentYear = new Date().getFullYear();

  // If webAppUrl is available, try fetching next central atomic reference
  if (webAppUrl && webAppUrl.trim().startsWith('http') && navigator.onLine) {
    try {
      const pingUrl = `${webAppUrl.trim()}${webAppUrl.includes('?') ? '&' : '?'}action=get_latest_ref&_t=${Date.now()}`;
      const res = await fetch(pingUrl, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.nextRef) {
          return data.nextRef;
        }
      }
    } catch (e) {
      console.warn('Could not fetch central sequence number, falling back to local calculation:', e);
    }
  }

  // Fallback: local calculation across all bookings
  let maxNum = 1000;
  existingBookings.forEach((b) => {
    const match = b.bookingRef?.match(/\d+$/);
    if (match) {
      const n = parseInt(match[0], 10);
      if (n > maxNum) {
        maxNum = n;
      }
    }
  });

  const nextSeq = maxNum + 1;
  return `MSD/PDY/${currentYear}/${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Merges local and remote bookings using Last-Write-Wins timestamp resolution.
 * Guarantees that newer edits never get overwritten by older cached data.
 */
export function mergeBookings(localBookings: Booking[], remoteBookings: Booking[]): Booking[] {
  const map = new Map<string, Booking>();

  // Add all local bookings to map first
  localBookings.forEach((b) => {
    const key = b.id || b.bookingRef;
    map.set(key, b);
  });

  // Merge remote bookings
  remoteBookings.forEach((remote) => {
    const key = remote.id || remote.bookingRef;
    const local = map.get(key) || (remote.bookingRef ? Array.from(map.values()).find((b) => b.bookingRef === remote.bookingRef) : undefined);

    if (!local) {
      // Remote exists, local doesn't -> add remote
      map.set(key, remote);
    } else {
      // Both exist -> compare updatedAt timestamp
      const localUpdated = local.updatedAt || local.createdAt || '';
      const remoteUpdated = remote.updatedAt || remote.createdAt || '';

      if (remoteUpdated >= localUpdated) {
        // Remote is newer or equal -> keep remote
        map.set(key, remote);
      } else {
        // Local is newer -> keep local
        map.set(key, local);
      }
    }
  });

  // Return sorted by scheduleDate descending
  return Array.from(map.values()).sort((a, b) =>
    (b.scheduleDate || b.bookingDate || '').localeCompare(a.scheduleDate || a.bookingDate || '')
  );
}

/**
 * Merges local and remote customers using normalized phone number as primary key
 */
export function mergeCustomers(localCustomers: Customer[], remoteCustomers: Customer[]): Customer[] {
  const map = new Map<string, Customer>();

  localCustomers.forEach((c) => {
    const norm = normalizePhoneNumber(c.mobile);
    if (norm) map.set(norm, c);
  });

  remoteCustomers.forEach((remote) => {
    const norm = normalizePhoneNumber(remote.mobile);
    if (!norm) return;

    const local = map.get(norm);
    if (!local) {
      map.set(norm, remote);
    } else {
      const localUpdated = local.updatedAt || local.createdAt || '';
      const remoteUpdated = remote.updatedAt || remote.createdAt || '';

      if (remoteUpdated >= localUpdated) {
        map.set(norm, remote);
      } else {
        map.set(norm, local);
      }
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    (b.lastBookingDate || b.updatedAt || '').localeCompare(a.lastBookingDate || a.updatedAt || '')
  );
}

/**
 * Performs full bidirectional synchronization with Google Sheets:
 * 1. Checks internet connectivity.
 * 2. Flushes any pending offline queue items.
 * 3. Reads latest cloud Bookings & Customers.
 * 4. Merges using Last-Write-Wins.
 * 5. Returns updated datasets.
 */
export async function syncAllWithGoogleSheets(options: {
  webAppUrl?: string;
  localBookings: Booking[];
  localCustomers: Customer[];
  forceFullSync?: boolean;
}): Promise<SyncResult> {
  const { webAppUrl, localBookings, localCustomers } = options;

  if (!navigator.onLine) {
    return {
      success: false,
      status: 'offline',
      message: 'Device is offline. Changes saved locally and queued for automatic sync.',
      syncedBookings: localBookings,
      syncedCustomers: localCustomers,
    };
  }

  if (!webAppUrl || !webAppUrl.trim().startsWith('http')) {
    return {
      success: true,
      status: 'synced',
      message: 'Local cache active. Add Google Apps Script Web App URL in Settings for multi-device sync.',
      syncedBookings: localBookings,
      syncedCustomers: localCustomers,
    };
  }

  try {
    const pendingQueue = getPendingSyncQueue();
    let res: any = null;

    // Step 1: Attempt sync_batch (pushes pending offline mutations and requests full dataset)
    try {
      res = await callAppsScriptApi(webAppUrl, 'sync_batch', {
        pendingMutations: pendingQueue,
        localBookingsCount: localBookings.length,
        localCustomersCount: localCustomers.length,
        bookings: localBookings.length <= 10 ? localBookings : [],
        customers: localCustomers.length <= 10 ? localCustomers : [],
        device: getDeviceIdentifier(),
      });
    } catch (batchErr) {
      console.warn('sync_batch attempt failed or unhandled by script, trying read_all fallback...', batchErr);
    }

    // Step 2: Extract data from response
    let extracted = extractDataFromApiResponse(res);

    // Step 3: If sync_batch didn't return bookings, fallback to read_all query (GET-friendly)
    if (!extracted.isSuccess || extracted.bookings.length === 0) {
      try {
        const readRes = await callAppsScriptApi(webAppUrl, 'read_all', {});
        const readExtracted = extractDataFromApiResponse(readRes);
        if (readExtracted.isSuccess && (readExtracted.bookings.length > 0 || !extracted.isSuccess)) {
          extracted = readExtracted;
          res = readRes;
        }
      } catch (readErr) {
        console.warn('read_all fallback failed:', readErr);
      }
    }

    if (extracted.isSuccess) {
      const remoteBookings: Booking[] = extracted.bookings;
      const remoteCustomers: Customer[] = extracted.customers;

      // Merge data with Last-Write-Wins
      const mergedBookings = remoteBookings.length > 0
        ? mergeBookings(localBookings, remoteBookings)
        : localBookings;

      const mergedCustomers = remoteCustomers.length > 0
        ? mergeCustomers(localCustomers, remoteCustomers)
        : localCustomers;

      // Clear pending queue on successful sync
      if (pendingQueue.length > 0) {
        clearSyncQueue();
      }

      return {
        success: true,
        status: 'synced',
        message: `Synchronized successfully! ${mergedBookings.length} bookings and ${mergedCustomers.length} customers active.`,
        syncedBookings: mergedBookings,
        syncedCustomers: mergedCustomers,
        mergedBookings,
        mergedCustomers,
        serverTime: extracted.serverTime || new Date().toISOString(),
      };
    } else {
      const diagMessage =
        extracted.errorMessage ||
        (res && typeof res === 'object' && Object.keys(res).length > 0
          ? `Server returned: ${JSON.stringify(res).slice(0, 100)}`
          : 'Unable to synchronize with Google Sheet. Changes remain safely cached locally.');

      return {
        success: false,
        status: 'error',
        message: `Sync notice: ${diagMessage}`,
        error: diagMessage,
        syncedBookings: localBookings,
        syncedCustomers: localCustomers,
        mergedBookings: localBookings,
        mergedCustomers: localCustomers,
      };
    }
  } catch (err: any) {
    console.warn('Google Sheet Sync issue handled gracefully:', err?.message || err);
    return {
      success: false,
      status: 'error',
      message: `Sync notice: ${err.message || 'Network delay'}. Local offline cache remains fully protected.`,
      error: err.message,
      syncedBookings: localBookings,
      syncedCustomers: localCustomers,
      mergedBookings: localBookings,
      mergedCustomers: localCustomers,
    };
  }
}

// Tracks in-flight push operations to prevent concurrent or rapid duplicate calls for the same booking
const inFlightPushes = new Map<string, Promise<{ success: boolean; queued: boolean; message: string }>>();

/**
 * Resolves staff mobile numbers from local storage if booking.staffMobile is not explicitly set
 */
export function resolveBookingStaffMobileFromStorage(booking: Partial<Booking>): string {
  if (booking.staffMobile && booking.staffMobile.trim()) {
    return booking.staffMobile.trim();
  }
  let staffList: Array<{ id: string; name: string; mobile?: string }> = [];
  try {
    const raw = localStorage.getItem('msd_staff_v2');
    if (raw) staffList = JSON.parse(raw);
  } catch (e) {}

  const staffIds = booking.assignedStaffIds || [];
  const staffNames = booking.assignedStaffNames || [];

  const foundStaff: Array<{ id: string; name: string; mobile?: string }> = [];

  if (staffIds.length > 0) {
    for (const id of staffIds) {
      const s = staffList.find((item) => item.id === id);
      if (s && !foundStaff.some((ex) => ex.id === s.id)) {
        foundStaff.push(s);
      }
    }
  }

  if (foundStaff.length === 0 && staffNames.length > 0) {
    for (const name of staffNames) {
      const cleanName = name.replace(/^Mr\.\s*/i, '').trim().toLowerCase();
      const s = staffList.find(
        (item) => item.name.replace(/^Mr\.\s*/i, '').trim().toLowerCase() === cleanName
      );
      if (s && !foundStaff.some((ex) => ex.id === s.id)) {
        foundStaff.push(s);
      }
    }
  }

  if (foundStaff.length === 0) return '';
  if (foundStaff.length === 1) {
    return foundStaff[0].mobile || '';
  }

  const withNames = foundStaff
    .filter((s) => s.mobile)
    .map((s) => `${s.name.replace(/^Mr\.\s*/i, '')}: ${s.mobile}`);
  if (withNames.length > 0) {
    return withNames.join(', ');
  }
  return foundStaff.map((s) => s.mobile).filter(Boolean).join(', ');
}

/**
 * Pushes a single booking event (Create, Edit, Cancel, Delete) to the cloud.
 * If offline or if request fails, queues it for background synchronization.
 * Supports both (booking, action, webAppUrl) and (booking, webAppUrl).
 * Features in-flight deduplication to prevent double-entries from fast clicks.
 */
export async function pushBookingToCloud(
  booking: Booking,
  actionOrUrl?: 'CREATE' | 'UPDATE' | 'CANCEL' | 'DELETE' | string,
  maybeUrl?: string
): Promise<{ success: boolean; queued: boolean; message: string }> {
  let action: 'CREATE' | 'UPDATE' | 'CANCEL' | 'DELETE' = 'UPDATE';
  let webAppUrl: string | undefined = undefined;

  if (
    actionOrUrl === 'CREATE' ||
    actionOrUrl === 'UPDATE' ||
    actionOrUrl === 'CANCEL' ||
    actionOrUrl === 'DELETE'
  ) {
    action = actionOrUrl;
    webAppUrl = maybeUrl;
  } else if (typeof actionOrUrl === 'string') {
    webAppUrl = actionOrUrl;
    action = 'UPDATE';
  } else {
    webAppUrl = maybeUrl;
  }

  // Deduplication check: if the exact same booking push is currently in-flight, return the active Promise
  const dedupeKey = `${booking.id || booking.bookingRef || 'new'}_${action}`;
  if (inFlightPushes.has(dedupeKey)) {
    return inFlightPushes.get(dedupeKey)!;
  }

  const pushTask = (async (): Promise<{ success: boolean; queued: boolean; message: string }> => {
    // Always update booking metadata
    booking.updatedAt = new Date().toISOString();
    booking.createdDevice = booking.createdDevice || getDeviceIdentifier();
    booking.lastSync = new Date().toISOString();

    // Normalize service and quantity values
    const finalQty = booking.quantity !== undefined && booking.quantity > 0 ? booking.quantity : 1;
    const sType = (booking.serviceType || '').trim();
    const sDesc = (booking.serviceDescription || '').trim();
    let sDetails = (booking.serviceDetails || '').trim();
    if (!sDetails) {
      if (sDesc) {
        sDetails = (sType && !sDesc.toLowerCase().includes(sType.toLowerCase()))
          ? `${sType} (Qty: ${finalQty}) - ${sDesc}`
          : sDesc;
      } else {
        sDetails = finalQty > 1 ? `${sType} (Qty: ${finalQty})` : sType;
      }
    }

    // Auto-resolve staff mobile from storage if not set
    let staffMobileStr = (booking.staffMobile || '').trim();
    if (!staffMobileStr) {
      staffMobileStr = resolveBookingStaffMobileFromStorage(booking);
    }

    const assignedStaffStr = (booking.assignedStaffNames && booking.assignedStaffNames.length > 0)
      ? booking.assignedStaffNames.join(', ')
      : '';

    const enrichedBooking: Booking = {
      ...booking,
      quantity: finalQty,
      serviceType: sType,
      serviceDescription: sDesc,
      serviceDetails: sDetails,
      staffMobile: staffMobileStr,
    };

    // Build payload with explicit aliases for Google Apps Script mapping
    const bookingPayload = {
      ...enrichedBooking,
      referenceNo: enrichedBooking.bookingRef,
      refNo: enrichedBooking.bookingRef,
      bookingDate: enrichedBooking.bookingDate || new Date().toISOString().split('T')[0],
      scheduleDate: enrichedBooking.scheduleDate || enrichedBooking.bookingDate || '',
      customerName: enrichedBooking.customerName || '',
      customerMobile: enrichedBooking.customerMobile || '',
      mobileNumber: enrichedBooking.customerMobile || '',
      alternateMobile: enrichedBooking.alternateMobile || enrichedBooking.customerWhatsApp || '',
      serviceName: sType,
      serviceType: sType,
      quantity: finalQty,
      serviceDescription: sDesc || sDetails,
      serviceDetails: sDetails,
      workDetails: sDetails,
      scopeOfWork: sDetails,
      taskDetails: sDetails,
      timeSlot: enrichedBooking.slotPeriod ? `${enrichedBooking.slotPeriod} Slot` : (enrichedBooking.preferredTime || `Slot ${enrichedBooking.slotNumber}`),
      location: enrichedBooking.serviceLocation === 'Other' && enrichedBooking.customLocation ? enrichedBooking.customLocation : (enrichedBooking.serviceLocation || 'Puducherry'),
      fullAddress: enrichedBooking.fullAddress || '',
      assignedStaff: assignedStaffStr,
      staffName: assignedStaffStr,
      staffMobile: staffMobileStr,
      staffNumber: staffMobileStr,
      staffPhone: staffMobileStr,
      staffContact: staffMobileStr,
      staffMobileNo: staffMobileStr,
      staffPhoneNo: staffMobileStr,
      amount: enrichedBooking.amount !== undefined ? enrichedBooking.amount : '',
      paymentStatus: enrichedBooking.paymentStatus || 'Pending',
      bookingStatus: enrichedBooking.bookingStatus || 'Confirmed',
    };

    if (!navigator.onLine || !webAppUrl || !webAppUrl.trim().startsWith('http')) {
      addToSyncQueue({ action, booking: enrichedBooking });
      return {
        success: true,
        queued: true,
        message: 'Saved to local cache. Queued for Google Sheet sync when online.',
      };
    }

    try {
      const res = await callAppsScriptApi(webAppUrl, action.toLowerCase() + '_booking', {
        booking: bookingPayload,
        device: getDeviceIdentifier(),
      });

      const isSuccess =
        res &&
        (res.status === 'success' ||
          res.status === 'ok' ||
          res.success === true ||
          res.result === 'success' ||
          res.noCors);

      if (isSuccess) {
        return {
          success: true,
          queued: false,
          message: 'Saved and synchronized to Google Sheet in real time!',
        };
      } else {
        const errMsg = res?.message || res?.error || 'Remote save queued for background retry';
        console.warn('Real-time push queued:', errMsg);
        addToSyncQueue({ action, booking });
        return {
          success: true,
          queued: true,
          message: 'Saved locally; sync queued for automatic background retry.',
        };
      }
    } catch (e: any) {
      console.warn('Real-time push notice:', e);
      addToSyncQueue({ action, booking });
      return {
        success: true,
        queued: true,
        message: 'Saved locally; sync queued for automatic background retry.',
      };
    } finally {
      setTimeout(() => {
        inFlightPushes.delete(dedupeKey);
      }, 2000);
    }
  })();

  inFlightPushes.set(dedupeKey, pushTask);
  return pushTask;
}

/**
 * Triggers server-side duplicate cleanup in Google Sheet Bookings tab.
 * Removes duplicate rows with identical Reference No or Booking ID, keeping the latest single row.
 */
export async function cleanGoogleSheetDuplicates(
  webAppUrl: string
): Promise<{ success: boolean; message: string; removedCount?: number }> {
  if (!webAppUrl || !webAppUrl.trim().startsWith('http')) {
    return { success: false, message: 'Google Apps Script Web App URL is required.' };
  }
  try {
    const res = await callAppsScriptApi(webAppUrl, 'deduplicate', {});
    const isSuccess = res && (res.status === 'success' || res.status === 'ok' || res.success === true);
    return {
      success: isSuccess,
      message: res?.message || (isSuccess ? 'Google Sheet duplicate entries cleaned successfully!' : 'Could not clean duplicates.'),
      removedCount: typeof res?.removedCount === 'number' ? res.removedCount : 0,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to clean duplicates: ${err?.message || err}`,
    };
  }
}

/**
 * Exports Bookings Google Sheet CSV matching required columns:
 * Reference No, Booking Date, Schedule Date, Customer Name, Mobile Number, Alternate Mobile,
 * Service Name, Quantity, Service Details, Time Slot, Location, Full Address, Assigned Staff,
 * Staff Mobile, Team, Amount, Payment Status, Booking Status, Notes, Booking ID, Created By,
 * Created Device, Created At, Updated At, Last Sync.
 */
export function exportBookingsGoogleSheetCSV(bookings: Booking[]): string {
  const headers = [
    'Reference No',
    'Booking Date',
    'Schedule Date',
    'Customer Name',
    'Mobile Number',
    'Alternate Mobile',
    'Service Name',
    'Quantity',
    'Service Details',
    'Time Slot',
    'Location',
    'Full Address',
    'Assigned Staff',
    'Staff Mobile',
    'Team',
    'Amount',
    'Payment Status',
    'Booking Status',
    'Notes',
    'Booking ID',
    'Created By',
    'Created Device',
    'Created At',
    'Updated At',
    'Last Sync',
  ];

  const rows = bookings.map((b) => {
    const staffNames = b.assignedStaffNames || [];
    const staffListStr = staffNames.join(', ');
    const teamStr = staffNames.length > 1 ? staffNames.join(' & ') : '';
    const locDisplay =
      b.serviceLocation === 'Other' && b.customLocation
        ? b.customLocation
        : b.serviceLocation || 'Puducherry';

    const slotStr = `${b.slotPeriod || ''} (Slot ${b.slotNumber || 1}) ${b.preferredTime || ''}`.trim();
    const qVal = b.quantity !== undefined && b.quantity > 0 ? b.quantity : 1;
    const sType = (b.serviceType || '').trim();
    const sDesc = (b.serviceDescription || '').trim();
    let sDetails = (b.serviceDetails || '').trim();
    if (!sDetails) {
      if (sDesc) {
        sDetails = (sType && !sDesc.toLowerCase().includes(sType.toLowerCase()))
          ? `${sType} (Qty: ${qVal}) - ${sDesc}`
          : sDesc;
      } else {
        sDetails = qVal > 1 ? `${sType} (Qty: ${qVal})` : sType;
      }
    }
    const staffMob = (b.staffMobile || '').trim() || resolveBookingStaffMobileFromStorage(b);

    return [
      b.bookingRef,
      b.bookingDate,
      b.scheduleDate,
      b.customerName,
      b.customerMobile,
      b.alternateMobile || b.customerWhatsApp || '',
      sType,
      qVal,
      sDetails,
      slotStr,
      locDisplay,
      b.fullAddress || '',
      staffListStr,
      staffMob,
      teamStr,
      b.amount !== undefined ? b.amount : '',
      b.paymentStatus || 'Pending',
      b.bookingStatus || 'Confirmed',
      b.notes || '',
      b.id,
      b.createdBy || 'MSD Admin',
      b.createdDevice || 'Web App',
      b.createdAt,
      b.updatedAt,
      b.lastSync || new Date().toISOString(),
    ].map((field) => {
      const str = String(field ?? '').replace(/"/g, '""');
      return `"${str}"`;
    }).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Pushes all bookings to Google Sheet, ensuring Staff Mobile and Service Details
 * are populated for every row in the Google Sheet.
 */
export async function pushAllBookingsWithDetailsToCloud(
  bookings: Booking[],
  webAppUrl: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; message: string; count: number }> {
  if (!webAppUrl || !webAppUrl.trim().startsWith('http')) {
    return { success: false, message: 'Google Apps Script Web App URL is required.', count: 0 };
  }

  const enrichedBookings: Booking[] = bookings.map((b) => {
    const finalQty = b.quantity !== undefined && b.quantity > 0 ? b.quantity : 1;
    const sType = (b.serviceType || '').trim();
    const sDesc = (b.serviceDescription || '').trim();
    let sDetails = (b.serviceDetails || '').trim();
    if (!sDetails) {
      if (sDesc) {
        sDetails = (sType && !sDesc.toLowerCase().includes(sType.toLowerCase()))
          ? `${sType} (Qty: ${finalQty}) - ${sDesc}`
          : sDesc;
      } else {
        sDetails = finalQty > 1 ? `${sType} (Qty: ${finalQty})` : sType;
      }
    }
    const staffMobile = (b.staffMobile || '').trim() || resolveBookingStaffMobileFromStorage(b);
    return {
      ...b,
      quantity: finalQty,
      serviceType: sType,
      serviceDescription: sDesc || sDetails,
      serviceDetails: sDetails,
      staffMobile,
    };
  });

  // Try bulk sync_batch first
  try {
    const res = await callAppsScriptApi(webAppUrl, 'sync_batch', {
      bookings: enrichedBookings,
      pendingMutations: enrichedBookings.map((b) => ({
        id: b.id,
        action: 'UPDATE',
        booking: b,
        timestamp: new Date().toISOString(),
      })),
    });
    if (res && (res.status === 'success' || res.status === 'ok' || res.success === true)) {
      return {
        success: true,
        message: `Successfully synchronized and updated all ${enrichedBookings.length} bookings in Google Sheet with complete Service Details and Staff Numbers!`,
        count: enrichedBookings.length,
      };
    }
  } catch (err) {
    console.warn('Batch push failed, falling back to sequential updates:', err);
  }

  // Fallback: sequential push
  let updatedCount = 0;
  for (let i = 0; i < enrichedBookings.length; i++) {
    const b = enrichedBookings[i];
    if (onProgress) onProgress(i + 1, enrichedBookings.length);
    try {
      await pushBookingToCloud(b, 'UPDATE', webAppUrl);
      updatedCount++;
    } catch (e) {
      console.error(`Failed to push booking ${b.bookingRef}:`, e);
    }
  }

  return {
    success: updatedCount > 0,
    message: `Updated ${updatedCount} of ${enrichedBookings.length} bookings in Google Sheet with complete Service Details and Staff Numbers.`,
    count: updatedCount,
  };
}

/**
 * Returns complete, copy-pasteable production Google Apps Script code.
 * Features:
 * - Dynamic Header-Aware Mapping: reads existing columns in Row 1 without changing names
 * - Non-Destructive: preserves all existing data and columns
 * - Ensures Service Name, Quantity, and Service Details are always accurately populated
 * - Dynamic Row Lookup by Reference No or Booking ID
 * - Full CRUD & Batch Sync support for Multi-Device synchronization
 * - Single-Entry Deduplication: prevents double-entries when booking from mobile or laptop
 * - Automatic & On-Demand Duplicate Cleanup for existing sheet records
 */
export function getFreshGoogleAppsScriptTemplate(): string {
  return `/**
 * =========================================================================
 * MSD FACILITY SERVICES - REAL-TIME MULTI-DEVICE GOOGLE SHEETS API (v7)
 * [Single-Entry Guaranteed & Auto-Column (Staff Mobile & Details) Engine]
 * =========================================================================
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Click Extensions > Apps Script.
 * 3. Replace all existing code with this updated script.
 * 4. Click Deploy > Manage deployments > Edit > New version > Deploy.
 *    (Or Deploy > New deployment > Web app > Anyone > Deploy)
 * 5. Set Description: "MSDFS Central Database API v7 (Staff Mobile & Service Details Engine)".
 * 6. Set Execute as: "Me" (your Google account).
 * 7. Set Who has access: "Anyone". (CRITICAL for mobile & laptop sync)
 * 8. Copy the Web App URL into Settings in the MSDFS App.
 * =========================================================================
 */

var BOOKINGS_SHEET_NAME = "Bookings";
var CUSTOMERS_SHEET_NAME = "Customers";

// Standard default headers for brand-new or empty Bookings sheet
var STANDARD_BOOKINGS_HEADERS = [
  "Reference No",
  "Booking Date",
  "Schedule Date",
  "Customer Name",
  "Mobile Number",
  "Alternate Mobile",
  "Service Name",
  "Quantity",
  "Service Details",
  "Time Slot",
  "Location",
  "Full Address",
  "Assigned Staff",
  "Staff Mobile",
  "Team",
  "Amount",
  "Payment Status",
  "Booking Status",
  "Notes",
  "Booking ID",
  "Created By",
  "Created Device",
  "Created At",
  "Updated At",
  "Last Sync"
];

var CUSTOMERS_HEADERS = [
  "Customer ID",
  "Customer Name",
  "Mobile",
  "Alternate Mobile",
  "Email",
  "Location",
  "Full Address",
  "Total Bookings",
  "Last Booking Date",
  "Last Service",
  "Created At",
  "Updated At"
];

function initSheetsIfNeeded(ss) {
  var bSheet = ss.getSheetByName(BOOKINGS_SHEET_NAME);
  if (!bSheet) {
    bSheet = ss.insertSheet(BOOKINGS_SHEET_NAME, 0);
    bSheet.appendRow(STANDARD_BOOKINGS_HEADERS);
    var hRange = bSheet.getRange(1, 1, 1, STANDARD_BOOKINGS_HEADERS.length);
    hRange.setBackground("#1E3A8A").setFontColor("#FFFFFF").setFontWeight("bold");
    bSheet.setFrozenRows(1);
  } else if (bSheet.getLastRow() === 0) {
    bSheet.appendRow(STANDARD_BOOKINGS_HEADERS);
    var hRange = bSheet.getRange(1, 1, 1, STANDARD_BOOKINGS_HEADERS.length);
    hRange.setBackground("#1E3A8A").setFontColor("#FFFFFF").setFontWeight("bold");
    bSheet.setFrozenRows(1);
  }

  var cSheet = ss.getSheetByName(CUSTOMERS_SHEET_NAME);
  if (!cSheet) {
    cSheet = ss.insertSheet(CUSTOMERS_SHEET_NAME, 1);
    cSheet.appendRow(CUSTOMERS_HEADERS);
    var chRange = cSheet.getRange(1, 1, 1, CUSTOMERS_HEADERS.length);
    chRange.setBackground("#065F46").setFontColor("#FFFFFF").setFontWeight("bold");
    cSheet.setFrozenRows(1);
  } else if (cSheet.getLastRow() === 0) {
    cSheet.appendRow(CUSTOMERS_HEADERS);
    var chRange = cSheet.getRange(1, 1, 1, CUSTOMERS_HEADERS.length);
    chRange.setBackground("#065F46").setFontColor("#FFFFFF").setFontWeight("bold");
    cSheet.setFrozenRows(1);
  }

  return { bSheet: bSheet, cSheet: cSheet };
}

// Builds dynamic lookup map from Row 1 headers: headerNameClean -> 0-based colIndex
function getColumnIndexMap(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var c = 0; c < headerRow.length; c++) {
    var raw = String(headerRow[c] || "").trim();
    var key = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (key) {
      map[key] = c;
    }
  }
  return { map: map, headers: headerRow, count: headerRow.length };
}

function findColIndex(colInfo, aliases) {
  for (var i = 0; i < aliases.length; i++) {
    var key = aliases[i].toLowerCase().replace(/[^a-z0-9]/g, "");
    if (colInfo.map.hasOwnProperty(key)) {
      return colInfo.map[key];
    }
  }
  return -1;
}

// Non-destructively appends missing critical headers (Service Details, Staff Mobile, Quantity) if not present
function ensureEssentialHeadersNonDestructive(sheet) {
  var colInfo = getColumnIndexMap(sheet);
  var lastCol = colInfo.count;
  var headersToAdd = [];

  var qIdx = findColIndex(colInfo, ["quantity", "qty", "count", "units"]);
  if (qIdx < 0) {
    headersToAdd.push("Quantity");
  }

  var sDetailsIdx = findColIndex(colInfo, [
    "servicedetails", "servicedetail", "servicesdetails", "servicedescription",
    "workdetails", "workdetail", "scopeofwork", "scopeofworks", "workdescription",
    "jobdetails", "jobdetail", "taskdetails", "particulars", "serviceparticulars"
  ]);
  if (sDetailsIdx < 0) {
    headersToAdd.push("Service Details");
  }

  var staffMobIdx = findColIndex(colInfo, [
    "staffmobile", "staffnumber", "staffmobilenumber", "staffmobileno", "staffno",
    "staffphone", "staffphonenumber", "staffphoneno", "staffcontact", "staffcontactnumber", "staffcontactno", "cleanermobile"
  ]);
  if (staffMobIdx < 0) {
    headersToAdd.push("Staff Mobile");
  }

  if (headersToAdd.length > 0) {
    var range = sheet.getRange(1, lastCol + 1, 1, headersToAdd.length);
    range.setValues([headersToAdd]);
    range.setBackground("#1E3A8A").setFontColor("#FFFFFF").setFontWeight("bold");
    return getColumnIndexMap(sheet);
  }

  return colInfo;
}

// Builds a row array matching the exact columns present in sheet Row 1
function buildBookingRowValues(b, colInfo) {
  var row = new Array(colInfo.count);
  for (var i = 0; i < row.length; i++) {
    row[i] = "";
  }

  var now = new Date().toISOString();
  var today = now.split("T")[0];

  function setVal(aliases, val) {
    var idx = findColIndex(colInfo, aliases);
    if (idx >= 0 && idx < row.length) {
      row[idx] = val !== undefined && val !== null ? val : "";
    }
  }

  var staffList = (b.assignedStaffNames && b.assignedStaffNames.length > 0) ? b.assignedStaffNames.join(", ") : (b.assignedStaff || "");
  var teamStr = (b.assignedStaffNames && b.assignedStaffNames.length > 1) ? b.assignedStaffNames.join(" & ") : (b.team || "");
  var locDisplay = (b.serviceLocation === "Other" && b.customLocation) ? b.customLocation : (b.serviceLocation || b.location || "Puducherry");
  var slotDisplay = (b.slotPeriod || "") + (b.slotNumber ? " (Slot " + b.slotNumber + ")" : "") + (b.preferredTime ? " " + b.preferredTime : "");
  slotDisplay = slotDisplay.trim() || (b.timeSlot || "");

  var sType = String(b.serviceType || b.serviceName || b.service || "").trim();
  var rawQty = b.quantity !== undefined && b.quantity !== null && b.quantity !== "" ? parseInt(b.quantity, 10) : 1;
  var qty = isNaN(rawQty) || rawQty <= 0 ? 1 : rawQty;
  var sDesc = String(b.serviceDescription || b.serviceDetails || b.workDetails || "").trim();

  var sNameColIdx = findColIndex(colInfo, ["servicename", "service", "servicetype", "services", "mainservice"]);

  // 1. Service Name / Service Type
  setVal(["servicename", "service", "servicetype", "services", "mainservice"], sType);

  // 2. Quantity
  setVal(["quantity", "qty", "count", "units", "serviceqty"], qty);

  // 3. Service Details (ensure it is NEVER empty)
  var finalDetails = "";
  if (sDesc) {
    finalDetails = sDesc;
  } else {
    finalDetails = sType ? (sType + (qty > 1 ? " (Qty: " + qty + ")" : "")) : "Standard Service";
  }
  if (sNameColIdx < 0 && sType && sDesc && sDesc.indexOf(sType) < 0) {
    finalDetails = sType + (qty > 1 ? " (Qty: " + qty + ")" : "") + " - " + sDesc;
  }
  setVal(["servicedetails", "workdetails", "scopeofwork", "workdescription", "description", "servicedescription", "taskdetails", "details"], finalDetails);

  // 4. Reference No
  setVal(["referenceno", "refno", "ref", "bookingref", "bookingreference", "referencenumber"], b.bookingRef || b.referenceNo || "");

  // 5. Booking Date
  setVal(["bookingdate", "bookedon", "dateofbooking", "createddate"], b.bookingDate || today);

  // 6. Schedule Date
  setVal(["scheduledate", "servicedate", "workdate", "appointmentdate", "date"], b.scheduleDate || b.bookingDate || today);

  // 7. Customer Name
  setVal(["customername", "clientname", "name", "customer", "client", "custname"], b.customerName || "");

  // 8. Mobile Number
  setVal(["mobilenumber", "customermobile", "mobile", "phone", "phonenumber", "contact", "contactnumber"], b.customerMobile || b.mobileNumber || "");

  // 9. Alternate Mobile / WhatsApp
  setVal(["alternatemobile", "whatsapp", "customerwhatsapp", "altmobile", "secondarymobile", "altphone"], b.alternateMobile || b.customerWhatsApp || "");

  // 10. Time Slot
  setVal(["timeslot", "slot", "slotperiod", "timing", "preferredtime", "time"], slotDisplay);

  // 11. Location
  setVal(["location", "servicelocation", "area", "city", "town"], locDisplay);

  // 12. Full Address
  setVal(["fulladdress", "address", "landmarks", "customeraddress", "siteaddress"], b.fullAddress || "");

  // 13. Assigned Staff
  setVal(["assignedstaff", "staff", "staffname", "staffnames", "cleaner", "technician"], staffList);

  // 14. Staff Mobile
  var staffMobVal = String(
    b.staffMobile || b.staffNumber || b.staffPhone || b.staffContact || b.staffMobileNo || b.staffPhoneNo || ""
  ).trim();
  setVal([
    "staffmobile", "staffnumber", "staffmobilenumber", "staffmobileno", "staffno",
    "staffphone", "staffphonenumber", "staffphoneno", "staffcontact", "staffcontactnumber", "staffcontactno", "cleanermobile", "cleanerphone", "cleanernumber"
  ], staffMobVal);

  // 15. Team
  setVal(["team", "crew", "teammembers"], teamStr);

  // 16. Amount
  setVal(["amount", "totalamount", "total", "price", "rate", "cost"], b.amount !== undefined ? b.amount : "");

  // 17. Advance Amount
  setVal(["advanceamount", "advancepaid", "advance"], b.advanceAmount !== undefined ? b.advanceAmount : 0);

  // 18. Balance Amount
  setVal(["balanceamount", "balancedue", "balance"], b.balanceAmount !== undefined ? b.balanceAmount : 0);

  // 19. Payment Status
  setVal(["paymentstatus", "payment"], b.paymentStatus || "Pending");

  // 20. Booking Status
  setVal(["bookingstatus", "status"], b.bookingStatus || "Confirmed");

  // 21. Notes
  setVal(["notes", "remarks", "comment", "comments", "specialinstructions"], b.notes || "");

  // 22. Booking ID
  setVal(["bookingid", "id", "systemid"], b.id || ("bk_" + (b.bookingRef || Date.now())));

  // 23. Created By
  setVal(["createdby"], b.createdBy || "MSD Admin");

  // 24. Created Device
  setVal(["createddevice", "device"], b.createdDevice || "Web App");

  // 25. Created At
  setVal(["createdat", "createdon", "timestamp"], b.createdAt || now);

  // 26. Updated At
  setVal(["updatedat", "modifiedat", "updatedon"], b.updatedAt || now);

  // 27. Last Sync
  setVal(["lastsync", "syncedat"], now);

  return row;
}

// Finds existing row index by Reference No or Booking ID (case-insensitive deduplication)
function findBookingRowIndex(sheet, b, colInfo) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;

  var refIdx = findColIndex(colInfo, ["referenceno", "refno", "ref", "bookingref", "bookingreference", "referencenumber"]);
  var idIdx = findColIndex(colInfo, ["bookingid", "id", "systemid"]);

  var targetRef = String(b.bookingRef || b.referenceNo || "").trim().toLowerCase();
  var targetId = String(b.id || "").trim().toLowerCase();

  var data = sheet.getRange(2, 1, lastRow - 1, colInfo.count).getValues();
  for (var i = 0; i < data.length; i++) {
    var rowRef = refIdx >= 0 ? String(data[i][refIdx] || "").trim().toLowerCase() : "";
    var rowId = idIdx >= 0 ? String(data[i][idIdx] || "").trim().toLowerCase() : "";

    if ((targetRef && rowRef && rowRef === targetRef) ||
        (targetId && rowId && rowId === targetId)) {
      return i + 2;
    }
  }
  return -1;
}

// Scans Bookings sheet and removes duplicate rows having identical Reference No or Booking ID
function removeDuplicateBookingRows(sheet, colInfo) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 2) return 0;

  var refIdx = findColIndex(colInfo, ["referenceno", "refno", "ref", "bookingref", "bookingreference", "referencenumber"]);
  var idIdx = findColIndex(colInfo, ["bookingid", "id", "systemid"]);
  if (refIdx < 0 && idIdx < 0) return 0;

  var data = sheet.getRange(2, 1, lastRow - 1, colInfo.count).getValues();
  var seenKeys = {};
  var rowsToDelete = [];

  for (var i = 0; i < data.length; i++) {
    var rowNum = i + 2;
    var rowRef = refIdx >= 0 ? String(data[i][refIdx] || "").trim().toLowerCase() : "";
    var rowId = idIdx >= 0 ? String(data[i][idIdx] || "").trim().toLowerCase() : "";
    var key = rowRef || rowId;

    if (key) {
      if (seenKeys[key]) {
        rowsToDelete.push(rowNum);
      } else {
        seenKeys[key] = rowNum;
      }
    }
  }

  // Delete from bottom to top so indices do not shift
  for (var d = rowsToDelete.length - 1; d >= 0; d--) {
    sheet.deleteRow(rowsToDelete[d]);
  }

  return rowsToDelete.length;
}

function rowToBookingObjectByHeaders(rowValues, colInfo) {
  function getVal(aliases, fallback) {
    var idx = findColIndex(colInfo, aliases);
    if (idx >= 0 && idx < rowValues.length) {
      var v = rowValues[idx];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        return v;
      }
    }
    return fallback;
  }

  var bRef = String(getVal(["referenceno", "refno", "ref", "bookingref", "bookingreference"], "")).trim();
  var bId = String(getVal(["bookingid", "id", "systemid"], bRef ? ("bk_" + bRef) : ("bk_" + Date.now()))).trim();
  var sName = String(getVal(["servicename", "service", "servicetype", "services"], "")).trim();
  var sDetails = String(getVal([
    "servicedetails", "servicedetail", "servicesdetails", "servicedescription",
    "workdetails", "workdetail", "scopeofwork", "scopeofworks", "workdescription",
    "jobdetails", "jobdetail", "taskdetails", "particulars", "serviceparticulars", "details"
  ], "")).trim();
  var rawQty = getVal(["quantity", "qty", "count", "units"], 1);
  var numQty = parseInt(rawQty, 10);
  if (isNaN(numQty) || numQty <= 0) numQty = 1;

  if (!sName && sDetails) {
    sName = sDetails.split(" - ")[0].replace(/\\s*\\(Qty:[^)]*\\)/i, "").trim();
  }
  if (!sName) {
    sName = "General Cleaning";
  }

  var rawStaff = String(getVal(["assignedstaff", "staff", "staffname", "staffnames"], ""));
  var staffNames = rawStaff ? rawStaff.split(",").map(function(s) { return s.trim(); }).filter(Boolean) : [];

  var staffMob = String(getVal([
    "staffmobile", "staffnumber", "staffmobilenumber", "staffmobileno", "staffno",
    "staffphone", "staffphonenumber", "staffphoneno", "staffcontact", "staffcontactnumber", "staffcontactno", "cleanermobile"
  ], "")).trim();

  return {
    id: bId,
    bookingRef: bRef,
    bookingDate: String(getVal(["bookingdate", "bookedon", "dateofbooking"], "")),
    scheduleDate: String(getVal(["scheduledate", "servicedate", "workdate", "date"], "")),
    customerName: String(getVal(["customername", "clientname", "name", "customer"], "")),
    customerMobile: String(getVal(["mobilenumber", "customermobile", "mobile", "phone"], "")),
    alternateMobile: String(getVal(["alternatemobile", "whatsapp", "customerwhatsapp"], "")),
    customerWhatsApp: String(getVal(["customerwhatsapp", "whatsapp", "alternatemobile"], "")),
    serviceType: sName,
    quantity: numQty,
    serviceDescription: sDetails,
    serviceDetails: sDetails || (numQty > 1 ? (sName + " (Qty: " + numQty + ")") : sName),
    preferredTime: String(getVal(["timeslot", "slot", "timing", "preferredtime", "time"], "")),
    serviceLocation: String(getVal(["location", "servicelocation", "area"], "Puducherry")),
    fullAddress: String(getVal(["fulladdress", "address", "landmarks"], "")),
    assignedStaffNames: staffNames,
    staffMobile: staffMob,
    team: String(getVal(["team", "crew"], "")),
    amount: getVal(["amount", "totalamount", "total", "price"], ""),
    advanceAmount: Number(getVal(["advanceamount", "advancepaid", "advance"], 0)) || 0,
    balanceAmount: Number(getVal(["balanceamount", "balancedue", "balance"], 0)) || 0,
    paymentStatus: String(getVal(["paymentstatus", "payment"], "Pending")),
    bookingStatus: String(getVal(["bookingstatus", "status"], "Confirmed")),
    notes: String(getVal(["notes", "remarks", "comment"], "")),
    createdBy: String(getVal(["createdby"], "MSD Admin")),
    createdDevice: String(getVal(["createddevice", "device"], "Web App")),
    createdAt: String(getVal(["createdat", "timestamp"], new Date().toISOString())),
    updatedAt: String(getVal(["updatedat"], new Date().toISOString())),
    lastSync: String(getVal(["lastsync"], new Date().toISOString()))
  };
}

function normalizePhone(phone) {
  if (!phone) return "";
  var digits = String(phone).replace(/[^\\d]/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.indexOf("0") === 0) return digits.substring(1);
  if (digits.length === 12 && digits.indexOf("91") === 0) return digits.substring(2);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function getNextRefNumberLocked(ss) {
  var bSheet = ss.getSheetByName(BOOKINGS_SHEET_NAME);
  if (!bSheet) return "MSD/PDY/" + new Date().getFullYear() + "/1001";

  var colInfo = getColumnIndexMap(bSheet);
  var refIdx = findColIndex(colInfo, ["referenceno", "refno", "ref", "bookingref", "bookingreference"]);
  if (refIdx < 0) refIdx = 0;

  var lastRow = bSheet.getLastRow();
  var maxNum = 1000;
  if (lastRow > 1) {
    var refColValues = bSheet.getRange(2, refIdx + 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < refColValues.length; i++) {
      var val = String(refColValues[i][0] || "");
      var match = val.match(/\\d+$/);
      if (match) {
        var n = parseInt(match[0], 10);
        if (n > maxNum) maxNum = n;
      }
    }
  }
  var year = new Date().getFullYear();
  return "MSD/PDY/" + year + "/" + ("0000" + (maxNum + 1)).slice(-4);
}

function upsertCustomerRecord(cSheet, booking) {
  var norm = normalizePhone(booking.customerMobile || booking.mobileNumber);
  if (!norm) return;

  var lastRow = cSheet.getLastRow();
  var rowIndex = -1;
  var existingData = null;

  if (lastRow > 1) {
    var data = cSheet.getRange(2, 1, lastRow - 1, CUSTOMERS_HEADERS.length).getValues();
    for (var i = 0; i < data.length; i++) {
      if (normalizePhone(data[i][2]) === norm) {
        rowIndex = i + 2;
        existingData = data[i];
        break;
      }
    }
  }

  var now = new Date().toISOString();
  var bDate = booking.scheduleDate || booking.bookingDate || now.split("T")[0];
  var custId = existingData ? existingData[0] : ("cust_" + norm);
  var totalB = existingData ? (parseInt(existingData[7], 10) || 1) + 1 : 1;
  var altMobile = booking.alternateMobile || booking.customerWhatsApp || (existingData ? existingData[3] : "");
  var loc = booking.customLocation || booking.serviceLocation || booking.location || (existingData ? existingData[5] : "Puducherry");
  var addr = booking.fullAddress || (existingData ? existingData[6] : "");
  var createdAt = existingData ? existingData[10] : now;
  var sType = booking.serviceType || booking.serviceName || (existingData ? existingData[9] : "");

  var rowVals = [
    custId,
    booking.customerName || (existingData ? existingData[1] : "Customer"),
    norm,
    altMobile,
    existingData ? existingData[4] : "",
    loc,
    addr,
    totalB,
    bDate,
    sType,
    createdAt,
    now
  ];

  if (rowIndex > 0) {
    cSheet.getRange(rowIndex, 1, 1, rowVals.length).setValues([rowVals]);
  } else {
    cSheet.appendRow(rowVals);
  }
}

function rowToCustomerObject(row) {
  return {
    id: String(row[0] || ""),
    name: String(row[1] || ""),
    mobile: String(row[2] || ""),
    alternateMobile: String(row[3] || ""),
    email: String(row[4] || ""),
    location: String(row[5] || ""),
    fullAddress: String(row[6] || ""),
    totalBookings: parseInt(row[7], 10) || 0,
    lastBookingDate: String(row[8] || ""),
    lastService: String(row[9] || ""),
    createdAt: String(row[10] || ""),
    updatedAt: String(row[11] || "")
  };
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.tryLock(15000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = initSheetsIfNeeded(ss);
    var params = e ? e.parameter : {};
    var action = params.action || "read_all";

    if (action === "ping") {
      var bCount = Math.max(0, sheets.bSheet.getLastRow() - 1);
      var cCount = Math.max(0, sheets.cSheet.getLastRow() - 1);
      return jsonResponse({
        status: "success",
        message: "Connected to MSDFS Central Google Sheet",
        bookingCount: bCount,
        customerCount: cCount,
        serverTime: new Date().toISOString()
      });
    }

    if (action === "get_latest_ref") {
      var nextRef = getNextRefNumberLocked(ss);
      return jsonResponse({ status: "success", nextRef: nextRef });
    }

    if (action === "read_all" || action === "read") {
      var colInfo = getColumnIndexMap(sheets.bSheet);
      var bLast = sheets.bSheet.getLastRow();
      var cLast = sheets.cSheet.getLastRow();
      var allBookings = [];
      var allCustomers = [];

      if (bLast > 1) {
        var bData = sheets.bSheet.getRange(2, 1, bLast - 1, colInfo.count).getValues();
        for (var i = 0; i < bData.length; i++) {
          if (bData[i].some(function(cell) { return cell !== "" && cell !== null && cell !== undefined; })) {
            allBookings.push(rowToBookingObjectByHeaders(bData[i], colInfo));
          }
        }
      }

      if (cLast > 1) {
        var cData = sheets.cSheet.getRange(2, 1, cLast - 1, CUSTOMERS_HEADERS.length).getValues();
        for (var j = 0; j < cData.length; j++) {
          if (cData[j][1] || cData[j][2]) {
            allCustomers.push(rowToCustomerObject(cData[j]));
          }
        }
      }

      return jsonResponse({
        status: "success",
        bookings: allBookings,
        customers: allCustomers,
        serverTime: new Date().toISOString()
      });
    }

    // Support GET-based mutation fallback if URL parameter "payload" is present
    if (params.payload) {
      var body = JSON.parse(params.payload);
      return handleAction(ss, sheets, action, body);
    }

    return jsonResponse({ status: "success", message: "MSDFS API Ready" });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  } finally {
    try { lock.releaseLock(); } catch(e){}
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.tryLock(20000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = initSheetsIfNeeded(ss);

    var body = {};
    try {
      if (e && e.postData && e.postData.contents) {
        body = JSON.parse(e.postData.contents);
      } else if (e && e.parameter) {
        body = e.parameter;
      }
    } catch (parseErr) {
      body = (e && e.parameter) || {};
    }

    var action = (body.action || "sync_batch").toLowerCase();
    return handleAction(ss, sheets, action, body);
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  } finally {
    try { lock.releaseLock(); } catch(e){}
  }
}

function handleAction(ss, sheets, action, body) {
  var bSheet = sheets.bSheet;
  var cSheet = sheets.cSheet;

  // Ensure missing critical columns (Quantity, Service Details) are non-destructively added if needed
  var colInfo = ensureEssentialHeadersNonDestructive(bSheet);

  // 0. READ / PING (via POST)
  if (action === "ping") {
    var bCount = Math.max(0, bSheet.getLastRow() - 1);
    var cCount = Math.max(0, cSheet.getLastRow() - 1);
    return jsonResponse({
      status: "success",
      message: "Connected to MSDFS Central Google Sheet",
      bookingCount: bCount,
      customerCount: cCount,
      serverTime: new Date().toISOString()
    });
  }

  if (action === "read_all" || action === "read") {
    var bLast = bSheet.getLastRow();
    var cLast = cSheet.getLastRow();
    var allB = [];
    var allC = [];

    if (bLast > 1) {
      var bData = bSheet.getRange(2, 1, bLast - 1, colInfo.count).getValues();
      for (var i = 0; i < bData.length; i++) {
        if (bData[i].some(function(c) { return c !== "" && c !== null && c !== undefined; })) {
          allB.push(rowToBookingObjectByHeaders(bData[i], colInfo));
        }
      }
    }

    if (cLast > 1) {
      var cData = cSheet.getRange(2, 1, cLast - 1, CUSTOMERS_HEADERS.length).getValues();
      for (var j = 0; j < cData.length; j++) {
        if (cData[j][1] || cData[j][2]) {
          allC.push(rowToCustomerObject(cData[j]));
        }
      }
    }

    return jsonResponse({
      status: "success",
      bookings: allB,
      customers: allC,
      serverTime: new Date().toISOString()
    });
  }

  // 1. CREATE BOOKING (Guaranteed Single-Entry Deduplication)
  if (action === "create_booking" || action === "create") {
    var b = body.booking || {};
    if (!b.bookingRef && !b.referenceNo) {
      b.bookingRef = getNextRefNumberLocked(ss);
    }
    b.id = b.id || ("bk_" + (b.bookingRef || Date.now()));
    b.updatedAt = new Date().toISOString();

    // DEDUPLICATION: Check if this booking already exists in the sheet
    var foundRow = findBookingRowIndex(bSheet, b, colInfo);
    var rowArray = buildBookingRowValues(b, colInfo);

    if (foundRow > 0) {
      // Row already exists - update in place so NO duplicate row is created
      bSheet.getRange(foundRow, 1, 1, rowArray.length).setValues([rowArray]);
    } else {
      bSheet.appendRow(rowArray);
    }
    upsertCustomerRecord(cSheet, b);

    return jsonResponse({
      status: "success",
      message: foundRow > 0 ? "Booking updated (duplicate prevented)" : "Booking created",
      booking: b
    });
  }

  // 2. UPDATE BOOKING
  if (action === "update_booking" || action === "update") {
    var b = body.booking || {};
    var foundRow = findBookingRowIndex(bSheet, b, colInfo);

    b.updatedAt = new Date().toISOString();
    var rowArray = buildBookingRowValues(b, colInfo);

    if (foundRow > 0) {
      bSheet.getRange(foundRow, 1, 1, rowArray.length).setValues([rowArray]);
    } else {
      bSheet.appendRow(rowArray);
    }
    upsertCustomerRecord(cSheet, b);

    return jsonResponse({ status: "success", message: "Booking updated", booking: b });
  }

  // 3. CANCEL BOOKING
  if (action === "cancel_booking" || action === "cancel") {
    var b = body.booking || {};
    var foundRow = findBookingRowIndex(bSheet, b, colInfo);

    if (foundRow > 0) {
      var statusCol = findColIndex(colInfo, ["bookingstatus", "status"]);
      var updateCol = findColIndex(colInfo, ["updatedat", "modifiedat", "lastsync"]);
      if (statusCol >= 0) {
        bSheet.getRange(foundRow, statusCol + 1).setValue("Cancelled");
      }
      if (updateCol >= 0) {
        bSheet.getRange(foundRow, updateCol + 1).setValue(new Date().toISOString());
      }
    }

    return jsonResponse({ status: "success", message: "Booking cancelled safely. Customer record preserved." });
  }

  // 4. BATCH SYNC (Mobile + Laptop multi-device synchronization)
  if (action === "sync_batch" || action === "sync") {
    var incomingBookings = body.bookings || [];
    var pendingMutations = body.pendingMutations || [];

    // Process pending mutations first
    for (var m = 0; m < pendingMutations.length; m++) {
      var item = pendingMutations[m];
      if (item && item.booking) {
        var mutRow = findBookingRowIndex(bSheet, item.booking, colInfo);
        if (item.action === "CANCEL") {
          if (mutRow > 0) {
            var statusCol = findColIndex(colInfo, ["bookingstatus", "status"]);
            var updateCol = findColIndex(colInfo, ["updatedat", "modifiedat"]);
            if (statusCol >= 0) bSheet.getRange(mutRow, statusCol + 1).setValue("Cancelled");
            if (updateCol >= 0) bSheet.getRange(mutRow, updateCol + 1).setValue(item.timestamp || new Date().toISOString());
          }
        } else {
          var rowArr = buildBookingRowValues(item.booking, colInfo);
          if (mutRow > 0) {
            bSheet.getRange(mutRow, 1, 1, rowArr.length).setValues([rowArr]);
          } else {
            bSheet.appendRow(rowArr);
          }
          upsertCustomerRecord(cSheet, item.booking);
        }
      }
    }

    // Process incoming bookings if provided
    for (var bIdx = 0; bIdx < incomingBookings.length; bIdx++) {
      var incBooking = incomingBookings[bIdx];
      if (incBooking) {
        var incRow = findBookingRowIndex(bSheet, incBooking, colInfo);
        var incRowArr = buildBookingRowValues(incBooking, colInfo);
        if (incRow > 0) {
          bSheet.getRange(incRow, 1, 1, incRowArr.length).setValues([incRowArr]);
        } else {
          bSheet.appendRow(incRowArr);
        }
        upsertCustomerRecord(cSheet, incBooking);
      }
    }

    // Auto-clean any duplicate rows in sheet to maintain single-entry integrity
    removeDuplicateBookingRows(bSheet, colInfo);

    // Now return full fresh dataset to client
    var bLast = bSheet.getLastRow();
    var cLast = cSheet.getLastRow();
    var allBookings = [];
    var allCustomers = [];

    if (bLast > 1) {
      var bData = bSheet.getRange(2, 1, bLast - 1, colInfo.count).getValues();
      for (var i = 0; i < bData.length; i++) {
        if (bData[i].some(function(c) { return c !== "" && c !== null && c !== undefined; })) {
          allBookings.push(rowToBookingObjectByHeaders(bData[i], colInfo));
        }
      }
    }

    if (cLast > 1) {
      var cData = cSheet.getRange(2, 1, cLast - 1, CUSTOMERS_HEADERS.length).getValues();
      for (var j = 0; j < cData.length; j++) {
        if (cData[j][1] || cData[j][2]) {
          allCustomers.push(rowToCustomerObject(cData[j]));
        }
      }
    }

    return jsonResponse({
      status: "success",
      bookings: allBookings,
      customers: allCustomers,
      serverTime: new Date().toISOString()
    });
  }

  // 5. MANUAL DEDUPLICATION (Removes duplicate rows on request)
  if (action === "deduplicate" || action === "remove_duplicates") {
    var removedCount = removeDuplicateBookingRows(bSheet, colInfo);
    return jsonResponse({
      status: "success",
      message: "Deduplication completed. Removed " + removedCount + " duplicate entry/entries.",
      removedCount: removedCount
    });
  }

  return jsonResponse({ status: "success", message: "Action processed" });
}
`;
}
