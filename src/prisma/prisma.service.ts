import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is missing. Check your .env / Render env vars.',
      );
    }

    const adapter = new PrismaPg({ connectionString });

    super({ adapter });

    // Optional: keep the log, but don't print secrets in prod
    if (process.env.NODE_ENV !== 'production') {
      console.log('Prisma connected using DATABASE_URL');
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
