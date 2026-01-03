# API Endpoint List for Postman

Replace `{{baseUrl}}` with your Render URL (e.g., `https://your-app.onrender.com`)

---

## 🔐 Authentication

### 1. Start Google OAuth (DOCTOR)
```
GET {{baseUrl}}/api/v1/auth/google?role=DOCTOR
```
**Description:** Initiates Google OAuth flow for doctor role. Opens in browser.

### 2. Start Google OAuth (PATIENT)
```
GET {{baseUrl}}/api/v1/auth/google?role=PATIENT
```
**Description:** Initiates Google OAuth flow for patient role. Opens in browser.

### 3. Google OAuth Callback
```
GET {{baseUrl}}/api/v1/auth/google/callback
```
**Description:** Callback endpoint (handled by Google). Returns JWT token.

---

## 👤 Users

### 4. Create User
```
POST {{baseUrl}}/api/v1/users
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "role": "PATIENT"
}
```

### 5. Get All Users
```
GET {{baseUrl}}/api/v1/users
```

### 6. Get Current User (Protected)
```
GET {{baseUrl}}/api/v1/users/me
Authorization: Bearer {{token}}
```

### 7. Get User by ID
```
GET {{baseUrl}}/api/v1/users/1
```

### 8. Update User
```
PATCH {{baseUrl}}/api/v1/users/1
Content-Type: application/json

{
  "name": "Jane Doe"
}
```

### 9. Delete User
```
DELETE {{baseUrl}}/api/v1/users/1
```

---

## 👨‍⚕️ Doctors

### 10. Create Doctor Profile (Protected - DOCTOR only)
```
POST {{baseUrl}}/api/v1/doctor
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "bio": "Experienced cardiologist",
  "isActive": true
}
```

### 11. Get All Doctors
```
GET {{baseUrl}}/api/v1/doctor
```

### 12. Get Doctor by ID
```
GET {{baseUrl}}/api/v1/doctor/1
```

### 13. Update Doctor
```
PATCH {{baseUrl}}/api/v1/doctor/1
Content-Type: application/json

{
  "bio": "Updated bio",
  "isActive": true
}
```

### 14. Delete Doctor
```
DELETE {{baseUrl}}/api/v1/doctor/1
```

---

## 🏥 Patients

### 15. Create Patient Profile (Protected - PATIENT only)
```
POST {{baseUrl}}/api/v1/patient
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "gender": "Male",
  "dob": "1990-01-01",
  "bloodGroup": "O+",
  "phone": "+1234567890"
}
```

### 16. Get All Patients
```
GET {{baseUrl}}/api/v1/patient
```

### 17. Get Patient by ID
```
GET {{baseUrl}}/api/v1/patient/1
```

### 18. Update Patient
```
PATCH {{baseUrl}}/api/v1/patient/1
Content-Type: application/json

{
  "phone": "+9876543210"
}
```

### 19. Delete Patient
```
DELETE {{baseUrl}}/api/v1/patient/1
```

---

## 📅 Schedule Rules

### 20. Create Schedule Rule
```
POST {{baseUrl}}/api/v1/schedule-rules
Content-Type: application/json

{
  "doctorId": 1,
  "clinicId": null,
  "dayOfWeek": "MON",
  "meetingType": "ONLINE",
  "timeOfDay": "MORNING",
  "startMinute": 540,
  "endMinute": 720,
  "slotDurationMin": 15,
  "capacityPerSlot": 1,
  "isActive": true
}
```
**Note:** `startMinute` 540 = 9:00 AM, `endMinute` 720 = 12:00 PM

### 21. Get All Schedule Rules
```
GET {{baseUrl}}/api/v1/schedule-rules
```

### 22. Get Schedule Rules by Doctor
```
GET {{baseUrl}}/api/v1/schedule-rules?doctorId=1
```

### 23. Get Schedule Rule by ID
```
GET {{baseUrl}}/api/v1/schedule-rules/1
```

### 24. Update Schedule Rule
```
PATCH {{baseUrl}}/api/v1/schedule-rules/1
Content-Type: application/json

{
  "isActive": false
}
```

### 25. Delete Schedule Rule
```
DELETE {{baseUrl}}/api/v1/schedule-rules/1
```

---

## 🗓️ Availability Slots

### 26. Generate Slots
```
POST {{baseUrl}}/api/v1/availability-slots/generate
Content-Type: application/json

{
  "doctorId": 1,
  "dateFrom": "2026-01-06",
  "dateTo": "2026-01-12"
}
```
**Description:** Generates availability slots based on schedule rules for the date range.

### 27. Search Slots (by date range)
```
GET {{baseUrl}}/api/v1/availability-slots/search?doctorId=1&dateFrom=2026-01-06&dateTo=2026-01-12
```

### 28. Search Slots (single day)
```
GET {{baseUrl}}/api/v1/availability-slots/search?doctorId=1&date=2026-01-06
```

### 29. Search Slots with Filters
```
GET {{baseUrl}}/api/v1/availability-slots/search?doctorId=1&dateFrom=2026-01-06&dateTo=2026-01-12&meetingType=ONLINE&timeOfDay=MORNING&status=AVAILABLE
```
**Filters:**
- `meetingType`: `ONLINE` | `OFFLINE`
- `timeOfDay`: `MORNING` | `EVENING`
- `status`: `AVAILABLE` | `FULL` | `UNAVAILABLE`

### 30. Update Slot
```
PATCH {{baseUrl}}/api/v1/availability-slots/1
Content-Type: application/json

{
  "status": "FULL",
  "bookedCount": 1
}
```

### 31. Create Extra Slots (Ad-hoc)
```
POST {{baseUrl}}/api/v1/availability-slots/create-extra
Content-Type: application/json

{
  "doctorId": 1,
  "date": "2026-01-06",
  "meetingType": "ONLINE",
  "timeOfDay": "EVENING",
  "startMinute": 1080,
  "endMinute": 1200,
  "slotDurationMin": 30,
  "capacity": 2
}
```
**Note:** `startMinute` 1080 = 6:00 PM, `endMinute` 1200 = 8:00 PM

---

## 🏥 Health Check

### 32. Health Check
```
GET {{baseUrl}}/api/v1/health
```
**Description:** Checks if the API and database are running.

---

## 📝 Notes

### Time Format
- Times are stored as **minutes since midnight**
- Examples:
  - 9:00 AM = 540 minutes
  - 12:00 PM = 720 minutes
  - 6:00 PM = 1080 minutes
  - 10:00 PM = 1320 minutes

### Day of Week
- `MON`, `TUE`, `WED`, `THU`, `FRI`, `SAT`, `SUN`

### Meeting Types
- `ONLINE` - Virtual appointments
- `OFFLINE` - In-person at clinic

### Time of Day
- `MORNING` - Morning slots
- `EVENING` - Evening slots

### Slot Status
- `AVAILABLE` - Open for booking
- `FULL` - All capacity booked
- `UNAVAILABLE` - Blocked/cancelled
