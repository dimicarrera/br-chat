import { Redis } from '@upstash/redis';

if (!process.env.KV_REST_API_URL) throw new Error('KV_REST_API_URL is not set');
if (!process.env.KV_REST_API_TOKEN) throw new Error('KV_REST_API_TOKEN is not set');

export const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});
