package com.msdfs.booking.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.msdfs.booking.model.StaffMember
import com.msdfs.booking.ui.theme.BluePrimary
import com.msdfs.booking.ui.theme.EmeraldAccent
import com.msdfs.booking.ui.theme.SlateBackground
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StaffScreen(
    staffList: List<StaffMember>,
    onSaveStaff: (List<StaffMember>) -> Unit
) {
    var showAddDialog by remember { mutableStateOf(false) }
    var newName by remember { mutableStateOf("") }
    var newMobile by remember { mutableStateOf("") }
    var newNotes by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Staff Team & Specialists", fontWeight = FontWeight.Bold, color = Color.White) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BluePrimary)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddDialog = true },
                containerColor = EmeraldAccent,
                contentColor = Color.White
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add Staff")
            }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(SlateBackground)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(staffList, key = { it.id }) { staff ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(50),
                            color = Color(0xFFEFF6FF),
                            modifier = Modifier.size(44.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(Icons.Default.Person, contentDescription = null, tint = BluePrimary)
                            }
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(staff.name, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Phone, contentDescription = null, modifier = Modifier.size(12.dp), tint = Color.Gray)
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    if (staff.mobile.isNotBlank()) staff.mobile else "No mobile added",
                                    fontSize = 12.sp,
                                    color = Color.Gray
                                )
                            }
                            if (staff.notes.isNotBlank()) {
                                Text(staff.notes, fontSize = 11.sp, color = Color(0xFF64748B))
                            }
                        }
                    }
                }
            }
        }

        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("Add Staff Member") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = newName,
                            onValueChange = { newName = it },
                            label = { Text("Full Name") },
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = newMobile,
                            onValueChange = { newMobile = it },
                            label = { Text("Mobile Number") },
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = newNotes,
                            onValueChange = { newNotes = it },
                            label = { Text("Specialty / Notes") }
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (newName.isNotBlank()) {
                                val updated = staffList + StaffMember(
                                    id = "staff-${UUID.randomUUID().toString().take(6)}",
                                    name = newName.trim(),
                                    mobile = newMobile.trim(),
                                    notes = newNotes.trim()
                                )
                                onSaveStaff(updated)
                                newName = ""
                                newMobile = ""
                                newNotes = ""
                                showAddDialog = false
                            }
                        }
                    ) {
                        Text("Add Member")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showAddDialog = false }) { Text("Cancel") }
                }
            )
        }
    }
}
