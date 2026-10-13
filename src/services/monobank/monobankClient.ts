import type {
  MonobankClientInfoDto,
  MonobankStatementItemDto,
} from './types';

export class MonobankAuthError extends Error {
  constructor(message = 'Недійсний токен Monobank API. Перевірте токен в налаштуваннях.') {
    super(message);
    this.name = 'MonobankAuthError';
  }
}

export class MonobankRateLimitError extends Error {
  public retryAfterSeconds: number;

  constructor(message = 'Перевищено ліміт запитів до Monobank API (1 запит на 60 сек).', retryAfter = 60) {
    super(message);
    this.name = 'MonobankRateLimitError';
    this.retryAfterSeconds = retryAfter;
  }
}

export class MonobankApiError extends Error {
  public status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'MonobankApiError';
    this.status = status;
  }
}

export interface ClientInfoResult {
  clientId: string;
  name: string;
  permissions?: string;
  accounts: {
    id: string;
    sendId?: string;
    balance: number; // in UAH/standard currency
    creditLimit: number; // in UAH/standard currency
    type: string;
    currencyCode: number;
    cashbackType?: string;
    maskedPan: string[];
    iban?: string;
  }[];
}

export class MonobankClient {
  private baseUrl: string;

  constructor(customBaseUrl?: string) {
    this.baseUrl = (customBaseUrl || '/api/monobank').replace(/\/$/, '');
  }

  private async request<T>(path: string, token: string): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Token': token.trim(),
        },
      });
    } catch (networkErr: any) {
      throw new Error(`Помилка мережі при зверненні до Monobank API: ${networkErr.message || networkErr}`);
    }

    if (res.status === 401 || res.status === 403) {
      throw new MonobankAuthError();
    }

    if (res.status === 429) {
      const retryHeader = res.headers?.get('Retry-After');
      const retrySec = retryHeader ? parseInt(retryHeader, 10) : 60;
      throw new MonobankRateLimitError(
        'Перевищено ліміт запитів до Monobank API (1 запит на 60 сек). Зачекайте перед повторною спробою.',
        isNaN(retrySec) ? 60 : retrySec
      );
    }

    if (!res.ok) {
      let errText = '';
      try {
        errText = await res.text();
      } catch {
        // ignore
      }
      throw new MonobankApiError(
        `Помилка Monobank API (${res.status}): ${errText || res.statusText}`,
        res.status
      );
    }

    return (await res.json()) as T;
  }

  public async fetchClientInfo(token: string): Promise<ClientInfoResult> {
    const raw = await this.request<MonobankClientInfoDto>('/client-info', token);

    return {
      clientId: raw.clientId,
      name: raw.name,
      permissions: raw.permissions,
      accounts: (raw.accounts || []).map(acc => ({
        ...acc,
        balance: parseFloat((acc.balance / 100).toFixed(2)),
        creditLimit: parseFloat((acc.creditLimit / 100).toFixed(2)),
      })),
    };
  }

  public async fetchStatement(
    token: string,
    accountId: string,
    fromUnix: number,
    toUnix: number
  ): Promise<MonobankStatementItemDto[]> {
    const safeAccountId = accountId.trim() || '0';
    const path = `/statement/${safeAccountId}/${fromUnix}/${toUnix}`;
    return await this.request<MonobankStatementItemDto[]>(path, token);
  }
}
