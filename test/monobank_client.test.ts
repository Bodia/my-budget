import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MonobankClient,
  MonobankAuthError,
  MonobankRateLimitError,
} from '../src/services/monobank/monobankClient';

describe('Monobank API Client', () => {
  const token = 'u2_test_valid_personal_token_12345';
  let client: MonobankClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new MonobankClient();
  });

  it('fetches and parses client info successfully', async () => {
    const mockResponse = {
      clientId: 'c_123',
      name: 'Бо Діа',
      webHookUrl: '',
      permissions: 'ps',
      accounts: [
        {
          id: 'acc_black_uah',
          sendId: 's_1',
          balance: 1485050, // 14 850.50 UAH in kopecks
          creditLimit: 5000000, // 50 000.00 UAH
          type: 'black',
          currencyCode: 980,
          cashbackType: 'UAH',
          maskedPan: ['537541******1234'],
          iban: 'UA1234567890',
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    const result = await client.fetchClientInfo(token);

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/monobank/client-info',
      expect.objectContaining({
        headers: { 'X-Token': token },
      })
    );
    expect(result.name).toBe('Бо Діа');
    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].balance).toBe(14850.5); // Converted to standard units
    expect(result.accounts[0].creditLimit).toBe(50000.0);
  });

  it('fetches statement transactions within period', async () => {
    const mockItems = [
      {
        id: 'm_tx_1',
        time: 1728810000,
        description: 'Сільпо',
        mcc: 5411,
        originalMcc: 5411,
        hold: false,
        amount: -25050, // -250.50 UAH
        operationAmount: -25050,
        currencyCode: 980,
        commissionRate: 0,
        cashbackAmount: 500,
        balance: 1460000,
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockItems,
    } as Response);

    const fromUnix = 1726000000;
    const toUnix = 1728810000;
    const items = await client.fetchStatement(token, '0', fromUnix, toUnix);

    expect(fetchSpy).toHaveBeenCalledWith(
      `/api/monobank/statement/0/${fromUnix}/${toUnix}`,
      expect.objectContaining({
        headers: { 'X-Token': token },
      })
    );
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe('Сільпо');
  });

  it('throws MonobankAuthError on 401 / 403', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid token',
    } as Response);

    await expect(client.fetchClientInfo('invalid_token')).rejects.toThrow(
      MonobankAuthError
    );
  });

  it('throws MonobankRateLimitError on 429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'Rate limit exceeded',
    } as Response);

    await expect(
      client.fetchStatement(token, '0', 1000, 2000)
    ).rejects.toThrow(MonobankRateLimitError);
  });
});
