package com.msdfs.booking.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.msdfs.booking.model.Booking
import com.msdfs.booking.model.BookingStatus
import com.msdfs.booking.model.PaymentStatus
import com.msdfs.booking.ui.theme.*
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookingsScreen(
    bookings: List<Booking>,
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    onNewBookingClick: () -> Unit,
    onBookingClick: (Booking) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var selectedTab by remember { mutableStateOf("All") }
    val today = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()) }

    // Filter bookings by tab and search query
    val filteredBookings = remember(bookings, searchQuery, selectedTab) {
        bookings.filter { b ->
            val matchesTab = when (selectedTab) {
                "Today" -> b.scheduleDate == today
                "Pending" -> b.bookingStatus == BookingStatus.Pending || b.bookingStatus == BookingStatus.New
                "Assigned" -> b.bookingStatus == BookingStatus.StaffAssigned
                "Completed" -> b.bookingStatus == BookingStatus.Completed
                else -> true
            }
            val q = searchQuery.trim().lowercase()
            val matchesSearch = q.isEmpty() ||
                    b.bookingRef.lowercase().contains(q) ||
                    b.customerName.lowercase().contains(q) ||
                    b.customerMobile.contains(q) ||
                    b.serviceType.lowercase().contains(q) ||
                    b.serviceLocation.lowercase().contains(q) ||
                    b.assignedStaffNames.any { it.lowercase().contains(q) }

            matchesTab && matchesSearch
        }
    }

    // Top metrics
    val todayCount = remember(bookings, today) { bookings.count { it.scheduleDate == today } }
    val totalRevenue = remember(bookings) { bookings.sumOf { it.amount } }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "MSDFS Facility Services",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = Color.White
                        )
                        Text(
                            text = "Pondicherry Booking Management",
                            fontSize = 12.sp,
                            color = Color(0xFF93C5FD)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = BluePrimary,
                    titleContentColor = Color.White
                ),
                actions = {
                    IconButton(onClick = onNewBookingClick) {
                        Icon(
                            imageVector = Icons.Default.AddCircle,
                            contentDescription = "New Booking",
                            tint = Color.White
                        )
                    }
                }
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onNewBookingClick,
                containerColor = EmeraldAccent,
                contentColor = Color.White,
                icon = { Icon(Icons.Default.Add, contentDescription = null) },
                text = { Text("New Booking", fontWeight = FontWeight.Bold) }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(SlateBackground)
        ) {
            // Metrics Banner (Requirement 5)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                MetricCard(
                    title = "Today's Bookings",
                    value = "$todayCount",
                    color = BluePrimary,
                    modifier = Modifier.weight(1f)
                )
                MetricCard(
                    title = "Total Active",
                    value = "${bookings.size}",
                    color = EmeraldAccent,
                    modifier = Modifier.weight(1f)
                )
                MetricCard(
                    title = "Revenue",
                    value = "₹${totalRevenue.toInt()}",
                    color = AmberAccent,
                    modifier = Modifier.weight(1.2f)
                )
            }

            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = onSearchChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                placeholder = { Text("Search Ref, Customer, Phone, Staff...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Color.Gray) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { onSearchChange("") }) {
                            Icon(Icons.Default.Clear, contentDescription = null)
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = BluePrimary,
                    unfocusedContainerColor = Color.White,
                    focusedContainerColor = Color.White
                )
            )

            // Tabs / Filters
            val tabs = listOf("All", "Today", "Pending", "Assigned", "Completed")
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                tabs.forEach { tab ->
                    val selected = selectedTab == tab
                    FilterChip(
                        selected = selected,
                        onClick = { selectedTab = tab },
                        label = { Text(tab) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = BluePrimary,
                            selectedLabelColor = Color.White
                        )
                    )
                }
            }

            // Bookings List (Spreadsheet card view optimized for mobile)
            if (filteredBookings.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.EventNote,
                            contentDescription = null,
                            modifier = Modifier.size(56.dp),
                            tint = Color.LightGray
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "No bookings found",
                            fontSize = 16.sp,
                            color = Color.Gray,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = "Tap + New Booking to record a customer service call",
                            fontSize = 12.sp,
                            color = Color.LightGray
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(filteredBookings, key = { it.id }) { booking ->
                        BookingItemCard(
                            booking = booking,
                            onClick = { onBookingClick(booking) },
                            onCallCustomer = {
                                val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${booking.customerMobile}"))
                                context.startActivity(intent)
                            },
                            onWhatsAppCustomer = {
                                val text = "Hello ${booking.customerName}, regarding your booking ${booking.bookingRef} for ${booking.serviceType} with MSD Facility Services."
                                val url = "https://api.whatsapp.com/send?phone=91${booking.customerMobile}&text=${URLEncoder.encode(text, "UTF-8")}"
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                context.startActivity(intent)
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun MetricCard(
    title: String,
    value: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        shape = RoundedCornerShape(8.dp)
    ) {
        Column(
            modifier = Modifier
                .padding(8.dp)
                .fillMaxWidth()
        ) {
            Text(title, fontSize = 10.sp, color = Color.Gray, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(value, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = color)
        }
    }
}

@Composable
fun BookingItemCard(
    booking: Booking,
    onClick: () -> Unit,
    onCallCustomer: () -> Unit,
    onWhatsAppCustomer: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.5.dp),
        shape = RoundedCornerShape(10.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Header Row: Reference & Status
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = booking.bookingRef,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 13.sp,
                    color = BluePrimary
                )
                StatusBadge(status = booking.bookingStatus)
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Customer Name & Location
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = booking.customerName,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = SlateDark
                    )
                    Text(
                        text = "${booking.serviceLocation} • ${booking.fullAddress.ifEmpty { "Pondicherry" }}",
                        fontSize = 12.sp,
                        color = Color.Gray,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // Amount
                Text(
                    text = if (booking.isAfterVisit) "After Visit" else "₹${booking.amount.toInt()}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = EmeraldAccent
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = SlateBorder)

            // Service & Staff details
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "🧹 ${booking.serviceType} (Qty: ${booking.quantity})",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        color = SlateDark
                    )
                    Text(
                        text = "📅 ${booking.scheduleDate} • Slot ${booking.slotNumber} (${booking.slotPeriod.name})",
                        fontSize = 11.sp,
                        color = Color.Gray
                    )
                    if (booking.assignedStaffNames.isNotEmpty()) {
                        Text(
                            text = "👷 Staff: ${booking.assignedStaffNames.joinToString(", ")}",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = BlueSecondary
                        )
                    } else {
                        Text(
                            text = "⚠️ Staff Unassigned",
                            fontSize = 11.sp,
                            color = AmberAccent
                        )
                    }
                }

                // Call & WhatsApp quick shortcuts
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    IconButton(onClick = onCallCustomer, modifier = Modifier.size(36.dp)) {
                        Icon(
                            Icons.Default.Phone,
                            contentDescription = "Call",
                            tint = BlueSecondary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    IconButton(onClick = onWhatsAppCustomer, modifier = Modifier.size(36.dp)) {
                        Icon(
                            Icons.Default.Send,
                            contentDescription = "WhatsApp",
                            tint = EmeraldAccent,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun StatusBadge(status: BookingStatus) {
    val (bg, text) = when (status) {
        BookingStatus.New -> Color(0xFFEFF6FF) to Color(0xFF1D4ED8)
        BookingStatus.Pending -> Color(0xFFFEF3C7) to Color(0xFFB45309)
        BookingStatus.Confirmed -> Color(0xFFECFDF5) to Color(0xFF047857)
        BookingStatus.StaffAssigned -> Color(0xFFF0FDF4) to Color(0xFF15803D)
        BookingStatus.InProgress -> Color(0xFFF3E8FF) to Color(0xFF7E22CE)
        BookingStatus.Completed -> Color(0xFFDCFCE7) to Color(0xFF166534)
        BookingStatus.Cancelled -> Color(0xFFFEE2E2) to Color(0xFFB91C1C)
        BookingStatus.Rescheduled -> Color(0xFFFFF7ED) to Color(0xFFC2410C)
    }

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(bg)
            .padding(horizontal = 8.dp, vertical = 2.dp)
    ) {
        Text(
            text = status.displayName,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = text
        )
    }
}
