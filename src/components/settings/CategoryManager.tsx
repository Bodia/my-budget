import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Tag, 
  Receipt, 
  Briefcase, 
  Laptop, 
  Book, 
  GraduationCap, 
  Gift, 
  Utensils, 
  Dumbbell, 
  Smile, 
  Heart, 
  Camera, 
  Music, 
  Globe, 
  Wrench, 
  Shield, 
  Check, 
  X,
  ShoppingCart,
  Coffee,
  Car,
  Home,
  HeartPulse,
  Tv,
  ShoppingBag,
  Plane,
  Landmark,
  HelpCircle,
  ArrowDownLeft
} from 'lucide-react';
import type { Category } from '../../types/finance';
import { db } from '../../db/database';

interface CategoryManagerProps {
  categories: Category[];
  onNotify: () => void;
}

const AVAILABLE_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  Receipt,
  Tag,
  Briefcase,
  Laptop,
  Book,
  GraduationCap,
  Gift,
  Utensils,
  Dumbbell,
  Smile,
  Heart,
  Camera,
  Music,
  Globe,
  Wrench,
  Shield,
  ShoppingCart,
  Coffee,
  Car,
  Home,
  HeartPulse,
  Tv,
  ShoppingBag,
  Plane,
  Landmark,
  HelpCircle,
  ArrowDownLeft,
};

const COLOR_PALETTE = [
  '#0284c7', // Sky-600 / Tax
  '#10b981', // Emerald-500
  '#f59e0b', // Amber-500
  '#8b5cf6', // Violet-500
  '#ec4899', // Pink-500
  '#06b6d4', // Cyan-500
  '#f43f5e', // Rose-500
  '#84cc16', // Lime-500
  '#6366f1', // Indigo-500
  '#14b8a6', // Teal-500
  '#d97706', // Yellow-600
  '#64748b', // Slate-500
];

