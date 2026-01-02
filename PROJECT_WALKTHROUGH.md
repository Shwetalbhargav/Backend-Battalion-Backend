# Backend Battalion - Doctor Appointment Scheduling System
## Complete Project Walkthrough

---

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [Application Architecture](#application-architecture)
5. [File-by-File Explanation](#file-by-file-explanation)
6. [API Flow Examples](#api-flow-examples)

---

## Project Overview

This is a **Doctor Appointment Scheduling System** built with NestJS and Prisma. It allows:
- **Doctors** to create recurring availability schedules
- **Patients** to search and book appointment slots
- **OAuth Authentication** via Google
- **Flexible scheduling** with online/offline meetings

**Key Features:**
- Role-based access (DOCTOR vs PATIENT)
- Recurring schedule rules (e.g., "Every Monday 9 AM - 12 PM")
- Auto-generation of bookable time slots
- Support for multiple clinics and meeting types

---

## Technology Stack

### Backend Framework
- **NestJS** - Enterprise-grade Node.js framework with TypeScript
- **Express** - HTTP server (used by NestJS)

### Database & ORM
- **PostgreSQL** - Relational database
- **Prisma** - Type-safe ORM with migrations

### Authentication
- **Passport.js** - Authentication middleware
- **passport-google-oauth20** - Google OAuth strategy
- **passport-jwt** - JWT token validation

### Validation & Transformation
- **class-validator** - DTO validation decorators
- **class-transformer** - Type conversion for DTOs

---

## Database Schema

### Core Models

#### User
```prisma
model User {
  id         Int      @id @default(autoincrement())
  email      String   @unique
  name       String?
  role       Role     @default(PATIENT)  // DOCTOR or PATIENT
  provider   String?  // "google"
  providerId String?  // Google user ID
  
  doctor     Doctor?
  patient    Patient?
}
```
**Purpose:** Central user account. Can be either a doctor or patient.

#### Doctor
```prisma
model Doctor {
  id       Int     @id @default(autoincrement())
  userId   Int     @unique
  bio      String?
  isActive Boolean @default(true)
  
  scheduleRules DoctorScheduleRule[]
  slots         AvailabilitySlot[]
}
```
**Purpose:** Doctor profile with scheduling capabilities.

#### Patient
```prisma
model Patient {
  id         Int       @id @default(autoincrement())
  userId     Int       @unique
  gender     String?
  dob        DateTime?
  bloodGroup String?
  phone      String?
}
```
**Purpose:** Patient profile with medical information.

### Scheduling Models

#### DoctorScheduleRule (Recurring Template)
```prisma
model DoctorScheduleRule {
  id              Int         @id @default(autoincrement())
  doctorId        Int
  dayOfWeek       DayOfWeek   // MON, TUE, WED, etc.
  meetingType     MeetingType // ONLINE or OFFLINE
  timeOfDay       TimeOfDay   // MORNING or EVENING
  startMinute     Int         // 540 = 9:00 AM
  endMinute       Int         // 720 = 12:00 PM
  slotDurationMin Int         @default(15)
  capacityPerSlot Int         @default(1)
  isActive        Boolean     @default(true)
}
```
**Purpose:** Defines recurring availability (e.g., "Every Monday morning, 9 AM - 12 PM, 15-min slots").

**Time Storage Logic:**
- Times stored as **minutes since midnight**
- 9:00 AM = 540 minutes (9 × 60)
- 12:00 PM = 720 minutes (12 × 60)
- This makes time calculations easier and timezone-independent

#### AvailabilitySlot (Bookable Slots)
```prisma
model AvailabilitySlot {
  id          Int        @id @default(autoincrement())
  doctorId    Int
  date        DateTime   // 2026-01-06
  startMinute Int        // 540
  endMinute   Int        // 555
  startAt     DateTime   // 2026-01-06T09:00:00Z
  endAt       DateTime   // 2026-01-06T09:15:00Z
  capacity    Int        @default(1)
  bookedCount Int        @default(0)
  status      SlotStatus // AVAILABLE, FULL, UNAVAILABLE
}
```
**Purpose:** Individual bookable time slots generated from schedule rules.

---

## Application Architecture

### Folder Structure
```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── auth/                      # Authentication module
├── users/                     # User management
├── doctor/                    # Doctor profiles
├── patient/                   # Patient profiles
├── schedule-rules/            # Recurring schedules
├── availability-slots/        # Bookable slots
└── prisma/                    # Database service
```

### NestJS Module Pattern
Each feature follows this structure:
```
feature/
├── feature.module.ts          # Module definition
├── feature.controller.ts      # HTTP routes
├── feature.service.ts         # Business logic
└── dto/                       # Data Transfer Objects
    ├── create-feature.dto.ts
    └── update-feature.dto.ts
```

---

## File-by-File Explanation

### 1. `src/main.ts` - Application Bootstrap

```typescript
import 'dotenv/config';  // Load environment variables FIRST

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Strip unknown properties
      transform: true,            // Auto-convert types
      transformOptions: { 
        enableImplicitConversion: true 
      },
    }),
  );
  
  // Add /api/v1 prefix to all routes
  app.setGlobalPrefix('api/v1');
  
  await app.listen(process.env.PORT || 3000);
}
```

**Key Concepts:**
- **ValidationPipe**: Automatically validates incoming requests against DTOs
- **whitelist: true**: Removes properties not defined in DTO (security)
- **transform: true**: Converts string "1" to number 1 automatically
- **setGlobalPrefix**: All routes become `/api/v1/...`

---

### 2. `src/app.module.ts` - Root Module

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),  // Environment variables
    PrismaModule,                               // Database
    AuthModule,                                 // Authentication
    UsersModule,                                // User CRUD
    DoctorModule,                               // Doctor profiles
    PatientModule,                              // Patient profiles
    ScheduleRulesModule,                        // Recurring schedules
    AvailabilitySlotsModule,                    // Bookable slots
  ],
  controllers: [HealthController],              // Health check
})
```

**Purpose:** Registers all feature modules and makes them available app-wide.

**HealthController:**
```typescript
@Controller('health')
class HealthController {
  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;  // Test DB connection
    return { status: 'ok' };
  }
}
```

---

### 3. Authentication Module (`src/auth/`)

#### `auth.controller.ts`
```typescript
@Controller('auth')
export class AuthController {
  
