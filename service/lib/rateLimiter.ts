// Simple per-process limiter as a placeholder. TODO: replace with Redis token bucket.
import type { FastifyRequest, FastifyReply } from 'fastify';
import { getGate, postGate, wsGate } from '../../src/rateLimiter.js';

export async function gmoGetGate(req: FastifyRequest, _reply: FastifyReply) {
  await getGate.wait();
}
export async function gmoPostGate(req: FastifyRequest, _reply: FastifyReply) {
  await postGate.wait();
}
export async function gmoWsGate() {
  await wsGate.wait();
}

