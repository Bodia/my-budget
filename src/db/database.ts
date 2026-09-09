import Dexie, { type Table } from 'dexie';
import type {
  Transaction,
  Category,
  Budget,
  CategorizationRule,
  ExchangeRate,
  Account,
} from '../types/finance';

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'groceries',
    name: 'Продукти та супермаркети',
    icon: 'ShoppingCart',
    color: '#10b981',
    type: 'expense',
    isEssential: true,
    subCategories: ['Супермаркети', 'Ринки', 'Вода та напої', 'Солодощі'],
  },
  {
    id: 'dining',
    name: 'Кафе та ресторани',
    icon: 'Coffee',
    color: '#f59e0b',
    type: 'expense',
    isEssential: false,
    subCategories: ['Ресторани', 'Кав\'ярні', 'Доставка їжі', 'Фастфуд'],
  },
  {
    id: 'transport',
    name: 'Транспорт та авто',
    icon: 'Car',
    color: '#3b82f6',
    type: 'expense',
    isEssential: true,
    subCategories: ['Пальне', 'Таксі', 'СТО та мийка', 'Громадський транспорт'],
  },
  {
    id: 'housing',
    name: 'Житло та комуналка',
    icon: 'Home',
    color: '#8b5cf6',
    type: 'expense',
    isEssential: true,
    subCategories: ['Оренда', 'Комунальні платежі', 'Інтернет та ТВ', 'Ремонт'],
  },
  {
    id: 'health',
    name: 'Здоров\'я та аптеки',
    icon: 'HeartPulse',
    color: '#ec4899',
    type: 'expense',
    isEssential: true,
    subCategories: ['Аптеки', 'Лікарі', 'Стоматологія', 'Спорт'],
  },
  {
    id: 'subscriptions',
    name: 'Підписки та сервіси',
    icon: 'Tv',
    color: '#6366f1',
    type: 'expense',
    isEssential: false,
    subCategories: ['Стрімінг', 'Хмарні сховища', 'Мобільний зв\'язок', 'Софт'],
  },
  {
    id: 'shopping',
    name: 'Одяг та покупки',
    icon: 'ShoppingBag',
    color: '#14b8a6',
    type: 'expense',
    isEssential: false,
    subCategories: ['Одяг та взуття', 'Електроніка', 'Дім та затишок', 'Косметика'],
  },
  {
    id: 'travel',
    name: 'Подорожі та дозвілля',
    icon: 'Plane',
    color: '#06b6d4',
    type: 'expense',
    isEssential: false,
    subCategories: ['Квитки', 'Готелі', 'Кіно та театри', 'Хобі'],
  },
  {
    id: 'finance',
    name: 'Комісії та перекази',
    icon: 'Landmark',
    color: '#64748b',
    type: 'expense',
    isEssential: true,
    subCategories: ['Банківські комісії', 'Перекази', 'Податки'],
  },
  {
    id: 'other',
    name: 'Різне / Інше',
    icon: 'HelpCircle',
    color: '#94a3b8',
    type: 'expense',
    isEssential: false,
    subCategories: ['Благодійність', 'Дрібниці'],
  },
  {
    id: 'income_salary',
    name: 'Зарплата та аванс',
    icon: 'Briefcase',
    color: '#22c55e',
    type: 'income',
    isEssential: false,
    subCategories: ['Основна зарплата', 'Бонуси', 'Фриланс'],
  },
  {
    id: 'income_other',
    name: 'Інші надходження',
    icon: 'ArrowDownLeft',
    color: '#84cc16',
    type: 'income',
    isEssential: false,
    subCategories: ['Кешбек', 'Відсотки / Кеш', 'Перекази від друзів'],
  },
];

export const DEFAULT_BUDGETS: Budget[] = [
  { id: 'b_groceries', categoryId: 'groceries', monthlyLimit: 14000, currency: 'UAH', alertThresholdPercent: 80 },
  { id: 'b_dining', categoryId: 'dining', monthlyLimit: 6000, currency: 'UAH', alertThresholdPercent: 85 },
  { id: 'b_transport', categoryId: 'transport', monthlyLimit: 4500, currency: 'UAH', alertThresholdPercent: 80 },
  { id: 'b_subscriptions', categoryId: 'subscriptions', monthlyLimit: 1500, currency: 'UAH', alertThresholdPercent: 90 },
];