  // Start OAuth flow
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin(@Query('role') role?: string) {
    // Redirects to Google
  }
  
  // OAuth callback
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any) {
    const token = await this.auth.signJwt(req.user);
    return { token, user: req.user };
  }
}
```

**Flow:**
1. User clicks "Login with Google"
2. Frontend redirects to `/api/v1/auth/google?role=DOCTOR`
3. Google authenticates user
4. Google redirects to `/api/v1/auth/google/callback`
5. Backend creates/finds user and returns JWT token

#### `google.strategy.ts`
```typescript
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService, auth: AuthService) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID'),
      clientSecret: config.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.get('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
      passReqToCallback: true,  // Pass request to validate()
    });
  }
  
  async validate(req: any, accessToken: string, refreshToken: string, profile: any) {
    const role = req.query.state === 'DOCTOR' ? Role.DOCTOR : Role.PATIENT;
    
    const user = await this.auth.findOrCreateGoogleUser({
      email: profile.emails[0].value,
      name: profile.displayName,
      providerId: profile.id,
      role,
    });
    
    return user;  // Attached to req.user
  }
}
```

**Key Logic:**
- Extracts role from query parameter (`?role=DOCTOR`)
- Creates user if doesn't exist
- Automatically creates Doctor or Patient profile

#### `jwt.strategy.ts`
```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
    });
  }
  
  async validate(payload: any) {
    return {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };
  }
}
```

**Purpose:** Validates JWT tokens in `Authorization: Bearer <token>` header.

#### Guards
```typescript
// Only allow DOCTOR role
@Injectable()
export class DoctorOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    return request.user?.role === Role.DOCTOR;
  }
}

// Only allow PATIENT role
@Injectable()
export class PatientOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    return request.user?.role === Role.PATIENT;
  }
}
```

**Usage:**
```typescript
@Post()
@DoctorOnly()  // Only doctors can create doctor profiles
create(@Req() req: any, @Body() dto: CreateDoctorDto) {
  return this.doctorService.create({
    ...dto,
    userId: req.user.id,  // From JWT token
  });
}
```

---

### 4. Users Module (`src/users/`)

#### `users.service.ts`
```typescript
@Injectable()
export class UsersService {
  