export const CategoryManager: React.FC<CategoryManagerProps> = ({ categories, onNotify }) => {
  const [activeTypeTab, setActiveTypeTab] = useState<'expense' | 'income'>('expense');
  const [isCreating, setIsCreating] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'expense' | 'income'>('expense');
  const [newCatIcon, setNewCatIcon] = useState('Tag');
  const [newCatColor, setNewCatColor] = useState(COLOR_PALETTE[0]);
  const [newCatEssential, setNewCatEssential] = useState(false);
  const [newCatSubCategories, setNewCatSubCategories] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const filteredCategories = categories.filter(c => c.type === activeTypeTab);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = newCatName.trim();
    if (!trimmedName) {
      setFormError('Введіть назву категорії');
      return;
    }

    // Generate unique ID
    const baseId = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9а-яіїєґ]/gi, '_')
      .replace(/_+/g, '_')
      .slice(0, 30);
    const catId = `custom_${baseId}_${Date.now().toString().slice(-4)}`;

    const subs = newCatSubCategories
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const newCategory: Category = {
      id: catId,
      name: trimmedName,
      icon: newCatIcon,
      color: newCatColor,
      type: newCatType,
      isEssential: newCatEssential,
      subCategories: subs.length > 0 ? subs : [trimmedName],
      isCustom: true,
    };

    try {
      await db.categories.add(newCategory);
      setIsCreating(false);
      setNewCatName('');
      setNewCatSubCategories('');
      setNewCatEssential(false);
      onNotify();
    } catch (err: any) {
      setFormError('Помилка збереження категорії: ' + err.message);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!category.isCustom) {
      alert('Системні категорії не можуть бути видалені.');
      return;
    }

    if (window.confirm(`Ви дійсно бажаєте видалити категорію «${category.name}»?`)) {
      await db.categories.delete(category.id);
      // Also delete any budget for this category
      const budget = await db.budgets.where('categoryId').equals(category.id).first();
      if (budget) {
        await db.budgets.delete(budget.id);
      }
      onNotify();
    }
  };

  return (
    <div className="ant-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Менеджер фінансових категорій ({categories.length})
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Системні та власні категорії витрат і доходів з автокласифікацією
          </p>
        </div>

        <button 
          onClick={() => {
            setIsCreating(prev => !prev);
            setNewCatType(activeTypeTab);
            setFormError(null);
          }}
          className="btn btn-primary btn-sm"
        >
          {isCreating ? <X size={14} /> : <Plus size={14} />}
          <span>{isCreating ? 'Закрити форму' : 'Додати категорію'}</span>
        </button>
      </div>

      {/* Creation Drawer / Form */}
      {isCreating && (
        <form 
          onSubmit={handleCreateCategory} 
          style={{
            padding: 16,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--primary-border)',
            background: 'var(--bg-surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
            Створення нової категорії
          </div>

          {formError && (
            <div style={{ color: 'var(--danger)', fontSize: 12 }}>
              {formError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Назва категорії *
              </label>
              <input 
                type="text"
                className="input"
                placeholder="напр. Навчання та курси"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Тип фінансового потоку
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setNewCatType('expense')}
                  className={`btn btn-sm ${newCatType === 'expense' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                >
                  Витрати
                </button>
                <button
                  type="button"
                  onClick={() => setNewCatType('income')}
                  className={`btn btn-sm ${newCatType === 'income' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                >
                  Доходи
                </button>
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Підкатегорії (через кому)
            </label>
            <input 
              type="text"
              className="input"
              placeholder="напр. Англійська мова, IT курси, Книги"
              value={newCatSubCategories}
              onChange={e => setNewCatSubCategories(e.target.value)}
            />
          </div>

          {/* Color & Icon Selector */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Колір графіка
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {COLOR_PALETTE.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewCatColor(color)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: color,
                      border: newCatColor === color ? '2px solid white' : 'none',
                      boxShadow: newCatColor === color ? '0 0 0 2px var(--primary)' : 'none',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Іконка
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 90, overflowY: 'auto', padding: 4 }}>
                {Object.keys(AVAILABLE_ICONS).map(iconName => {
                  const IconComp = AVAILABLE_ICONS[iconName];
                  const isSelected = newCatIcon === iconName;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setNewCatIcon(iconName)}
                      className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ padding: '4px 8px' }}
                      title={iconName}
                    >
                      <IconComp size={16} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input 
              type="checkbox"
              id="isEssentialCheck"
              checked={newCatEssential}
              onChange={e => setNewCatEssential(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="isEssentialCheck" style={{ fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
              Обов'язкова базова витрата (для правила 50/30/20 «Потреби»)
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={() => setIsCreating(false)} className="btn btn-secondary btn-sm">
              Скасувати
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              <Check size={14} />
              <span>Зберегти категорію</span>
            </button>
          </div>
        </form>
      )}

      {/* Type Toggle Pills */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-default)', paddingBottom: 10 }}>
        <button
          onClick={() => setActiveTypeTab('expense')}
          className={`btn btn-sm ${activeTypeTab === 'expense' ? 'btn-primary' : 'btn-ghost'}`}
        >
          Категорії витрат ({categories.filter(c => c.type === 'expense').length})
        </button>
        <button
          onClick={() => setActiveTypeTab('income')}
          className={`btn btn-sm ${activeTypeTab === 'income' ? 'btn-primary' : 'btn-ghost'}`}
        >
          Категорії доходів ({categories.filter(c => c.type === 'income').length})
        </button>
      </div>

      {/* Category List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {filteredCategories.map((cat) => {
          const IconComp = AVAILABLE_ICONS[cat.icon] || Tag;
          return (
            <div
              key={cat.id}
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-sm)',
                      background: `${cat.color}15`,
                      color: cat.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconComp size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {cat.name}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                      <span className={cat.isCustom ? 'badge badge-primary' : 'badge badge-neutral'} style={{ fontSize: 10 }}>
                        {cat.isCustom ? 'Власна' : 'Системна'}
                      </span>
                      {cat.isEssential && (
                        <span className="badge badge-success" style={{ fontSize: 10 }}>
                          Обов'язкова
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {cat.isCustom && (
                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)', padding: 4 }}
                    title="Видалити категорію"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Subcategories tags */}
              {cat.subCategories && cat.subCategories.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                  {cat.subCategories.map((sub, idx) => (
                    <span 
                      key={idx} 
                      style={{
                        fontSize: 11,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'var(--bg-surface-hover)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
