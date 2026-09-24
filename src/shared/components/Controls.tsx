/**
 * フォーム部品。見た目を 1 箇所に集約し、画面ごとの差異をなくす。
 * 高さはボタン・入力欄・セレクト・切り替えをすべて CONTROL（h-9 = 36px）にそろえる。
 * 画面側で独自の <button> に見た目を書かず、ここの部品を使うこと。
 */

import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

/** 操作部品の共通の高さと角丸。丸型（pill）は地図の上に浮かせるボタンに使う。 */
const CONTROL = 'h-9 rounded-md';
const PILL = 'h-9 rounded-full';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-loca-500 text-white hover:bg-loca-600 disabled:bg-gray-300',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:text-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300',
  ghost: 'text-gray-600 hover:bg-gray-100 disabled:text-gray-300',
};

export function Button({
  variant = 'primary',
  pill = false,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; pill?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex ${pill ? PILL : CONTROL} items-center justify-center whitespace-nowrap px-3 text-xs font-bold transition disabled:cursor-not-allowed ${VARIANT[variant]} ${className}`}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-gray-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-gray-400">{hint}</span>}
    </label>
  );
}

const inputClass = `w-full ${CONTROL} border border-gray-300 bg-white px-2.5 text-xs focus:border-loca-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400`;

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  // 複数行なので高さは固定しない（h-auto で上書き）
  return <textarea {...props} className={`${inputClass} h-auto py-2 ${props.className ?? ''}`} />;
}

export function Select({
  options,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
}) {
  return (
    <select {...rest} className={`${inputClass} ${rest.className ?? ''}`}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** チップの選択肢。label が無ければ value をそのまま出す。color はマーカーと同じ色の印（雰囲気）。 */
export interface ChipOption {
  value: string;
  label?: string;
  color?: string;
}

const CHIP = 'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition';
const CHIP_ON = 'border-loca-500 bg-loca-50 font-bold text-loca-700';
const CHIP_OFF = 'border-gray-300 bg-white text-gray-600 hover:border-gray-400';

function ChipBody({ option }: { option: ChipOption }) {
  return (
    <>
      {option.color && (
        <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.color }} />
      )}
      {option.label ?? option.value}
    </>
  );
}

/**
 * 排他選択。タグのように「各項目から 1 つだけ」に使う。
 * allowDeselect のとき、選択中をもう一度押すと未選択（空文字）に戻る（任意の項目用）。
 */
export function RadioGroup({
  name,
  options,
  value,
  onChange,
  allowDeselect = false,
}: {
  name: string;
  options: ChipOption[];
  value: string;
  onChange: (v: string) => void;
  allowDeselect?: boolean;
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          name={name}
          onClick={() => onChange(allowDeselect && value === opt.value ? '' : opt.value)}
          className={`${CHIP} ${value === opt.value ? CHIP_ON : CHIP_OFF}`}
        >
          <ChipBody option={opt} />
        </button>
      ))}
    </div>
  );
}

/** 複数選択（フィルタ用）。 */
export function CheckboxGroup({
  options,
  values,
  onChange,
}: {
  options: ChipOption[];
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="checkbox"
          aria-checked={values.includes(opt.value)}
          onClick={() => toggle(opt.value)}
          className={`${CHIP} ${values.includes(opt.value) ? CHIP_ON : CHIP_OFF}`}
        >
          <ChipBody option={opt} />
        </button>
      ))}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-loca-500"
      />
      <span>{children}</span>
    </label>
  );
}

/** リンクをボタンと同じ見た目で出す（外部サイトへの遷移など）。 */
export function LinkButton({
  variant = 'primary',
  className = '',
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant }) {
  return (
    <a
      {...rest}
      className={`inline-flex ${CONTROL} items-center justify-center whitespace-nowrap px-3 text-xs font-bold transition ${VARIANT[variant]} ${className}`}
    />
  );
}

/** 丸いアイコンだけのボタン（右上のメニュー、閉じるなど）。label は読み上げとツールチップに使う。 */
export function IconButton({
  icon,
  label,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 ${className}`}
    >
      <i className={icon} />
    </button>
  );
}

/** 2〜3 択の切り替え（地図／マーカー、投稿／リクエストなど）。 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" className={`grid ${CONTROL} overflow-hidden border border-gray-300 text-xs`} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`font-bold transition disabled:text-gray-300 ${
            value === o.value ? 'bg-loca-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}