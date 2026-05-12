import { Ratelimit } from '@upstash/ratelimit';
import { kv } from './storage/kv';

const rawLimit = parseInt(process.env.RATELIMIT_PER_COOKIE_PER_HOUR ?? '10', 10);
const limitPerHour = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 10;

export const ratelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(limitPerHour, '1 h'),
  prefix: 'ratelimit',
});
