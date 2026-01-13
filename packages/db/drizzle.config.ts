import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema.ts',
  out: '../../apps/backend/migrations',
  dialect: 'sqlite',
} satisfies Config;
