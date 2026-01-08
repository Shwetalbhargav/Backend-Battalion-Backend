import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RescheduleOfferStatus, SlotStatus } from '@prisma/client';

@Injectable()
export class RescheduleAutoMoveWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RescheduleAutoMoveWorker.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const enabled =
      String(process.env.RESCHEDULE_AUTO_MOVE_ENABLED ?? 'true') === 'true';
    const intervalMs = Number(
      process.env.RESCHEDULE_AUTO_MOVE_INTERVAL_MS ?? 60_000,
    );

    if (!enabled) return;

    this.tickSafe();
    this.timer = setInterval(() => this.tickSafe(), intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tickSafe() {
    try {
      const res = await this.autoMoveExpired(50);
      if (res.processed)
        this.logger.log(
          `auto-move processed=${res.processed}, moved=${res.moved}`,
        );
    } catch (e: any) {
      this.logger.error(`auto-move tick failed: ${e?.message ?? e}`);
    }
  }

  private async autoMoveExpired(limit: number) {
    const now = new Date();

    const groups = await this.prisma.appointmentRescheduleOfferGroup.findMany({
      where: { status: RescheduleOfferStatus.PENDING, expiresAt: { lte: now } },
      orderBy: { expiresAt: 'asc' },
      take: limit,
      include: { offers: { orderBy: { rank: 'asc' } } },
    });

    let moved = 0;

    for (const g of groups) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const fresh = await tx.appointmentRescheduleOfferGroup.findUnique({
            where: { id: g.id },
            select: { status: true },
          });
          if (!fresh || fresh.status !== RescheduleOfferStatus.PENDING) return;

          // pick first offer slot that still has capacity
          let chosenSlotId: number | null = null;

          for (const offer of g.offers) {
            const reserved = await tx.availabilitySlot.updateMany({
              where: {
                id: offer.slotId,
                status: { in: [SlotStatus.AVAILABLE, SlotStatus.FULL] },
                bookedCount: {
                  lt:
                    (
                      await tx.availabilitySlot.findUnique({
                        where: { id: offer.slotId },
                      })
                    )?.capacity ?? 0,
                },
              },
              data: { bookedCount: { increment: 1 } },
            });

            if (reserved.count === 1) {
              chosenSlotId = offer.slotId;
              break;
            }
          }

          if (!chosenSlotId) {
            // No capacity anywhere; mark group expired so it doesn’t loop forever
            await tx.appointmentRescheduleOfferGroup.update({
              where: { id: g.id },
              data: { status: RescheduleOfferStatus.EXPIRED },
            });
            await tx.appointmentRescheduleOffer.updateMany({
              where: { groupId: g.id, status: RescheduleOfferStatus.PENDING },
              data: { status: RescheduleOfferStatus.EXPIRED },
            });
            return;
          }

          // move appointment to chosen slot (note: you may also want to decrement old slot bookedCount)
          const appt = await tx.appointment.findUnique({
            where: { id: g.appointmentId },
            select: { id: true, slotId: true },
          });
          if (!appt) return;

          // decrement old slot bookedCount (best-effort)
          await tx.availabilitySlot
            .update({
              where: { id: appt.slotId },
              data: {
                bookedCount: { decrement: 1 },
                status: SlotStatus.AVAILABLE,
              },
            })
            .catch(() => undefined);

          await tx.appointment.update({
            where: { id: g.appointmentId },
            data: { slotId: chosenSlotId },
          });

          // update new slot FULL if needed
          const newSlot = await tx.availabilitySlot.findUnique({
            where: { id: chosenSlotId },
          });
          if (newSlot && newSlot.bookedCount >= newSlot.capacity) {
            await tx.availabilitySlot.update({
              where: { id: chosenSlotId },
              data: { status: SlotStatus.FULL },
            });
          }

          await tx.appointmentRescheduleOffer.updateMany({
            where: { groupId: g.id, status: RescheduleOfferStatus.PENDING },
            data: { status: RescheduleOfferStatus.EXPIRED },
          });

          await tx.appointmentRescheduleOffer.updateMany({
            where: { groupId: g.id, slotId: chosenSlotId },
            data: { status: RescheduleOfferStatus.AUTO_MOVED },
          });

          await tx.appointmentRescheduleOfferGroup.update({
            where: { id: g.id },
            data: {
              status: RescheduleOfferStatus.AUTO_MOVED,
              autoMoveSlotId: chosenSlotId,
            },
          });
        });

        moved += 1;
      } catch (e: any) {
        this.logger.error(
          `auto-move failed groupId=${g.id}: ${e?.message ?? e}`,
        );
      }
    }

    return { processed: groups.length, moved };
  }
}
