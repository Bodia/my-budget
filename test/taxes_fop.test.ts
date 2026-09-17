import { describe, it, expect } from 'vitest';
import { matchMerchant } from '../src/services/intelligence/merchantDictionary';
import { enrichTransaction } from '../src/services/intelligence/recognitionEngine';
import { mapMccToCategory } from '../src/services/parsers/monobankAdapter';
import { DEFAULT_CATEGORIES } from '../src/db/database';

describe('SCRUM-10: taxes_fop Category and Auto-categorization', () => {
  it('DEFAULT_CATEGORIES includes taxes_fop with expected subcategories', () => {
    const taxCat = DEFAULT_CATEGORIES.find(c => c.id === 'taxes_fop');
    expect(taxCat).toBeDefined();
    expect(taxCat?.name).toBe('Податки та ФОП');
    expect(taxCat?.type).toBe('expense');
    expect(taxCat?.isEssential).toBe(true);
    expect(taxCat?.subCategories).toContain('Єдиний податок');
    expect(taxCat?.subCategories).toContain('ЄСВ');
    expect(taxCat?.subCategories).toContain('Військовий збір');
    expect(taxCat?.subCategories).toContain('РКО та комісії банку');
  });

  it('recognizes Single Tax (Єдиний податок ФОП)', () => {
    const res = matchMerchant('Сплата єдиного податку ФОП за 1 квартал 2024 року', -1500);
    expect(res).not.toBeNull();
    expect(res?.categoryId).toBe('taxes_fop');
    expect(res?.subCategory).toBe('Єдиний податок');
    expect(res?.cleanMerchant).toBe('Єдиний податок ФОП');
  });

  it('recognizes ESV (ЄСВ)', () => {
    const res = matchMerchant('ЄСВ за 1 квартал 2024, платник ФОП Іванов І.І.', -5280);
    expect(res).not.toBeNull();
    expect(res?.categoryId).toBe('taxes_fop');
    expect(res?.subCategory).toBe('ЄСВ');
    expect(res?.cleanMerchant).toBe('ЄСВ (Єдиний соціальний внесок)');
  });

  it('recognizes Military Tax (Військовий збір)', () => {
    const res = matchMerchant('Військовий збір за лютий 2024', -800);
    expect(res).not.toBeNull();
    expect(res?.categoryId).toBe('taxes_fop');
    expect(res?.subCategory).toBe('Військовий збір');
    expect(res?.cleanMerchant).toBe('Військовий збір');
  });

  it('recognizes State Treasury IBAN payment (MFO 899998)', () => {
    const res = matchMerchant('Оплата рахунку UA128999980314000543210000001 ГУ ДПС у м.Києві', -3500);
    expect(res).not.toBeNull();
    expect(res?.categoryId).toBe('taxes_fop');
  });

  it('recognizes bank maintenance fees for FOP (РКО)', () => {
    const res = matchMerchant('Комісія за розрахунково-касове обслуговування рахунку ФОП', -150);
    expect(res).not.toBeNull();
    expect(res?.categoryId).toBe('taxes_fop');
    expect(res?.subCategory).toBe('РКО та комісії банку');
  });

  it('maps MCC 9311 to taxes_fop', () => {
    const mapped = mapMccToCategory(9311);
    expect(mapped).toEqual({
      categoryId: 'taxes_fop',
      subCategory: 'Єдиний податок',
    });
  });

  it('enriches transaction with taxes_fop category through recognition pipeline', () => {
    const enriched = enrichTransaction({
      description: 'ГУ ДПС Єдиний податок 3 група',
      amount: -4500,
    });
    expect(enriched.categoryId).toBe('taxes_fop');
    expect(enriched.transactionType).toBe('expense');
  });
});
