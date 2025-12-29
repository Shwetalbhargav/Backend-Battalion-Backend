/*
  Warnings:

  - The primary key for the `AvailabilitySlot` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `AvailabilitySlot` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `clinicId` column on the `AvailabilitySlot` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Clinic` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Clinic` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Doctor` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Doctor` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `DoctorScheduleRule` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `DoctorScheduleRule` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `clinicId` column on the `DoctorScheduleRule` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `DoctorService` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DoctorSpecialty` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Patient` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Patient` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Service` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Service` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Specialty` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Specialty` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[provider,providerId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `doctorId` on the `AvailabilitySlot` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `userId` on the `Doctor` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `doctorId` on the `DoctorScheduleRule` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `doctorId` on the `DoctorService` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `serviceId` on the `DoctorService` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `doctorId` on the `DoctorSpecialty` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `specialtyId` on the `DoctorSpecialty` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `userId` on the `Patient` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "AvailabilitySlot" DROP CONSTRAINT "AvailabilitySlot_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "AvailabilitySlot" DROP CONSTRAINT "AvailabilitySlot_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "Doctor" DROP CONSTRAINT "Doctor_userId_fkey";

-- DropForeignKey
ALTER TABLE "DoctorScheduleRule" DROP CONSTRAINT "DoctorScheduleRule_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "DoctorScheduleRule" DROP CONSTRAINT "DoctorScheduleRule_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "DoctorService" DROP CONSTRAINT "DoctorService_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "DoctorService" DROP CONSTRAINT "DoctorService_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "DoctorSpecialty" DROP CONSTRAINT "DoctorSpecialty_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "DoctorSpecialty" DROP CONSTRAINT "DoctorSpecialty_specialtyId_fkey";

-- DropForeignKey
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_userId_fkey";

-- AlterTable
ALTER TABLE "AvailabilitySlot" DROP CONSTRAINT "AvailabilitySlot_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "doctorId",
ADD COLUMN     "doctorId" INTEGER NOT NULL,
DROP COLUMN "clinicId",
ADD COLUMN     "clinicId" INTEGER,
ADD CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Clinic" DROP CONSTRAINT "Clinic_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Doctor" DROP CONSTRAINT "Doctor_pkey",
DROP COLUMN "userId",
ADD COLUMN     "userId" INTEGER NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "DoctorScheduleRule" DROP CONSTRAINT "DoctorScheduleRule_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "doctorId",
ADD COLUMN     "doctorId" INTEGER NOT NULL,
DROP COLUMN "clinicId",
ADD COLUMN     "clinicId" INTEGER,
ADD CONSTRAINT "DoctorScheduleRule_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "DoctorService" DROP CONSTRAINT "DoctorService_pkey",
DROP COLUMN "doctorId",
ADD COLUMN     "doctorId" INTEGER NOT NULL,
DROP COLUMN "serviceId",
ADD COLUMN     "serviceId" INTEGER NOT NULL,
ADD CONSTRAINT "DoctorService_pkey" PRIMARY KEY ("doctorId", "serviceId");

-- AlterTable
ALTER TABLE "DoctorSpecialty" DROP CONSTRAINT "DoctorSpecialty_pkey",
DROP COLUMN "doctorId",
ADD COLUMN     "doctorId" INTEGER NOT NULL,
DROP COLUMN "specialtyId",
ADD COLUMN     "specialtyId" INTEGER NOT NULL,
ADD CONSTRAINT "DoctorSpecialty_pkey" PRIMARY KEY ("doctorId", "specialtyId");

-- AlterTable
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "userId",
ADD COLUMN     "userId" INTEGER NOT NULL,
ADD CONSTRAINT "Patient_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Service" DROP CONSTRAINT "Service_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Service_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Specialty" DROP CONSTRAINT "Specialty_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Specialty_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerId" TEXT,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "AvailabilitySlot_doctorId_date_status_idx" ON "AvailabilitySlot"("doctorId", "date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilitySlot_doctorId_date_meetingType_startMinute_endM_key" ON "AvailabilitySlot"("doctorId", "date", "meetingType", "startMinute", "endMinute");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_userId_key" ON "Doctor"("userId");

-- CreateIndex
CREATE INDEX "DoctorScheduleRule_doctorId_dayOfWeek_isActive_idx" ON "DoctorScheduleRule"("doctorId", "dayOfWeek", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorScheduleRule_doctorId_meetingType_dayOfWeek_timeOfDay_key" ON "DoctorScheduleRule"("doctorId", "meetingType", "dayOfWeek", "timeOfDay", "startMinute", "endMinute");

-- CreateIndex
CREATE INDEX "DoctorService_serviceId_idx" ON "DoctorService"("serviceId");

-- CreateIndex
CREATE INDEX "DoctorSpecialty_specialtyId_idx" ON "DoctorSpecialty"("specialtyId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_userId_key" ON "Patient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_provider_providerId_key" ON "User"("provider", "providerId");

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorSpecialty" ADD CONSTRAINT "DoctorSpecialty_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorSpecialty" ADD CONSTRAINT "DoctorSpecialty_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorService" ADD CONSTRAINT "DoctorService_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorService" ADD CONSTRAINT "DoctorService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorScheduleRule" ADD CONSTRAINT "DoctorScheduleRule_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorScheduleRule" ADD CONSTRAINT "DoctorScheduleRule_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
