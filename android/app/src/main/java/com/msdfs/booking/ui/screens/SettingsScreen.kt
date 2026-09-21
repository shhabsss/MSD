package com.msdfs.booking.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.msdfs.booking.model.AppSettings
import com.msdfs.booking.ui.theme.BluePrimary
import com.msdfs.booking.ui.theme.EmeraldAccent
import com.msdfs.booking.ui.theme.SlateBackground

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    settings: AppSettings,
    onSaveSettings: (AppSettings) -> Unit,
    onTestSync: () -> Unit
) {
    var webAppUrl by remember(settings) { mutableStateOf(settings.googleSheetWebAppUrl) }
    var companyName by remember(settings) { mutableStateOf(settings.company.name) }
    var mobile by remember(settings) { mutableStateOf(settings.company.mobile) }
    var email by remember(settings) { mutableStateOf(settings.company.email) }
    var isSavedSnackbar by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings & Cloud Sync", fontWeight = FontWeight.Bold, color = Color.White) },
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
            // Google Sheets Sync Card (Requirement 6 & 7)
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(10.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.CloudSync, contentDescription = null, tint = BluePrimary)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Google Sheet Realtime Sync", fontWeight = FontWeight.Bold, color = BluePrimary)
                    }

                    Text(
                        "Enter your Google Apps Script Web App URL to sync bookings in real-time across multiple Android phones and Google Sheets.",
                        fontSize = 12.sp,
                        color = Color.Gray
                    )

                    OutlinedTextField(
                        value = webAppUrl,
                        onValueChange = { webAppUrl = it },
                        label = { Text("Google Apps Script Web App URL") },
                        placeholder = { Text("https://script.google.com/macros/s/.../exec") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    Button(
                        onClick = {
                            val updated = settings.copy(googleSheetWebAppUrl = webAppUrl.trim())
                            onSaveSettings(updated)
                            onTestSync()
                            isSavedSnackbar = true
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = BluePrimary),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Icon(Icons.Default.Save, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Save & Sync to Sheet")
                    }
                }
            }

            // Company Info Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(10.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Info, contentDescription = null, tint = EmeraldAccent)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Company Profile & Contact", fontWeight = FontWeight.Bold, color = BluePrimary)
                    }

                    OutlinedTextField(
                        value = companyName,
                        onValueChange = { companyName = it },
                        label = { Text("Company Name") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = mobile,
                        onValueChange = { mobile = it },
                        label = { Text("Support Mobile") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text("Support Email") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    Button(
                        onClick = {
                            val updated = settings.copy(
                                company = settings.company.copy(
                                    name = companyName.trim(),
                                    mobile = mobile.trim(),
                                    email = email.trim()
                                )
                            )
                            onSaveSettings(updated)
                            isSavedSnackbar = true
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = EmeraldAccent),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Save Company Info")
                    }
                }
            }

            if (isSavedSnackbar) {
                Snackbar(
                    action = {
                        TextButton(onClick = { isSavedSnackbar = false }) {
                            Text("OK", color = Color.White)
                        }
                    }
                ) {
                    Text("Settings saved successfully!")
                }
            }
        }
    }
}
