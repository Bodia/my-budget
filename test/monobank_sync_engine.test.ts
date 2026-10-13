import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTimeChunks,
  MonobankSyncEngine,
  type SyncProgressEvent,
} from '../src/services/monobank/syncEngine';
import type { MonobankClient } from '../src/services/monobank/monobankClient';

describe('Monobank Sync Engine & Chunking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly creates 30-day chunks in reverse chronological order (newest first)', () => {
    // 90 days span: 2026-07-15 to 2026-10-13
    const start = new Date('2026-07-15T00:00:00Z');
    const end = new Date('2026-10-13T00:00:00Z');

    const chunks = createTimeChunks(start, end, 30);

    expect(chunks.length).toBe(3);
    // Newest chunk first
    expect(chunks[0].to).toBe(Math.floor(end.getTime() / 1000));
    expect(chunks[0].from).toBeLessThan(chunks[0].to);
    // Oldest chunk last
    expect(chunks[2].from).toBe(Math.floor(start.getTime() / 1000));
  });

  it('runs sync across multiple chunks with 60s cooldown and emits progress events', async () => {
    const events: SyncProgressEvent[] = [];
    const mockClient = {
      fetchStatement: vi.fn().mockImplementation(async (_token, _acc, from, to) => {
        return [{ id: `tx_${from}_${to}`, time: to, amount: -1000, description: 'Test', mcc: 5411 }];
      }),
    } as unknown as MonobankClient;

    const engine = new MonobankSyncEngine({ cooldownSeconds: 2 }); // 2 seconds for test

    const chunks = [
      { from: 1000, to: 2000, label: 'Chunk 1' },
      { from: 2000, to: 3000, label: 'Chunk 2' },
    ];

    const syncPromise = engine.startSync({
      token: 'test_token',
      accountId: '0',
      chunks,
      client: mockClient,
      onProgress: (ev) => events.push(ev),
    });

    // Initial fetch of chunk 1
    await vi.advanceTimersByTimeAsync(10);
    expect(mockClient.fetchStatement).toHaveBeenCalledTimes(1);

    // After chunk 1, engine enters cooldown
    expect(events.some(e => e.state === 'cooldown')).toBe(true);

    // Advance cooldown time (2 seconds)
    await vi.advanceTimersByTimeAsync(2000);

    const result = await syncPromise;

    expect(mockClient.fetchStatement).toHaveBeenCalledTimes(2);
    expect(result.items.length).toBe(2);
    expect(result.completed).toBe(true);
    expect(events[events.length - 1].state).toBe('completed');
  });

  it('allows stopping sync mid-flight and preserves already fetched items', async () => {
    const mockClient = {
      fetchStatement: vi.fn().mockResolvedValue([{ id: 'tx_1', time: 1000, amount: -100, description: 'T1', mcc: 5411 }]),
    } as unknown as MonobankClient;

    const engine = new MonobankSyncEngine({ cooldownSeconds: 60 });
    const chunks = [
      { from: 1000, to: 2000, label: 'Chunk 1' },
      { from: 2000, to: 3000, label: 'Chunk 2' },
    ];

    const syncPromise = engine.startSync({
      token: 'test_token',
      accountId: '0',
      chunks,
      client: mockClient,
      onProgress: () => {},
    });

    await vi.advanceTimersByTimeAsync(10);
    expect(mockClient.fetchStatement).toHaveBeenCalledTimes(1);

    // User stops during cooldown
    engine.stop();
    await vi.advanceTimersByTimeAsync(100);

    const result = await syncPromise;
    expect(mockClient.fetchStatement).toHaveBeenCalledTimes(1);
    expect(result.items.length).toBe(1);
    expect(result.completed).toBe(false); // stopped early
  });
});
