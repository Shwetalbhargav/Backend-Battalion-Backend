/*
  Warnings:

  - You are about to drop the column `createdAt` on the `AvailabilitySlot` table. All the data in the column will be lost.
  - You are about to drop the column `endAt` on the `AvailabilitySlot` table. All the data in the column will be lost.
  - You are about to drop the column `startAt` on the `AvailabilitySlot` table. All the data in the column will be lost.
  - You are about to drop the column `timeOfDay` on the `AvailabilitySlot` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `AvailabilitySlot` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AvailabilitySlot" DROP COLUMN "createdAt",
DROP COLUMN "endAt",
DROP COLUMN "startAt",
DROP COLUMN "timeOfDay",
DROP COLUMN "updatedAt";
