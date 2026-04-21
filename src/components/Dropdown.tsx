import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface DropdownOption {
  value: string;
  label: ReactNode;
  hint?: ReactNode;
}

type BaseProps = {
  options: DropdownOption[];
  label?: string;
  className?: string;
  menuAlign?: 'start' | 'end';
};

type SingleProps = BaseProps & {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
};

type MultiProps = BaseProps & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
  allLabel?: string;
};

export type DropdownProps = SingleProps | MultiProps;

function multiSummary(
  value: string[],
  options: DropdownOption[],
  allLabel: string,
): ReactNode {
  if (value.length === 0) return allLabel;
  if (value.length === options.length) return allLabel;
  if (value.length <= 2) {
    return options
      .filter((o) => value.includes(o.value))
      .map((o) => (typeof o.label === 'string' ? o.label : o.value))
      .join(', ');
  }
  return `${value.length}개 선택`;
}

export default function Dropdown(props: DropdownProps) {
  const { options, label, className, menuAlign = 'start' } = props;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const isSelected = (v: string): boolean =>
    props.multiple ? props.value.includes(v) : props.value === v;

  const triggerLabel: ReactNode = props.multiple
    ? multiSummary(props.value, options, props.allLabel ?? '전체')
    : (options.find((o) => o.value === props.value) ?? options[0])?.label;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handlePick = (value: string) => {
    if (props.multiple) {
      const current = props.value;
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      props.onChange(next);
    } else {
      props.onChange(value);
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`dropdown${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="dropdown__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label && <span className="dropdown__label">{label}</span>}
        <span className="dropdown__value">{triggerLabel}</span>
        <svg
          className="dropdown__caret"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          className="dropdown__menu"
          data-align={menuAlign}
          data-multiple={props.multiple || undefined}
          role="listbox"
          aria-multiselectable={props.multiple || undefined}
        >
          {props.multiple && props.value.length > 0 && (
            <button
              type="button"
              className="dropdown__clear"
              onClick={() => props.onChange([])}
            >
              선택 해제
            </button>
          )}
          {options.map((opt) => {
            const selected = isSelected(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={selected}
                data-selected={selected || undefined}
                className="dropdown__option"
                onClick={() => handlePick(opt.value)}
              >
                <span className="dropdown__option-label">{opt.label}</span>
                {opt.hint != null && <span className="dropdown__hint">{opt.hint}</span>}
                <svg
                  className="dropdown__check"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  aria-hidden
                >
                  <path d="m5 12 5 5 9-11" />
                </svg>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
