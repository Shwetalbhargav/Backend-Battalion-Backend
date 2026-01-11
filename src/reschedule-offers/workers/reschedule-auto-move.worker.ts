// src/reschedule-offers/workers/reschedule-auto-move.worker.ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AppointmentRescheduleOffersService } from '../appointment-reschedule-offers.service';

/**
 * Lightweight worker (no extra deps) that runs inside the API container on Render.
 * Uses setInterval instead of @nestjs/schedule to avoid dependency risk.
 */
@Injectable()
export class RescheduleAutoMoveWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RescheduleAutoMoveWorker.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly offersService: AppointmentRescheduleOffersService) {}

  onModuleInit() {
    const intervalMs = Number(process.env.RESCHEDULE_AUTO_MOVE_INTERVAL_MS ?? 60_000);
    const enabled = String(process.env.RESCHEDULE_AUTO_MOVE_ENABLED ?? 'true') === 'true';

    if (!enabled) {
      this.logger.log('Auto-move worker disabled via RESCHEDULE_AUTO_MOVE_ENABLED=false');
      return;
    }

    this.logger.log(`Auto-move worker started (interval=${intervalMs}ms)`);

    // Run once on boot (helps if the service restarts after downtime)
    this.safeTick();

    this.timer = setInterval(() => this.safeTick(), intervalMs);
    // Don’t keep process alive *just* for this timer (Render sometimes cares)
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async safeTick() {
    try {
      const res = await this.offersService.autoMoveExpiredOffers(50);
      if (res.processed > 0) {
        this.logger.log(`Auto-move tick: processed=${res.processed}, moved=${res.moved}`);
      }
    } catch (e: any) {
      this.logger.error(`Auto-move tick failed: ${e?.message ?? e}`);
    }
  }
}
