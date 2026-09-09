import type { EnrichedIntelligenceResult, MerchantRule } from './types';

/**
 * Cleans gateway prefixes (LIQPAY*, WFP*, WayForPay, FOP, TOV) from descriptions
 */
export function cleanGatewayPrefixes(rawText: string): string {
  let cleaned = rawText.trim();

  // Remove common technical gateway prefixes
  cleaned = cleaned.replace(/^LIQPAY\*\s*/i, '');
  cleaned = cleaned.replace(/^WFP[.*]\s*/i, '');
  cleaned = cleaned.replace(/^WayForPay\s*[:*]?\s*/i, '');
  cleaned = cleaned.replace(/^(TOV|ТОВ)\s+/i, '');
  cleaned = cleaned.replace(/^(FOP|ФОП)\s+/i, '');

  return cleaned.trim();
}

/**
 * Knowledge base of Ukrainian brands, services, and categories
 */
const MERCHANT_RULES: MerchantRule[] = [
  // --- Charity & Military Support ---
  {
    pattern: /ахіллес/i,
    cleanName: 'Збір «АХІЛЛЕС» (ЗСУ)',
    categoryId: 'charity',
    subCategory: 'Допомога армії',
    tags: ['charity', 'zsu', 'military'],
  },
  {
    pattern: /3\s*ошб|ббс\s*1р/i,
    cleanName: '3-тя ОШБр (ЗСУ)',
    categoryId: 'charity',
    subCategory: 'Допомога армії',
    tags: ['charity', 'zsu', 'military'],
  },
  {
    pattern: /uanimals/i,
    cleanName: 'UAnimals',
    categoryId: 'charity',
    subCategory: 'Тварини',
    tags: ['charity', 'animals'],
  },
  {
    pattern: /blahodiyna\s*orha|благодійна\s*організація/i,
    cleanName: 'Благодійна Організація',
    categoryId: 'charity',
    subCategory: 'Благодійність',
    tags: ['charity'],
  },

  // --- Supermarkets & Groceries ---
  {
    pattern: /сільпо|silpo/i,
    cleanName: 'Сільпо',
    categoryId: 'groceries',
    subCategory: 'Супермаркети',
    tags: ['groceries', 'supermarket'],
  },
  {
    pattern: /атб|atb/i,
    cleanName: 'АТБ-Маркет',
    categoryId: 'groceries',
    subCategory: 'Супермаркети',
    tags: ['groceries', 'supermarket'],
  },
  {
    pattern: /рукавичка/i,
    cleanName: 'Рукавичка',
    categoryId: 'groceries',
    subCategory: 'Супермаркети',
    tags: ['groceries', 'supermarket'],
  },
  {
    pattern: /близенько/i,
    cleanName: 'Близенько',
    categoryId: 'groceries',
    subCategory: 'Супермаркети',
    tags: ['groceries', 'supermarket'],
  },
  {
    pattern: /\bсімі\b|simi/i,
    cleanName: 'Сімі',
    categoryId: 'groceries',
    subCategory: 'Супермаркети',
    tags: ['groceries', 'supermarket'],
  },
  {
    pattern: /галя\s*балувана/i,
    cleanName: 'Галя Балувана',
    categoryId: 'groceries',
    subCategory: 'Напівфабрикати',
    tags: ['groceries', 'food'],
  },
  {
    pattern: /галицька\s*свіжина/i,
    cleanName: 'Галицька Свіжина',
    categoryId: 'groceries',
    subCategory: 'М’ясо та свіжина',
    tags: ['groceries', 'meat'],
  },
  {
    pattern: /вацак|vatsak/i,
    cleanName: 'Кондитерський дім «Вацак»',
    categoryId: 'groceries',
    subCategory: 'Кондитерські вироби',
    tags: ['groceries', 'sweets'],
  },
  {
    pattern: /roshen/i,
    cleanName: 'ROSHEN',
    categoryId: 'groceries',
    subCategory: 'Солодощі',
    tags: ['groceries', 'sweets'],
  },
  {
    pattern: /egastronom|комора|simeina\s*kukhnia|україночка|aiwa/i,
    cleanName: 'Продукти харчування',
    categoryId: 'groceries',
    subCategory: 'Продукти',
    tags: ['groceries'],
  },
  {
    pattern: /аврора/i,
    cleanName: 'Аврора Мультимаркет',
    categoryId: 'shopping',
    subCategory: 'Товари для дому',
    tags: ['shopping', 'home'],
  },

  // --- Dining, Restaurants & Cafes ---
  {
    pattern: /mcdonald|макдональдз/i,
    cleanName: 'McDonald’s',
    categoryId: 'dining',
    subCategory: 'Фастфуд',
    tags: ['dining', 'fastfood'],
  },
  {
    pattern: /lviv\s*croissants|львівські\s*круасани/i,
    cleanName: 'Lviv Croissants',
    categoryId: 'dining',
    subCategory: 'Кафе та ресторани',
    tags: ['dining', 'cafe'],
  },
  {
    pattern: /cheese\s*bakery/i,
    cleanName: 'CHEESE BAKERY',
    categoryId: 'dining',
    subCategory: 'Пекарня та кав’ярня',
    tags: ['dining', 'bakery'],
  },
  {
    pattern: /shoco/i,
    cleanName: 'SHOco.',
    categoryId: 'dining',
    subCategory: 'Кондитерська-пекарня',
    tags: ['dining', 'cafe'],
  },
  {
    pattern: /cult\s*comedy\s*hall/i,
    cleanName: 'Cult Comedy Hall',
    categoryId: 'dining',
    subCategory: 'Стендап-клуб та бар',
    tags: ['dining', 'standup', 'bar'],
  },
  {
    pattern: /daily\s*dose/i,
    cleanName: 'Daily Dose',
    categoryId: 'dining',
    subCategory: 'Кав’ярня',
    tags: ['dining', 'coffee'],
  },
  {
    pattern: /spiro\s*pasta\s*bar/i,
    cleanName: 'Spiro pasta bar',
    categoryId: 'dining',
    subCategory: 'Ресторан',
    tags: ['dining', 'restaurant'],
  },
  {
    pattern: /гуцульська\s*ґражда/i,
    cleanName: 'Гуцульська Ґражда',
    categoryId: 'dining',
    subCategory: 'Ресторан',
    tags: ['dining', 'restaurant'],
  },
  {
    pattern: /sushi\s*king/i,
    cleanName: 'Sushi King',
    categoryId: 'dining',
    subCategory: 'Суші та ресторани',
    tags: ['dining', 'sushi'],
  },
  {
    pattern: /domino/i,
    cleanName: 'Domino’s Pizza',
    categoryId: 'dining',
    subCategory: 'Піцерія',
    tags: ['dining', 'pizza'],
  },
  {
    pattern: /la\s*la\s*pitsa/i,
    cleanName: 'LA LA PITSA',
    categoryId: 'dining',
    subCategory: 'Піцерія',
    tags: ['dining', 'pizza'],
  },
  {
    pattern: /burek/i,
    cleanName: 'BUREK',
    categoryId: 'dining',
    subCategory: 'Стрітфуд',
    tags: ['dining', 'streetfood'],
  },
  {
    pattern: /інтемпо|intempo/i,
    cleanName: 'Інтемпо',
    categoryId: 'dining',
    subCategory: 'Кафе-бістро',
    tags: ['dining', 'cafe'],
  },
  {
    pattern: /7sevenheaven|файні\s*льоти|файні\s*льоди|львівська\s*майстерня\s*шоколаду/i,
    cleanName: 'Кафе та десерти',
    categoryId: 'dining',
    subCategory: 'Десерти та кава',
    tags: ['dining', 'sweets'],
  },
  {
    pattern: /beerwest|vinnytske\s*zhyve\s*pyvo/i,
    cleanName: 'Пиво та напої',
    categoryId: 'dining',
    subCategory: 'Бари та напої',
    tags: ['dining', 'alcohol'],
  },

  // --- Transport, Fuel & Car Care ---
  {
    pattern: /окко|okko/i,
    cleanName: 'АЗС ОККО',
    categoryId: 'transport',
    subCategory: 'Пальне',
    tags: ['transport', 'fuel', 'car'],
  },
  {
    pattern: /wog|вог/i,
    cleanName: 'АЗС WOG',
    categoryId: 'transport',
    subCategory: 'Пальне',
    tags: ['transport', 'fuel', 'car'],
  },
  {
    pattern: /брсм/i,
    cleanName: 'АЗС БРСМ-Нафта',
    categoryId: 'transport',
    subCategory: 'Пальне',
    tags: ['transport', 'fuel', 'car'],
  },
  {
    pattern: /ukrnafta|укрнафта/i,
    cleanName: 'АЗС UKRNAFTA',
    categoryId: 'transport',
    subCategory: 'Пальне',
    tags: ['transport', 'fuel', 'car'],
  },
  {
    pattern: /amic/i,
    cleanName: 'АЗС AMIC Energy',
    categoryId: 'transport',
    subCategory: 'Пальне',
    tags: ['transport', 'fuel', 'car'],
  },
  {
    pattern: /ehrle/i,
    cleanName: 'Ehrle (Автомийка)',
    categoryId: 'transport',
    subCategory: 'Автомийка',
    tags: ['transport', 'car', 'wash'],
  },
  {
    pattern: /автосалон\s*рено/i,
    cleanName: 'Автосалон Рено',
    categoryId: 'transport',
    subCategory: 'Автомобіль',
    tags: ['transport', 'car', 'servicing'],
  },
  {
    pattern: /bolt\s*food/i,
    cleanName: 'Bolt Food',
    categoryId: 'dining',
    subCategory: 'Доставка їжі',
    tags: ['dining', 'delivery'],
  },
  {
    pattern: /bolt/i,
    cleanName: 'Bolt (Таксі)',
    categoryId: 'transport',
    subCategory: 'Таксі',
    tags: ['transport', 'taxi'],
  },

  // --- Health, Care & Pharmacy ---
  {
    pattern: /аптека\s*3i|аптека\s*3і/i,
    cleanName: 'Аптека 3i',
    categoryId: 'health',
    subCategory: 'Аптеки',
    tags: ['health', 'medicine'],
  },
  {
    pattern: /подорожник/i,
    cleanName: 'Аптека «Подорожник»',
    categoryId: 'health',
    subCategory: 'Аптеки',
    tags: ['health', 'medicine'],
  },
  {
    pattern: /ldent/i,
    cleanName: 'Стоматологія LDENT',
    categoryId: 'health',
    subCategory: 'Стоматологія',
    tags: ['health', 'dentist'],
  },
  {
    pattern: /lipss|blisk/i,
    cleanName: 'Косметика та догляд',
    categoryId: 'health',
    subCategory: 'Косметика',
    tags: ['health', 'cosmetics'],
  },

  // --- Utilities & Housing ---
  {
    pattern: /електроенергія|львівенерго|yasno/i,
    cleanName: 'Електроенергія',
    categoryId: 'housing',
    subCategory: 'Комунальні платежі',
    tags: ['housing', 'utilities', 'electricity'],
  },
  {
    pattern: /газ\s*\(доставлення\)|львівгаз|нафтогаз/i,
    cleanName: 'Газ (доставлення)',
    categoryId: 'housing',
    subCategory: 'Комунальні платежі',
    tags: ['housing', 'utilities', 'gas'],
  },
  {
    pattern: /глобус\s*парк|осбб/i,
    cleanName: 'ОСББ',
    categoryId: 'housing',
    subCategory: 'Комунальні платежі',
    tags: ['housing', 'utilities', 'osbb'],
  },
  {
    pattern: /київстар|vodafone|lifecell/i,
    cleanName: 'Київстар (Зв’язок та інтернет)',
    categoryId: 'subscriptions',
    subCategory: 'Інтернет та зв’язок',
    tags: ['subscriptions', 'utilities', 'mobile'],
  },

  // --- Leisure, Entertainment, Subscriptions ---
  {
    pattern: /steam/i,
    cleanName: 'Steam (Ігри)',
    categoryId: 'leisure',
    subCategory: 'Відеоігри',
    tags: ['leisure', 'games'],
  },
  {
    pattern: /yakaboo|world\s*book/i,
    cleanName: 'Книгарня',
    categoryId: 'leisure',
    subCategory: 'Книги',
    tags: ['leisure', 'books'],
  },
  {
    pattern: /hudtiket|ticketag/i,
    cleanName: 'Квитки на події',
    categoryId: 'leisure',
    subCategory: 'Квитки',
    tags: ['leisure', 'events'],
  },
  {
    pattern: /netflix/i,
    cleanName: 'Netflix',
    categoryId: 'subscriptions',
    subCategory: 'Стрімінг та софт',
    tags: ['subscriptions', 'streaming'],
    isSubscription: true,
  },
  {
    pattern: /patreon/i,
    cleanName: 'Patreon',
    categoryId: 'subscriptions',
    subCategory: 'Підписки',
    tags: ['subscriptions'],
    isSubscription: true,
  },
  {
    pattern: /google/i,
    cleanName: 'Google Services',
    categoryId: 'subscriptions',
    subCategory: 'Стрімінг та софт',
    tags: ['subscriptions', 'cloud'],
    isSubscription: true,
  },
  {
    pattern: /masterzoo|animalboutique/i,
    cleanName: 'Зоотовари',
    categoryId: 'other',
    subCategory: 'Товари для тварин',
    tags: ['pets'],
  },
  {
    pattern: /нова\s*пошта/i,
    cleanName: 'Нова пошта',
    categoryId: 'other',
    subCategory: 'Доставка',
    tags: ['delivery'],
  },
  {
    pattern: /rozetka/i,
    cleanName: 'Rozetka',
    categoryId: 'shopping',
    subCategory: 'Електроніка та покупки',
    tags: ['shopping', 'online'],
  },
];

