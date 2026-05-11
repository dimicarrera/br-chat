import { Ratelimit } from '@upstash/ratelimit';
import { kv } from './storage/kv';

export const ratelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(
    Number(process.env.RATELIMIT_PER_COOKIE_PER_HOUR ?? 10),
    '1 h',
  ),
  prefix: 'ratelimit',
});
