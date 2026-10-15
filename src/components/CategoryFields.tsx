'use client';

import { useMemo, useState } from 'react';

type Category = { name: string; subcategories: readonly string[] };

export function CategoryFields({
  categories,
  defaultCategory = '',
  defaultSubcategory = '',
}: {
  categories: readonly Category[];
  defaultCategory?: string;
  defaultSubcategory?: string;
}) {
  const [category, setCategory] = useState(defaultCategory);
  const subs = useMemo(
    () => categories.find((c) => c.name === category)?.subcategories ?? [],
    [categories, category],
  );
  const [subcategory, setSubcategory] = useState(() => {
    if (defaultSubcategory && (categories.find((c) => c.name === defaultCategory)?.subcategories ?? []).includes(defaultSubcategory)) {
      return defaultSubcategory;
    }
    return '';
  });

  return (
    <>
      <label htmlFor="category">Category</label>
      <select
        id="category"
        name="category"
        value={category}
        onChange={(e) => {
          setCategory(e.target.value);
          setSubcategory('');
        }}
      >
        <option value="">Select category</option>
        {categories.map((c) => (
          <option key={c.name} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
      <label htmlFor="subcategory">Subcategory</label>
      <select
        id="subcategory"
        name="subcategory"
        value={subcategory}
        onChange={(e) => setSubcategory(e.target.value)}
        disabled={!category}
      >
        <option value="">{category ? 'Select subcategory' : 'Choose a category first'}</option>
        {subs.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </>
  );
}
