#!/usr/bin/env node
/**
 * Smoke test: login + create N games concurrently.
 * Usage: node scripts/smoke-test.mjs [baseUrl] [count]
 */
const baseUrl = process.argv[2] ?? 'http://localhost:3000';
const count = Number(process.argv[3] ?? 10);

function buildAiConfigs(humanSeat) {
  return Array.from({ length: 12 }, (_, i) =>
    i === humanSeat
      ? null
      : {
          seatIndex: i,
          model: 'deepseek-chat',
          temperature: 0.7,
          personality: '逻辑型 AI',
          voice: { provider: 'aliyun', voiceId: 'xiaoyun', speed: 1, pitch: 1 },
        },
  ).filter(Boolean);
}

async function devLogin() {
  const res = await fetch(`${baseUrl}/api/auth/dev`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

async function createGame(token, i) {
  const res = await fetch(`${baseUrl}/api/games`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      humanSeatIndex: i % 12,
      humanRole: null,
      aiConfigs: buildAiConfigs(i % 12),
      seed: Date.now() + i,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create game ${i} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function main() {
  console.log(`Smoke test against ${baseUrl}, creating ${count} games...`);

  const health = await fetch(`${baseUrl}/health`);
  if (!health.ok) throw new Error('Health check failed');
  console.log('Health:', await health.json());

  const token = await devLogin();
  const started = Date.now();
  const results = await Promise.all(Array.from({ length: count }, (_, i) => createGame(token, i)));
  const elapsed = Date.now() - started;

  console.log(`Created ${results.length} games in ${elapsed}ms`);
  console.log('Sample gameId:', results[0].gameId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
