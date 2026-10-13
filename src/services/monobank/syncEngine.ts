import type { MonobankStatementItemDto } from './types';
import type { MonobankClient } from './monobankClient';

export interface TimeChunk {
  from: number; // Unix timestamp in seconds
  to: number;   // Unix timestamp in seconds
  label: string;
}

export function createTimeChunks(
  startDate: Date,
  endDate: Date,
  chunkDays = 30
): TimeChunk[] {
  const startUnix = Math.floor(startDate.getTime() / 1000);
  const endUnix = Math.floor(endDate.getTime() / 1000);

  if (startUnix >= endUnix) {
    return [];
  }

  const chunks: TimeChunk[] = [];
  const chunkSeconds = chunkDays * 24 * 60 * 60;
  let currentTo = endUnix;

  while (currentTo > startUnix) {
    const currentFrom = Math.max(startUnix, currentTo - chunkSeconds);
    const fromDate = new Date(currentFrom * 1000);
    const toDate = new Date(currentTo * 1000);

    const fromStr = `${fromDate.getDate().toString().padStart(2, '0')}.${(fromDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const toStr = `${toDate.getDate().toString().padStart(2, '0')}.${(toDate.getMonth() + 1).toString().padStart(2, '0')}`;

    chunks.push({
      from: currentFrom,
      to: currentTo,
      label: `${fromStr} — ${toStr}`,
    });

    currentTo = currentFrom;
  }

  return chunks;
}

export type SyncState = 'idle' | 'fetching' | 'cooldown' | 'completed' | 'paused' | 'error';

export interface SyncProgressEvent {
  state: SyncState;
  currentChunkIndex: number;
  totalChunks: number;
  secondsRemaining: number;
  totalItemsFetched: number;
  currentChunk?: TimeChunk;
  errorMessage?: string;
}

export interface SyncOptions {
  token: string;
  accountId: string;
  chunks: TimeChunk[];
  client: MonobankClient;
  onProgress?: (event: SyncProgressEvent) => void;
}

export interface SyncResult {
  items: MonobankStatementItemDto[];
  completed: boolean;
}

export class MonobankSyncEngine {
  private cooldownSeconds: number;
  private isStopped = false;
  private isPaused = false;
  private sleepResolve: (() => void) | null = null;

  constructor(config?: { cooldownSeconds?: number }) {
    this.cooldownSeconds = config?.cooldownSeconds ?? 60;
  }

  public stop(): void {
    this.isStopped = true;
    if (this.sleepResolve) {
      this.sleepResolve();
      this.sleepResolve = null;
    }
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  private async sleep(ms: number): Promise<void> {
    if (this.isStopped) return;
    return new Promise(resolve => {
      let timer: any;
      const done = () => {
        if (timer) clearTimeout(timer);
        this.sleepResolve = null;
        resolve();
      };
      this.sleepResolve = done;
      timer = setTimeout(done, ms);
    });
  }

  public async startSync(options: SyncOptions): Promise<SyncResult> {
    this.isStopped = false;
    this.isPaused = false;

    const { token, accountId, chunks, client, onProgress } = options;
    const allItems: MonobankStatementItemDto[] = [];
    const totalChunks = chunks.length;

    for (let i = 0; i < totalChunks; i++) {
      while (this.isPaused && !this.isStopped) {
        await this.sleep(200);
      }
      if (this.isStopped) break;

      const chunk = chunks[i];

      onProgress?.({
        state: 'fetching',
        currentChunkIndex: i + 1,
        totalChunks,
        secondsRemaining: 0,
        totalItemsFetched: allItems.length,
        currentChunk: chunk,
      });

      try {
        const items = await client.fetchStatement(token, accountId, chunk.from, chunk.to);
        allItems.push(...items);
      } catch (err: any) {
        onProgress?.({
          state: 'error',
          currentChunkIndex: i + 1,
          totalChunks,
          secondsRemaining: 0,
          totalItemsFetched: allItems.length,
          currentChunk: chunk,
          errorMessage: err.message || 'Помилка отримання виписки',
        });
        throw err;
      }

      // If more chunks remain and not stopped, wait cooldown
      if (i < totalChunks - 1 && !this.isStopped) {
        for (let s = this.cooldownSeconds; s > 0; s--) {
          if (this.isStopped) break;

          onProgress?.({
            state: 'cooldown',
            currentChunkIndex: i + 1,
            totalChunks,
            secondsRemaining: s,
            totalItemsFetched: allItems.length,
            currentChunk: chunk,
          });

          await this.sleep(1000);
        }
      }
    }

    const completed = !this.isStopped;

    onProgress?.({
      state: completed ? 'completed' : 'paused',
      currentChunkIndex: totalChunks,
      totalChunks,
      secondsRemaining: 0,
      totalItemsFetched: allItems.length,
    });

    return {
      items: allItems,
      completed,
    };
  }
}
