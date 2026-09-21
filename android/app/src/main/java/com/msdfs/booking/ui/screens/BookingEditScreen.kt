package com.msdfs.booking.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.msdfs.booking.data.InitialData
import com.msdfs.booking.model.*
import com.msdfs.booking.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookingEditScreen(
    initialBooking: Booking?,
    staffList: List<StaffMember>,
    onSave: (Booking) -> Unit,
    onDelete: ((String) -> Unit)?,
    onBack: () -> Unit
) {
    val today = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()) }

    var customerName by remember { mutableStateOf(initialBooking?.customerName ?: "") }
    var customerMobile by remember { mutableStateOf(initialBooking?.customerMobile ?: "") }
    var scheduleDate by remember { mutableStateOf(initialBooking?.scheduleDate ?: today) }
    var slotNumber by remember { mutableStateOf(initialBooking?.slotNumber ?: 1) }
    var serviceType by remember { mutableStateOf(initialBooking?.serviceType ?: InitialData.WEBSITE_SERVICES.first()) }
    var quantity by remember { mutableStateOf(initialBooking?.quantity?.toString() ?: "1") }
    var serviceDescription by remember { mutableStateOf(initialBooking?.serviceDescription ?: "") }
    var serviceLocation by remember { mutableStateOf(initialBooking?.serviceLocation ?: "Puducherry") }
    var fullAddress by remember { mutableStateOf(initialBooking?.fullAddress ?: "") }
    var amount by remember { mutableStateOf(initialBooking?.amount?.toString() ?: "0") }
    var isAfterVisit by remember { mutableStateOf(initialBooking?.isAfterVisit ?: false) }
    var advanceAmount by remember { mutableStateOf(initialBooking?.advanceAmount?.toString() ?: "0") }
    var selectedStaffIds by remember { mutableStateOf(initialBooking?.assignedStaffIds ?: emptyList()) }
    var bookingStatus by remember { mutableStateOf(initialBooking?.bookingStatus ?: BookingStatus.New) }
    var paymentStatus by remember { mutableStateOf(initialBooking?.paymentStatus ?: PaymentStatus.Pending) }
    var notes by remember { mutableStateOf(initialBooking?.notes ?: "") }

    var showServiceDropdown by remember { mutableStateOf(false) }
    var showLocationDropdown by remember { mutableStateOf(false) }
    var showStatusDropdown by remember { mutableStateOf(false) }
    var showPaymentDropdown by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        if (initialBooking == null) "New Booking" else "Edit ${initialBooking.bookingRef}",
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
                    }
                },
                actions = {
                    if (initialBooking != null && onDelete != null) {
                        IconButton(onClick = { onDelete(initialBooking.id); onBack() }) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color(0xFFFCA5A5))
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BluePrimary)
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(SlateBackground)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Customer Info Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(10.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Customer Details", fontWeight = FontWeight.Bold, color = BluePrimary)

                    OutlinedTextField(
                        value = customerName,
                        onValueChange = { customerName = it },
                        label = { Text("Customer Name *") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = customerMobile,
                        onValueChange = { customerMobile = it },
                        label = { Text("Mobile Number (10 Digits) *") },
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        singleLine = true
                    )
                }
            }

            // Service & Schedule Info
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(10.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Service & Schedule", fontWeight = FontWeight.Bold, color = BluePrimary)

                    // Service Dropdown
                    Box(modifier = Modifier.fillMaxWidth()) {
                        OutlinedTextField(
                            value = serviceType,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Service Type *") },
                            modifier = Modifier.fillMaxWidth(),
                            trailingIcon = {
                                TextButton(onClick = { showServiceDropdown = true }) {
                                    Text("Change")
                                }
                            }
                        )
                        DropdownMenu(
                            expanded = showServiceDropdown,
                            onDismissRequest = { showServiceDropdown = false }
                        ) {
                            InitialData.WEBSITE_SERVICES.forEach { srv ->
                                DropdownMenuItem(
                                    text = { Text(srv) },
                                    onClick = {
                                        serviceType = srv
                                        showServiceDropdown = false
                                    }
                                )
                            }
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = quantity,
                            onValueChange = { quantity = it },
                            label = { Text("Quantity (Qty)") },
                            modifier = Modifier.weight(1f),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                        )

                        OutlinedTextField(
                            value = scheduleDate,
                            onValueChange = { scheduleDate = it },
                            label = { Text("Date (YYYY-MM-DD)") },
                            modifier = Modifier.weight(1.5f)
                        )
                    }

                    // Slot Picker (1-10)
                    Text("Select Time Slot (1 to 10)", fontSize = 12.sp, color = Color.Gray)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        (1..5).forEach { slot ->
                            FilterChip(
                                selected = slotNumber == slot,
                                onClick = { slotNumber = slot },
                                label = { Text("S$slot") }
                            )
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        (6..10).forEach { slot ->
                            FilterChip(
                                selected = slotNumber == slot,
                                onClick = { slotNumber = slot },
                                label = { Text("S$slot") }
                            )
                        }
                    }

                    OutlinedTextField(
                        value = serviceDescription,
                        onValueChange = { serviceDescription = it },
                        label = { Text("Work Scope / Description") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            // Location
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(10.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Location & Address", fontWeight = FontWeight.Bold, color = BluePrimary)

                    Box(modifier = Modifier.fillMaxWidth()) {
                        OutlinedTextField(
                            value = serviceLocation,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Area / Location") },
                            modifier = Modifier.fillMaxWidth(),
                            trailingIcon = {
                                TextButton(onClick = { showLocationDropdown = true }) {
                                    Text("Select")
                                }
                            }
                        )
                        DropdownMenu(
                            expanded = showLocationDropdown,
                            onDismissRequest = { showLocationDropdown = false }
                        ) {
                            InitialData.LOCATIONS.forEach { loc ->
                                DropdownMenuItem(
                                    text = { Text(loc) },
                                    onClick = {
                                        serviceLocation = loc
                                        showLocationDropdown = false
                                    }
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = fullAddress,
                        onValueChange = { fullAddress = it },
                        label = { Text("Full Address & Landmarks") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2
                    )
                }
            }

            // Staff Assignment (Requirement 5)
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(10.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Assign Staff Members", fontWeight = FontWeight.Bold, color = BluePrimary)

                    staffList.forEach { staff ->
                        val isSelected = selectedStaffIds.contains(staff.id)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(
                                    if (isSelected) Color(0xFFEFF6FF) else Color.Transparent,
                                    RoundedCornerShape(6.dp)
                                )
                                .padding(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = isSelected,
                                onCheckedChange = { checked ->
                                    selectedStaffIds = if (checked) {
                                        selectedStaffIds + staff.id
                                    } else {
                                        selectedStaffIds - staff.id
                                    }
                                }
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Column {
                                Text(staff.name, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                Text(
                                    if (staff.mobile.isNotBlank()) "Ph: ${staff.mobile}" else "No phone",
                                    fontSize = 11.sp,
                                    color = Color.Gray
                                )
                            }
                        }
                    }
                }
            }

            // Billing & Status
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(10.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Amount & Status", fontWeight = FontWeight.Bold, color = BluePrimary)

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = isAfterVisit,
                            onCheckedChange = { isAfterVisit = it }
                        )
                        Text("Quote / Decide Amount After Visit", fontSize = 13.sp)
                    }

                    if (!isAfterVisit) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = amount,
                                onValueChange = { amount = it },
                                label = { Text("Total Amount (₹)") },
                                modifier = Modifier.weight(1f),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                            )

                            OutlinedTextField(
                                value = advanceAmount,
                                onValueChange = { advanceAmount = it },
                                label = { Text("Advance (₹)") },
                                modifier = Modifier.weight(1f),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                            )
                        }
                    }

                    // Status Dropdown
                    Box(modifier = Modifier.fillMaxWidth()) {
                        OutlinedTextField(
                            value = bookingStatus.displayName,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Booking Status") },
                            modifier = Modifier.fillMaxWidth(),
                            trailingIcon = {
                                TextButton(onClick = { showStatusDropdown = true }) {
                                    Text("Change")
                                }
                            }
                        )
                        DropdownMenu(
                            expanded = showStatusDropdown,
                            onDismissRequest = { showStatusDropdown = false }
                        ) {
                            BookingStatus.entries.forEach { st ->
                                DropdownMenuItem(
                                    text = { Text(st.displayName) },
                                    onClick = {
                                        bookingStatus = st
                                        showStatusDropdown = false
                                    }
                                )
                            }
                        }
                    }
                }
            }

            // Save Action
            Button(
                onClick = {
                    val assignedNames = staffList
                        .filter { selectedStaffIds.contains(it.id) }
                        .map { it.name }

                    val period = when (slotNumber) {
                        in 1..3 -> SlotPeriod.Morning
                        in 4..7 -> SlotPeriod.Afternoon
                        else -> SlotPeriod.Evening
                    }

                    val totalAmt = amount.toDoubleOrNull() ?: 0.0
                    val advAmt = advanceAmount.toDoubleOrNull() ?: 0.0
                    val balAmt = (totalAmt - advAmt).coerceAtLeast(0.0)

                    val bookingToSave = (initialBooking ?: Booking(
                        id = "",
                        bookingRef = "",
                        bookingDate = today,
                        scheduleDate = scheduleDate,
                        customerName = customerName,
                        customerMobile = customerMobile,
                        serviceType = serviceType,
                        serviceLocation = serviceLocation,
                        fullAddress = fullAddress,
                        slotNumber = slotNumber,
                        slotPeriod = period
                    )).copy(
                        customerName = customerName.trim().ifEmpty { "Customer" },
                        customerMobile = customerMobile.trim(),
                        scheduleDate = scheduleDate,
                        slotNumber = slotNumber,
                        slotPeriod = period,
                        serviceType = serviceType,
                        quantity = quantity.toIntOrNull() ?: 1,
                        serviceDescription = serviceDescription,
                        serviceLocation = serviceLocation,
                        fullAddress = fullAddress,
                        assignedStaffIds = selectedStaffIds,
                        assignedStaffNames = assignedNames,
                        amount = totalAmt,
                        isAfterVisit = isAfterVisit,
                        advanceAmount = advAmt,
                        balanceAmount = balAmt,
                        bookingStatus = bookingStatus,
                        paymentStatus = paymentStatus,
                        notes = notes
                    )

                    onSave(bookingToSave)
                    onBack()
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = EmeraldAccent),
                shape = RoundedCornerShape(10.dp)
            ) {
                Icon(Icons.Default.Check, contentDescription = null)
                Spacer(modifier = Modifier.width(6.dp))
                Text("Save Booking & Sync", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }
    }
}
