import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

type PrismaClientWithAdapter = ConstructorParameters<typeof PrismaClient>[0] & {
  adapter: PrismaPg;
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    // Make sure this exists
    if (!connectionString) {
      throw new Error('DATABASE_URL is missing in environment (.env)');
    }

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    // Prisma v7: pass a non-empty valid options object (adapter)
    super({ adapter } as PrismaClientWithAdapter);
  }

  async onModuleInit() {
    await this.$connect();
  }
}
