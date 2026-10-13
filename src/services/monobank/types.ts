// DTOs and interfaces for Monobank Personal API

export interface MonobankAccountDto {
  id: string;
  sendId?: string;
  balance: number; // in kopecks / cents
  creditLimit: number; // in kopecks / cents
  type: 'black' | 'white' | 'platinum' | 'iron' | 'fop' | 'yellow' | 'eaid' | string;
  currencyCode: number; // ISO 4217 (980: UAH, 840: USD, 978: EUR)
  cashbackType?: 'None' | 'UAH' | 'Miles' | string;
  maskedPan: string[];
  iban?: string;
}

export interface MonobankClientInfoDto {
  clientId: string;
  name: string;
  webHookUrl?: string;
  permissions?: string;
  accounts: MonobankAccountDto[];
}

export interface MonobankStatementItemDto {
  id: string;
  time: number; // Unix timestamp in seconds
  description: string;
  mcc: number;
  originalMcc?: number;
  hold?: boolean;
  amount: number; // in kopecks / cents (negative for expenses)
  operationAmount?: number;
  currencyCode: number;
  commissionRate?: number;
  cashbackAmount?: number;
  balance?: number;
  comment?: string;
  receiptId?: string;
  invoiceId?: string;
  counterEdrpou?: string;
  counterIban?: string;
  counterName?: string;
}

export function currencyCodeToAlpha(code: number): string {
  switch (code) {
    case 980:
      return 'UAH';
    case 840:
      return 'USD';
    case 978:
      return 'EUR';
    case 985:
      return 'PLN';
    case 826:
      return 'GBP';
    default:
      return 'UAH';
  }
}

export function formatMonobankCardName(acc: MonobankAccountDto): string {
  const typeMap: Record<string, string> = {
    black: 'Monobank Чорна',
    white: 'Monobank Біла',
    platinum: 'Monobank Platinum',
    iron: 'Monobank Iron',
    fop: 'Monobank ФОП',
    yellow: 'Monobank Дитяча',
    eaid: 'єПідтримка / єВідновлення',
  };

  const base = typeMap[acc.type] || `Monobank ${acc.type.toUpperCase()}`;
  const currency = currencyCodeToAlpha(acc.currencyCode);
  const currencySuffix = currency !== 'UAH' ? ` (${currency})` : '';

  const last4 = acc.maskedPan && acc.maskedPan[0]
    ? acc.maskedPan[0].slice(-4)
    : '';
  const cardSuffix = last4 ? ` *${last4}` : '';

  return `${base}${cardSuffix}${currencySuffix}`;
}
