import type { Transaction } from '../../types/finance';
import { db } from '../../db/database';
import { computeTransactionHash } from '../parsers/deduplication';

export async function generateDemoDataset(): Promise<Transaction[]> {
  const transactions: Transaction[] = [];
  const now = new Date();
  
  // Generate 12 months of history
  const monthsBack = 12;

  let idCounter = 1;

  for (let m = monthsBack; m >= 0; m--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');

    // 1. Regular Salaries (1st and 15th)
    const sal1Date = `${year}-${month}-01T10:00:00`;
    const sal2Date = `${year}-${month}-15T10:00:00`;
    
    transactions.push({
      id: `demo_${idCounter++}`,
      hash: await computeTransactionHash(sal1Date, 38000, 'Зарахування зарплати (ТОВ ТЕХНОЛОДЖІ)', 'monobank_black'),
      date: sal1Date,
      amount: 38000,
      currency: 'UAH',
      description: 'Зарахування зарплати (ТОВ ТЕХНОЛОДЖІ)',
      originalCategory: 'Зарахування',
      categoryId: 'income_salary',
      source: 'monobank',
      accountId: 'monobank_black',
    });

    transactions.push({
      id: `demo_${idCounter++}`,
      hash: await computeTransactionHash(sal2Date, 35000, 'Аванс заробітна плата', 'monobank_black'),
      date: sal2Date,
      amount: 35000,
      currency: 'UAH',
      description: 'Аванс заробітна плата',
      originalCategory: 'Зарахування',
      categoryId: 'income_salary',
      source: 'monobank',
      accountId: 'monobank_black',
    });

    // 2. Rent and Utilities
    const rentDate = `${year}-${month}-05T12:00:00`;
    transactions.push({
      id: `demo_${idCounter++}`,
      hash: await computeTransactionHash(rentDate, -15000, 'Оренда квартири (ФОП Мельник)', 'monobank_black'),
      date: rentDate,
      amount: -15000,
      currency: 'UAH',
      description: 'Оренда квартири (ФОП Мельник)',
      categoryId: 'housing',
      subCategory: 'Оренда',
      source: 'monobank',
      accountId: 'monobank_black',
    });

    const utilDate = `${year}-${month}-10T14:30:00`;
    transactions.push({
      id: `demo_${idCounter++}`,
      hash: await computeTransactionHash(utilDate, -2850, 'YASNO / КП ГІОЦ Комунальні платежі', 'monobank_black'),
      date: utilDate,
      amount: -2850,
      currency: 'UAH',
      description: 'YASNO / КП ГІОЦ Комунальні платежі',
      mcc: 4900,
      categoryId: 'housing',
      subCategory: 'Комунальні платежі',
      source: 'monobank',
      accountId: 'monobank_black',
    });

    // 3. Subscriptions
    const subDates = [
      { d: '03', name: 'Netflix International B.V.', amount: -349, cat: 'subscriptions' },
      { d: '08', name: 'Spotify AB Music', amount: -199, cat: 'subscriptions' },
      { d: '14', name: 'YouTube Premium Family', amount: -149, cat: 'subscriptions' },
      { d: '18', name: 'Kyivstar Тариф Все Разом', amount: -275, cat: 'subscriptions' },
      { d: '22', name: 'SportLife Абонемент Classic', amount: -1250, cat: 'health' },
      { d: '27', name: 'Apple.com/bill iCloud Storage', amount: -79, cat: 'subscriptions' },
    ];

    for (const sub of subDates) {
      const sDate = `${year}-${month}-${sub.d}T09:15:00`;
      transactions.push({
        id: `demo_${idCounter++}`,
        hash: await computeTransactionHash(sDate, sub.amount, sub.name, 'monobank_black'),
        date: sDate,
        amount: sub.amount,
        currency: 'UAH',
        description: sub.name,
        categoryId: sub.cat,
        source: 'monobank',
        accountId: 'monobank_black',
      });
    }

    // 4. Frequent Expenses across month days (Groceries, Dining, Fuel, Coffee)
    const merchants = [
      { name: 'Супермаркет Сільпо Київ', amountMin: 650, amountMax: 2400, cat: 'groceries', sub: 'Супермаркети', mcc: 5411 },
      { name: 'АТБ-Маркет', amountMin: 280, amountMax: 950, cat: 'groceries', sub: 'Супермаркети', mcc: 5411 },
      { name: 'АЗС OKKO Пальне Pulls 95', amountMin: 1400, amountMax: 2600, cat: 'transport', sub: 'Пальне', mcc: 5541 },
      { name: 'АЗС WOG Кава та хотдог', amountMin: 180, amountMax: 320, cat: 'dining', sub: 'Фастфуд', mcc: 5814 },
      { name: 'Bolt Таксі', amountMin: 130, amountMax: 380, cat: 'transport', sub: 'Таксі', mcc: 4121 },
      { name: 'Кав\'ярня Кава Світ', amountMin: 75, amountMax: 140, cat: 'dining', sub: 'Кав\'ярні', mcc: 5814 },
      { name: 'Кава Aroma Kava', amountMin: 65, amountMax: 125, cat: 'dining', sub: 'Кав\'ярні', mcc: 5814 },
      { name: 'Ресторан Пузата Хата Обід', amountMin: 180, amountMax: 320, cat: 'dining', sub: 'Ресторани', mcc: 5812 },
      { name: 'Доставка Glovo McDonald\'s', amountMin: 340, amountMax: 620, cat: 'dining', sub: 'Доставка їжі', mcc: 5814 },
      { name: 'Аптека АНЦ Фармацевтика', amountMin: 220, amountMax: 890, cat: 'health', sub: 'Аптеки', mcc: 5912 },
      { name: 'Rozetka Товари для дому', amountMin: 450, amountMax: 1900, cat: 'shopping', sub: 'Дім та затишок', mcc: 5311 },
      { name: 'Нова Пошта Доставка', amountMin: 95, amountMax: 165, cat: 'transport', sub: 'Громадський транспорт', mcc: 4789 },
    ];

    // Generate ~25-30 transactions per month
    for (let day = 1; day <= 28; day += 1) {
      if (day % 2 === 0 || day % 3 === 0) {
        const item = merchants[(day * 3 + m) % merchants.length];
        const variance = ((day * 37) % (item.amountMax - item.amountMin));
        const amount = -(item.amountMin + variance);
        const dayStr = String(day).padStart(2, '0');
        const hourStr = String(10 + (day % 11)).padStart(2, '0');
        const minuteStr = String((day * 7) % 60).padStart(2, '0');
        const tDate = `${year}-${month}-${dayStr}T${hourStr}:${minuteStr}:00`;

        const src = day % 4 === 0 ? 'toshl' : 'monobank';
        const acc = src === 'toshl' ? 'Toshl Wallet' : 'monobank_black';

        transactions.push({
          id: `demo_${idCounter++}`,
          hash: await computeTransactionHash(tDate, amount, item.name, acc),
          date: tDate,
          amount,
          currency: 'UAH',
          description: item.name,
          categoryId: item.cat,
          subCategory: item.sub,
          mcc: item.mcc,
          source: src,
          accountId: acc,
        });
      }
    }
  }

  return transactions;
}

export async function seedDemoData(): Promise<number> {
  const transactions = await generateDemoDataset();
  // Clear old transactions and insert demo dataset
  await db.transactions.clear();
  await db.transactions.bulkAdd(transactions);
  return transactions.length;
}
