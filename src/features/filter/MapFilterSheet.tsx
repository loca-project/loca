/**
 * 「フィルター」ボタンで開くパネル（ADR 0015・T50）。ボタンの上に開く。
 * 表示する種類（動画／撮影リクエスト）と、雰囲気・映っているもの・撮影の季節・時間帯・撮り方・機器の分類を選ぶ。変更はすぐ地図に効く。
 */

import React, { useEffect } from 'react';
import type { MapFilter } from '@/core/types';
import { EQUIPMENT_CATEGORY_KEYS, equipmentCategoryLabel, type TagField } from '@/core/constants';
import { Button, CheckboxGroup, Field, IconButton } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';
import { categoryOf, chipOptions } from '@/features/tags/tagChips';

/** パネルに出すタグの項目（雰囲気はマーカーと同じ色の印付きで、凡例を兼ねる）。 */
const SHEET_FIELDS: TagField[] = ['mood', 'subject', 'season', 'timeOfDay', 'style'];

interface MapFilterSheetProps {
  filter: MapFilter;
  shown: number;
  total: number;
  onChange: (next: MapFilter) => void;
  onClear: () => void;
  onClose: () => void;
}

export default function MapFilterSheet({ filter, shown, total, onChange, onClear, onClose }: MapFilterSheetProps) {
  const { t, lang } = useI18n();

  // Esc で閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const kinds = [...(filter.videos ? ['videos'] : []), ...(filter.requests ? ['requests'] : [])];

  return (
    <div
      role="dialog"
      aria-label={t.mapFilter.more}
      className="pointer-events-auto mb-2 flex max-h-[65dvh] w-[min(28rem,100%)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white/95 shadow-xl backdrop-blur"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-gray-100 px-3 py-1">
        <span className="text-[11px] font-bold text-gray-600">
          {t.mapFilter.showing.replace('{shown}', String(shown)).replace('{total}', String(total))}
        </span>
        <IconButton icon="fa-solid fa-xmark" label={t.mapFilter.close} onClick={onClose} />
      </header>
      {/* スクロールする枠と縦に並べる枠を分ける（兼ねると、入りきらない分だけ子が縮んでボタンが潰れる） */}
      <div className="grow overflow-y-auto px-3 py-3">
        <div className="flex flex-col gap-3">
          <Field label={t.mapFilter.kinds}>
            <CheckboxGroup
              options={[
                { value: 'videos', label: t.mapFilter.videos },
                { value: 'requests', label: t.mapFilter.requests },
              ]}
              values={kinds}
              onChange={(next) => onChange({ ...filter, videos: next.includes('videos'), requests: next.includes('requests') })}
            />
          </Field>
          {SHEET_FIELDS.map((field) => (
            <Field key={field} label={t.tags[field]}>
              <CheckboxGroup
                options={chipOptions(categoryOf(field), lang)}
                values={filter.tags[field] ?? []}
                onChange={(next) => onChange({ ...filter, tags: { ...filter.tags, [field]: next } })}
              />
            </Field>
          ))}
          <Field label={t.form.category}>
            <CheckboxGroup
              options={EQUIPMENT_CATEGORY_KEYS.map((key) => ({ value: key, label: equipmentCategoryLabel(key, lang) }))}
              values={filter.equipmentCategories}
              onChange={(next) => onChange({ ...filter, equipmentCategories: next })}
            />
          </Field>
          <p className="text-[10px] text-gray-400">{t.mapFilter.requestNote}</p>
          <Button variant="secondary" onClick={onClear}>
            {t.mapFilter.clear}
          </Button>
        </div>
      </div>
    </div>
  );
}