/**
 * Matches a transaction description against known merchant rules and gateways
 */
export function matchMerchant(description: string, amount: number): EnrichedIntelligenceResult | null {
  const cleanedDesc = cleanGatewayPrefixes(description);
  const lower = cleanedDesc.toLowerCase();

  // 1. Income from FOP
  if (lower.includes('рахунку фоп') || lower.includes('дохід фоп')) {
    return {
      transactionType: 'income',
      cleanMerchant: 'Дохід ФОП',
      categoryId: 'income_salary',
      subCategory: 'Виведення коштів ФОП',
      tags: ['income', 'fop', 'business'],
      isSavings: false,
    };
  }

  // 2. Cashback Incomes
  if (lower.includes('виведення кешбеку') || lower.includes('виплата кешбеку')) {
    return {
      transactionType: 'income',
      cleanMerchant: lower.includes('держави') ? 'Національний кешбек (Держава)' : 'Кешбек Monobank',
      categoryId: 'income_other',
      subCategory: 'Кешбек',
      tags: ['income', 'cashback'],
      isSavings: false,
    };
  }

  // 3. Internal ATM Withdrawals & Card Transfers
  if (lower.includes('банкомат') || lower.includes('зняття готівки')) {
    return {
      transactionType: 'transfer',
      cleanMerchant: 'Зняття в банкоматі',
      categoryId: 'other',
      subCategory: 'Готівка',
      tags: ['transfer', 'atm', 'cash'],
      isSavings: false,
    };
  }

  if (lower.includes('з чорної картки') || lower.includes('з білої картки') || lower.includes('переказ на картку')) {
    const isNamedContact = /[А-ЯІЇЄ][а-яіїє]+\s+[А-ЯІЇЄ]\.?|мамуся|тато|сестра|брат|анастасія/i.test(cleanedDesc);
    return {
      transactionType: 'transfer',
      cleanMerchant: isNamedContact ? cleanedDesc.replace(/переказ\s+(на\s+картку\s+)?/i, 'Переказ: ').trim() : 'Міжкарточний переказ',
      categoryId: 'other',
      subCategory: 'Перекази',
      tags: isNamedContact ? ['transfer', 'p2p', 'p2p_contact', 'p2p_family'] : ['transfer', 'p2p'],
      isSavings: false,
    };
  }

  // 4. Match against known merchants catalog
  for (const rule of MERCHANT_RULES) {
    const isMatch = typeof rule.pattern === 'string'
      ? lower.includes(rule.pattern.toLowerCase())
      : rule.pattern.test(cleanedDesc);

    if (isMatch) {
      return {
        transactionType: amount > 0 ? 'income' : 'expense',
        cleanMerchant: rule.cleanName,
        categoryId: rule.categoryId,
        subCategory: rule.subCategory,
        tags: rule.tags,
        isSubscription: rule.isSubscription,
        isSavings: false,
      };
    }
  }

  // 5. Default cleanup if gateway was present
  if (cleanedDesc !== description.trim()) {
    return {
      transactionType: amount > 0 ? 'income' : 'expense',
      cleanMerchant: cleanedDesc,
      isSavings: false,
    };
  }

  return null;
}

export function cleanMerchantName(description: string): string {
  const match = matchMerchant(description, -100);
  if (match?.cleanMerchant) return match.cleanMerchant;
  return cleanGatewayPrefixes(description);
}

export function matchUkrainianMerchant(description: string) {
  const match = matchMerchant(description, -100);
  if (!match) return null;
  return {
    cleanName: match.cleanMerchant,
    suggestedCategory: match.categoryId,
    tags: match.tags ?? [],
  };
}