  // Find or create user from Google OAuth
  async findOrCreateGoogleUser(input: {
    email: string;
    name: string;
    providerId: string;
    role: Role;
  }) {
    // Try to find existing user
    let user = await this.prisma.user.findUnique({
      where: {
        provider_providerId: {
          provider: 'google',
          providerId: input.providerId,
        },
      },
    });
    
    // Create if doesn't exist
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          provider: 'google',
          providerId: input.providerId,
          role: input.role,
        },
      });
    }
    
    return user;
  }
  
  // Standard CRUD operations
  async findAll() { /* ... */ }
  async findOne(id: number) { /* ... */ }
  async update(id: number, dto: UpdateUserDto) { /* ... */ }
  async remove(id: number) { /* ... */ }
}
```

**Key Logic:**
- Uses Prisma's `@@unique([provider, providerId])` constraint
- Prevents duplicate Google accounts
- Role is set during OAuth and cannot be changed

---

### 5. Schedule Rules Module (`src/schedule-rules/`)

#### `schedule-rules.service.ts`

**Create Schedule Rule:**
```typescript
async create(dto: CreateScheduleRuleDto) {
  return this.prisma.doctorScheduleRule.create({
    data: {
      doctorId: dto.doctorId,
      clinicId: dto.clinicId,
      dayOfWeek: dto.dayOfWeek,        // MON, TUE, etc.
      meetingType: dto.meetingType,    // ONLINE or OFFLINE
      timeOfDay: dto.timeOfDay,        // MORNING or EVENING
      startMinute: dto.startMinute,    // 540 = 9:00 AM
      endMinute: dto.endMinute,        // 720 = 12:00 PM
      slotDurationMin: dto.slotDurationMin,  // 15 minutes
      capacityPerSlot: dto.capacityPerSlot,  // 1 patient per slot
      isActive: dto.isActive ?? true,
    },
  });
}
```

**Example:**
```json
{
  "doctorId": 1,
  "dayOfWeek": "MON",
  "meetingType": "ONLINE",
  "timeOfDay": "MORNING",
  "startMinute": 540,    // 9:00 AM
  "endMinute": 720,      // 12:00 PM
  "slotDurationMin": 15,
  "capacityPerSlot": 1
}
```

This creates a rule: "Every Monday morning, 9 AM - 12 PM, online, 15-minute slots"

---

### 6. Availability Slots Module (`src/availability-slots/`)

This is the **most complex** module. It generates bookable slots from schedule rules.

#### `availability-slots.service.ts`

**Generate Slots Logic:**
```typescript
async generateSlots(doctorId: string, dateFromStr: string, dateToStr: string) {
  const did = Number(doctorId);
  const from = normalizeToDayStartUTC(new Date(dateFromStr));
  const to = normalizeToDayStartUTC(new Date(dateToStr));
  
  let created = 0;
  
  // Loop through each day in range
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    const dow = dayOfWeekUTC(d);  // Get day of week (MON, TUE, etc.)
    const date = normalizeToDayStartUTC(d);
    
    // Find all active schedule rules for this day
    const rules = await this.prisma.doctorScheduleRule.findMany({
      where: { 
        doctorId: did, 
        dayOfWeek: dow, 
        isActive: true 
      },
    });
    
    if (!rules.length) continue;  // No rules for this day
    
    // For each rule, generate slots
    for (const rule of rules) {
      const duration = rule.slotDurationMin;
      const range = rule.endMinute - rule.startMinute;
      const count = Math.floor(range / duration);  // Number of slots
      
      // Create session (groups slots by day/time/location)
      const session = await this.getOrCreateSession({
        doctorId: did,
        date,
        meetingType: rule.meetingType,
        timeOfDay: rule.timeOfDay,
        clinicId: rule.clinicId,
      });
      
      // Generate individual slots
      const slots = [];
      for (let i = 0; i < count; i++) {
        const startMinute = rule.startMinute + (i * duration);
        const endMinute = startMinute + duration;
        
        slots.push({
          sessionId: session.id,
          doctorId: did,
          date,
          startMinute,
          endMinute,
          startAt: addMinutesToDate(date, startMinute),
          endAt: addMinutesToDate(date, endMinute),
          capacity: rule.capacityPerSlot,
          bookedCount: 0,
          status: 'AVAILABLE',
        });
      }
      
      // Bulk insert with skipDuplicates
      const res = await this.prisma.availabilitySlot.createMany({
        data: slots,
        skipDuplicates: true,  // Prevent duplicate slots
      });
      
      created += res.count;
    }
  }
  
  return { created };
}
```

**Example Flow:**
1. Doctor has rule: "Every Monday, 9 AM - 12 PM, 15-min slots"
2. Generate slots for Jan 6-12, 2026
3. Jan 6 is Monday → Create slots:
   - 9:00-9:15, 9:15-9:30, 9:30-9:45, ..., 11:45-12:00
   - Total: 12 slots (180 minutes / 15 minutes)
4. Jan 7 is Tuesday → No rule, skip
5. Jan 13 is next Monday → Create 12 more slots

**Search Slots:**
```typescript
async searchSlots(query: {
  doctorId: string;
  dateFrom: string;
  dateTo: string;
  meetingType?: MeetingType;
  timeOfDay?: TimeOfDay;
  status?: SlotStatus;
}) {
  const did = Number(query.doctorId);
  const from = normalizeToDayStartUTC(new Date(query.dateFrom));
  const to = normalizeToDayStartUTC(new Date(query.dateTo));
  
  return this.prisma.availabilitySlot.findMany({
    where: {
      doctorId: did,
      date: { gte: from, lte: to },
      meetingType: query.meetingType,    // Optional filter
      timeOfDay: query.timeOfDay,        // Optional filter
      status: query.status,              // Optional filter
    },
    orderBy: [
      { date: 'asc' },
      { startMinute: 'asc' }
    ],
  });
}
```

**Update Slot (Booking):**
```typescript
async updateSlot(slotId: number, dto: UpdateSlotDto) {
  const existing = await this.prisma.availabilitySlot.findUnique({
    where: { id: slotId }
  });
  
  if (!existing) throw new NotFoundException('Slot not found');
  
  return this.prisma.availabilitySlot.update({
    where: { id: slotId },
    data: {
      status: dto.status,          // AVAILABLE → FULL
      bookedCount: dto.bookedCount, // 0 → 1
    },
  });
}
```

---

## API Flow Examples

### Example 1: Doctor Creates Availability

**Step 1: Login with Google**
```
GET /api/v1/auth/google?role=DOCTOR
→ Redirects to Google
→ Returns to /api/v1/auth/google/callback
→ Response: { token: "eyJhbGc...", user: {...} }
```

**Step 2: Create Schedule Rule**
```
POST /api/v1/schedule-rules
Authorization: Bearer eyJhbGc...
{
  "doctorId": 1,
  "dayOfWeek": "MON",
  "meetingType": "ONLINE",
  "timeOfDay": "MORNING",
  "startMinute": 540,
  "endMinute": 720,
  "slotDurationMin": 15,
  "capacityPerSlot": 1
}
→ Creates recurring rule
```

**Step 3: Generate Slots**
```
POST /api/v1/availability-slots/generate
{
  "doctorId": 1,
  "dateFrom": "2026-01-06",
  "dateTo": "2026-01-12"
}
→ Response: { created: 48 }
```

### Example 2: Patient Searches and Books

**Step 1: Search Available Slots**
```
GET /api/v1/availability-slots/search?doctorId=1&dateFrom=2026-01-06&dateTo=2026-01-12&status=AVAILABLE
→ Returns list of available slots
```

**Step 2: Book a Slot**
```
PATCH /api/v1/availability-slots/123
{
  "status": "FULL",
  "bookedCount": 1
}
→ Marks slot as booked
```

---

## Key Design Decisions

### 1. Time Storage as Minutes
**Why:** Simplifies calculations and avoids timezone issues.
- 9:00 AM = 540 minutes
- Easy to calculate: `endMinute - startMinute = duration`
- Timezone conversion happens only at display time

### 2. Session Grouping
**Why:** Prevents duplicate slot generation.
- Groups slots by: doctor + date + meeting type + time of day + location
- Uses `skipDuplicates` in `createMany` for idempotency

### 3. Separate Schedule Rules and Slots
**Why:** Flexibility and performance.
- **Rules** = Template (recurring pattern)
- **Slots** = Concrete bookable instances
- Can generate slots in advance (e.g., for next 3 months)
- Can create ad-hoc slots outside of rules

### 4. Role-Based Access
**Why:** Security and data integrity.
- Doctors can only create doctor profiles
- Patients can only create patient profiles
- Prevents privilege escalation

---

## Interview Talking Points

### Technical Skills Demonstrated
1. **Backend Architecture**: NestJS modules, dependency injection
2. **Database Design**: Normalized schema, proper relationships
3. **Authentication**: OAuth 2.0, JWT, role-based access
4. **API Design**: RESTful endpoints, proper HTTP methods
5. **Data Validation**: DTOs with class-validator
6. **Type Safety**: TypeScript, Prisma type generation
7. **Business Logic**: Complex scheduling algorithm

### Problem-Solving Examples
1. **Time Representation**: Chose minutes-since-midnight for simplicity
2. **Slot Generation**: Efficient bulk insert with duplicate prevention
3. **Flexible Scheduling**: Supports recurring rules + ad-hoc slots
4. **Multi-tenancy**: Supports multiple clinics per doctor

### Scalability Considerations
1. **Database Indexing**: Indexed on `doctorId`, `date`, `status`
2. **Bulk Operations**: `createMany` instead of individual inserts
3. **Pagination Ready**: Can add `skip` and `take` to queries
4. **Caching Potential**: Slot searches can be cached

---

## Next Steps / Future Enhancements

1. **Booking System**: Add `Booking` model to track patient appointments
2. **Notifications**: Email/SMS reminders for appointments
3. **Payment Integration**: Stripe/Razorpay for consultation fees
4. **Video Calls**: Integrate Zoom/Google Meet for online consultations
5. **Admin Panel**: Dashboard for managing doctors and patients
6. **Analytics**: Track booking rates, popular time slots, etc.

---

**Good luck with your internship interview! 🚀**
