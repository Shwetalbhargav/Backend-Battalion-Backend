/*
  Warnings:

  - You are about to drop the column `experienceYears` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `specialization` on the `Doctor` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sessionId,startMinute]` on the table `AvailabilitySlot` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sessionId` to the `AvailabilitySlot` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "AvailabilitySlot_doctorId_date_meetingType_startMinute_endM_key";

-- AlterTable
ALTER TABLE "AvailabilitySlot" ADD COLUMN     "locationKey" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN     "sessionId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Doctor" DROP COLUMN "experienceYears",
DROP COLUMN "specialization";

-- CreateTable
CREATE TABLE "AvailabilitySession" (
    "id" SERIAL NOT NULL,
    "doctorId" INTEGER NOT NULL,
    "clinicId" INTEGER,
    "meetingType" "MeetingType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "timeOfDay" "TimeOfDay" NOT NULL,
    "locationKey" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "AvailabilitySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorDayOverride" (
    "id" SERIAL NOT NULL,
    "doctorId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorDayOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorSessionOverride" (
    "id" SERIAL NOT NULL,
    "doctorId" INTEGER NOT NULL,
    "clinicId" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "meetingType" "MeetingType" NOT NULL,
    "timeOfDay" "TimeOfDay" NOT NULL,
    "locationKey" TEXT NOT NULL DEFAULT 'NONE',
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "startMinute" INTEGER,
    "endMinute" INTEGER,
    "slotDurationMin" INTEGER,
    "capacityPerSlot" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorSessionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvailabilitySession_doctorId_date_timeOfDay_idx" ON "AvailabilitySession"("doctorId", "date", "timeOfDay");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilitySession_doctorId_date_meetingType_timeOfDay_loc_key" ON "AvailabilitySession"("doctorId", "date", "meetingType", "timeOfDay", "locationKey");

-- CreateIndex
CREATE INDEX "DoctorDayOverride_doctorId_date_idx" ON "DoctorDayOverride"("doctorId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorDayOverride_doctorId_date_key" ON "DoctorDayOverride"("doctorId", "date");

-- CreateIndex
CREATE INDEX "DoctorSessionOverride_doctorId_date_timeOfDay_idx" ON "DoctorSessionOverride"("doctorId", "date", "timeOfDay");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorSessionOverride_doctorId_date_meetingType_timeOfDay_l_key" ON "DoctorSessionOverride"("doctorId", "date", "meetingType", "timeOfDay", "locationKey");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilitySlot_sessionId_startMinute_key" ON "AvailabilitySlot"("sessionId", "startMinute");

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AvailabilitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySession" ADD CONSTRAINT "AvailabilitySession_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySession" ADD CONSTRAINT "AvailabilitySession_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorDayOverride" ADD CONSTRAINT "DoctorDayOverride_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorSessionOverride" ADD CONSTRAINT "DoctorSessionOverride_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorSessionOverride" ADD CONSTRAINT "DoctorSessionOverride_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