export const DEFAULT_EXCHANGE_RATES: ExchangeRate[] = [
  { currency: 'USD', rateToUah: 41.50, updatedAt: new Date().toISOString() },
  { currency: 'EUR', rateToUah: 45.20, updatedAt: new Date().toISOString() },
  { currency: 'UAH', rateToUah: 1.0, updatedAt: new Date().toISOString() },
];

export const DEFAULT_RULES: CategorizationRule[] = [
  {
    id: 'rule_silpo',
    matchField: 'description',
    operator: 'contains',
    pattern: 'Сільпо|Сильпо|Silpo',
    targetCategoryId: 'groceries',
    priority: 1,
    isActive: true,
  },
  {
    id: 'rule_atb',
    matchField: 'description',
    operator: 'contains',
    pattern: 'АТБ|ATB',
    targetCategoryId: 'groceries',
    priority: 2,
    isActive: true,
  },
  {
    id: 'rule_okko',
    matchField: 'description',
    operator: 'contains',
    pattern: 'OKKO|ОККО|WOG|ВОГ|SOCAR|Укрнафта',
    targetCategoryId: 'transport',
    targetSubCategory: 'Пальне',
    priority: 3,
    isActive: true,
  },
  {
    id: 'rule_uber',
    matchField: 'description',
    operator: 'contains',
    pattern: 'Uber|Bolt|Uklon',
    targetCategoryId: 'transport',
    targetSubCategory: 'Таксі',
    priority: 4,
    isActive: true,
  },
  {
    id: 'rule_netflix',
    matchField: 'description',
    operator: 'contains',
    pattern: 'Netflix|Spotify|Apple.com|Google Storage|Megogo|YouTube',
    targetCategoryId: 'subscriptions',
    priority: 5,
    isActive: true,
  },
];

class PersonalFinanceDB extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  budgets!: Table<Budget, string>;
  rules!: Table<CategorizationRule, string>;
  exchangeRates!: Table<ExchangeRate, string>;
  accounts!: Table<Account, string>;

  constructor() {
    super('PersonalFinanceDB');
    this.version(1).stores({
      transactions: 'id, hash, date, categoryId, source, accountId',
      categories: 'id, type',
      budgets: 'id, categoryId',
      rules: 'id, priority, isActive',
      exchangeRates: 'currency',
      accounts: 'id',
    });

    this.version(2).stores({
      transactions: 'id, hash, date, categoryId, source, accountId, cardLast4',
      accounts: 'id, cardLast4',
    }).upgrade(async (tx) => {
      const accountsTable = tx.table('accounts');
      const mono = await accountsTable.get('monobank_black');
      if (mono && !mono.cardLast4) {
        await accountsTable.update('monobank_black', {
          cardLast4: '1234',
          cardNumberMasked: '**** **** **** 1234',
          color: '#1677ff',
        });
      }
    });

    this.version(3).stores({
      transactions: 'id, hash, date, categoryId, source, accountId, cardLast4, transactionType, isSavings',
      accounts: 'id, cardLast4, role',
    }).upgrade(async (tx) => {
      const txTable = tx.table('transactions');
      const all = await txTable.toArray();
      for (const t of all) {
        if (!t.transactionType) {
          const isSav = t.description && (
            t.description.includes('Округлення балансу') || 
            t.description.includes('На примхи') ||
            t.description.includes('Поповнення «') ||
            t.description.includes('Часткове зняття банки')
          );
          const isRef = t.description && (t.description.includes('Скасування.') || t.description.includes('Повернення'));
          const type = isSav ? 'savings_jar' : isRef ? 'refund' : (t.amount > 0 ? 'income' : 'expense');
          await txTable.update(t.id, {
            transactionType: type,
            isSavings: Boolean(isSav),
          });
        }
      }
    });

    this.on('populate', () => {
      this.categories.bulkAdd(DEFAULT_CATEGORIES);
      this.budgets.bulkAdd(DEFAULT_BUDGETS);
      this.rules.bulkAdd(DEFAULT_RULES);
      this.exchangeRates.bulkAdd(DEFAULT_EXCHANGE_RATES);
      this.accounts.bulkAdd([
        { id: 'monobank_black', name: 'Monobank Чорна', type: 'bank_card', currency: 'UAH', cardLast4: '1234', cardNumberMasked: '**** **** **** 1234', color: '#1677ff', role: 'personal' },
        { id: 'monobank_white', name: 'Monobank Біла', type: 'bank_card', currency: 'UAH', color: '#52c41a', role: 'shared_family' },
        { id: 'cash', name: 'Готівка', type: 'cash', currency: 'UAH', role: 'general' },
      ]);
    });
  }
}

export const db = new PersonalFinanceDB();
