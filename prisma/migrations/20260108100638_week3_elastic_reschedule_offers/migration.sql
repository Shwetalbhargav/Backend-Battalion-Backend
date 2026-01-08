-- CreateEnum
CREATE TYPE "RescheduleOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'AUTO_MOVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RescheduleOfferReason" AS ENUM ('SHRINK', 'OTHER');

-- CreateEnum
CREATE TYPE "ElasticChangeType" AS ENUM ('EXPAND', 'SHRINK', 'CAPACITY');

-- DropIndex
DROP INDEX "Appointment_slotId_key";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "displacedAt" TIMESTAMP(3),
ADD COLUMN     "displacedReason" TEXT;

-- AlterTable
ALTER TABLE "AvailabilitySession" ADD COLUMN     "strategy" "SchedulingStrategy" NOT NULL DEFAULT 'STREAM';

-- CreateTable
CREATE TABLE "AppointmentRescheduleOfferGroup" (
    "id" SERIAL NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "doctorId" INTEGER,
    "reason" "RescheduleOfferReason" NOT NULL DEFAULT 'SHRINK',
    "status" "RescheduleOfferStatus" NOT NULL DEFAULT 'PENDING',
    "autoMoveSlotId" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentRescheduleOfferGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentRescheduleOffer" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "slotId" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "status" "RescheduleOfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentRescheduleOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElasticChangeLog" (
    "id" SERIAL NOT NULL,
    "doctorId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "timeOfDay" "TimeOfDay" NOT NULL,
    "changeType" "ElasticChangeType" NOT NULL,
    "oldStartMinute" INTEGER,
    "oldEndMinute" INTEGER,
    "newStartMinute" INTEGER,
    "newEndMinute" INTEGER,
    "strategy" "SchedulingStrategy",
    "impactedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElasticChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppointmentRescheduleOfferGroup_appointmentId_status_idx" ON "AppointmentRescheduleOfferGroup"("appointmentId", "status");

-- CreateIndex
CREATE INDEX "AppointmentRescheduleOfferGroup_doctorId_createdAt_idx" ON "AppointmentRescheduleOfferGroup"("doctorId", "createdAt");

-- CreateIndex
CREATE INDEX "AppointmentRescheduleOffer_slotId_idx" ON "AppointmentRescheduleOffer"("slotId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentRescheduleOffer_groupId_slotId_key" ON "AppointmentRescheduleOffer"("groupId", "slotId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentRescheduleOffer_groupId_rank_key" ON "AppointmentRescheduleOffer"("groupId", "rank");

-- CreateIndex
CREATE INDEX "ElasticChangeLog_doctorId_date_timeOfDay_idx" ON "ElasticChangeLog"("doctorId", "date", "timeOfDay");

-- CreateIndex
CREATE INDEX "ElasticChangeLog_doctorId_createdAt_idx" ON "ElasticChangeLog"("doctorId", "createdAt");

-- CreateIndex
CREATE INDEX "Appointment_slotId_idx" ON "Appointment"("slotId");

-- AddForeignKey
ALTER TABLE "AppointmentRescheduleOfferGroup" ADD CONSTRAINT "AppointmentRescheduleOfferGroup_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRescheduleOfferGroup" ADD CONSTRAINT "AppointmentRescheduleOfferGroup_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRescheduleOfferGroup" ADD CONSTRAINT "AppointmentRescheduleOfferGroup_autoMoveSlotId_fkey" FOREIGN KEY ("autoMoveSlotId") REFERENCES "AvailabilitySlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRescheduleOffer" ADD CONSTRAINT "AppointmentRescheduleOffer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AppointmentRescheduleOfferGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRescheduleOffer" ADD CONSTRAINT "AppointmentRescheduleOffer_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "AvailabilitySlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElasticChangeLog" ADD CONSTRAINT "ElasticChangeLog_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
