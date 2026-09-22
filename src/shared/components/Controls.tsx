/** フォーム部品。見た目を 1 箇所に集約し、画面ごとの差異をなくす。 */

import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-loca-500 text-white hover:bg-loca-600 disabled:bg-gray-300',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:text-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300',
  ghost: 'text-gray-600 hover:bg-gray-100 disabled:text-gray-300',
};

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={`rounded px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed ${VARIANT[variant]} ${className}`}
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

const inputClass =
  'w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-loca-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} ${props.className ?? ''}`} />;
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

/** 排他選択。感情タグのように「各カテゴリから 1 つだけ」に使う。 */
export function RadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={value === opt}
          name={name}
          onClick={() => onChange(opt)}
          className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
            value === opt
              ? 'border-loca-500 bg-loca-50 font-bold text-loca-700'
              : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/** 複数選択。ランキングの感情タグフィルタ（OR 条件）に使う。 */
export function CheckboxGroup({
  options,
  values,
  onChange,
}: {
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (opt: string) =>
    onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="checkbox"
          aria-checked={values.includes(opt)}
          onClick={() => toggle(opt)}
          className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
            values.includes(opt)
              ? 'border-loca-500 bg-loca-50 font-bold text-loca-700'
              : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
          }`}
        >
          {opt}
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
