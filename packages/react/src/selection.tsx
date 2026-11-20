/* Checkbox, Radio / RadioGroup, ChoiceList (0.2). Checkbox and Radio wrap a real <input> so forms, keyboard and
   assistive technology work natively; the box, tick and dot are drawn by CSS (selection.css). */
import {
  createContext, forwardRef, useContext, useEffect, useRef,
  type CSSProperties, type InputHTMLAttributes, type KeyboardEvent, type ReactNode,
} from 'react';
import { cx, mergeRefs, useControllable, useStableId } from './utils';
import { CheckIcon } from './icons';

/* ================================================================================================ Checkbox */
export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'onChange' | 'checked' | 'defaultChecked'> & {
  checked?: boolean;
  defaultChecked?: boolean;
  /** shows a dash; the checked value is unchanged (e.g. "select all" with some selected) */
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ checked, defaultChecked = false, indeterminate = false, onChange, label, description, className, style, disabled, id, ...rest }, ref) {
  const [on, setOn] = useControllable(checked, defaultChecked, onChange);
  const input = useRef<HTMLInputElement>(null);
  const auto = useStableId('sg-check');
  const iid = id ?? auto;
  useEffect(() => { if (input.current) input.current.indeterminate = indeterminate; }, [indeterminate]);
  return (
    <label className={cx('sg-check', className)} style={style} data-disabled={disabled || undefined}>
      <input ref={mergeRefs(ref, input)} id={iid} type="checkbox" className="sg-check__input" checked={on} disabled={disabled}
        aria-describedby={description ? `${iid}-d` : undefined} onChange={(e) => setOn(e.currentTarget.checked)} {...rest} />
      <span className="sg-check__box" aria-hidden="true">
        <svg className="sg-check__mark" viewBox="0 0 16 16"><path className="sg-check__tick" d="M3.5 8.4l3 3 6-6.6" /><path className="sg-check__dash" d="M4 8h8" /></svg>
      </span>
      {(label || description) && (
        <span className="sg-check__text">
          {label && <span>{label}</span>}
          {description && <span id={`${iid}-d`} className="sg-check__desc">{description}</span>}
        </span>
      )}
    </label>
  );
});

/* ================================================================================================ Radio */
type RadioCtx = { name: string; value: string | undefined; set: (v: string) => void; disabled?: boolean };
const RadioContext = createContext<RadioCtx | null>(null);

export type RadioGroupProps = {
  value?: string; defaultValue?: string; onChange?: (value: string) => void;
  name?: string; label?: ReactNode; disabled?: boolean; direction?: 'column' | 'row';
  children: ReactNode; className?: string; style?: CSSProperties; 'aria-label'?: string;
};
/** Native radios with one name: arrow keys move and select, Tab enters at the checked one. */
export function RadioGroup({ value, defaultValue, onChange, name, label, disabled, direction = 'column', children, className, style, 'aria-label': ariaLabel }: RadioGroupProps) {
  const [v, setV] = useControllable<string | undefined>(value, defaultValue, onChange as (v: string | undefined) => void);
  const auto = useStableId('sg-radio');
  return (
    <RadioContext.Provider value={{ name: name ?? auto, value: v, set: (x) => setV(x), disabled }}>
      <fieldset className={cx('sg-radio-group', direction === 'row' && 'sg-radio-group--row', className)} style={style} aria-label={label ? undefined : ariaLabel} disabled={disabled}>
        {label && <legend className="sg-radio-group__legend">{label}</legend>}
        {children}
      </fieldset>
    </RadioContext.Provider>
  );
}

export type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'name' | 'value' | 'checked' | 'onChange'> & { value: string; label?: ReactNode; description?: ReactNode };
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio({ value, label, description, className, style, disabled, id, ...rest }, ref) {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('Radio must be inside a RadioGroup');
  const auto = useStableId('sg-radio-i');
  const iid = id ?? auto;
  const off = disabled || ctx.disabled;
  return (
    <label className={cx('sg-check', 'sg-check--radio', className)} style={style} data-disabled={off || undefined}>
      <input ref={ref} id={iid} type="radio" className="sg-check__input" name={ctx.name} value={value} checked={ctx.value === value} disabled={off}
        aria-describedby={description ? `${iid}-d` : undefined} onChange={() => ctx.set(value)} {...rest} />
      <span className="sg-check__box" aria-hidden="true"><span className="sg-check__dot" /></span>
      {(label || description) && (
        <span className="sg-check__text">
          {label && <span>{label}</span>}
          {description && <span id={`${iid}-d`} className="sg-check__desc">{description}</span>}
        </span>
      )}
    </label>
  );
});

/* ================================================================================================ ChoiceList */
export type ChoiceOption<T extends string = string> = { value: T; label: ReactNode; description?: ReactNode; icon?: ReactNode; tileColor?: string; disabled?: boolean };
type ChoiceBase<T extends string> = { options: ChoiceOption<T>[]; 'aria-label'?: string; className?: string; style?: CSSProperties };
export type ChoiceListProps<T extends string = string> =
  | (ChoiceBase<T> & { multiple?: false; value?: T; defaultValue?: T; onChange?: (value: T) => void })
  | (ChoiceBase<T> & { multiple: true; value?: T[]; defaultValue?: T[]; onChange?: (value: T[]) => void });

/** Rows of a grouped list are the options; a checkmark marks the chosen ones (settings-style). Single choice is a
    radiogroup (arrow keys move and select), multiple choice a group of checkboxes (arrow keys move, Space toggles). */
export function ChoiceList<T extends string = string>(props: ChoiceListProps<T>) {
  const { options, className, style, 'aria-label': label } = props;
  const multiple = props.multiple === true;
  const [single, setSingle] = useControllable<T | undefined>(!multiple ? props.value : undefined, !multiple ? props.defaultValue : undefined, !multiple ? (props.onChange as (v: T | undefined) => void) : undefined);
  const [many, setMany] = useControllable<T[]>(multiple ? props.value : undefined, multiple ? props.defaultValue ?? [] : [], multiple ? (props.onChange as (v: T[]) => void) : undefined);
  const isOn = (v: T) => (multiple ? many.includes(v) : single === v);
  const pick = (o: ChoiceOption<T>) => {
    if (o.disabled) return;
    if (multiple) setMany(many.includes(o.value) ? many.filter((x) => x !== o.value) : [...many, o.value]);
    else setSingle(o.value);
  };
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const current = !multiple ? options.findIndex((o) => o.value === single) : -1;
  const tabStop = current >= 0 && !options[current].disabled ? current : enabled[0];
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const rows = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-sg-choice]'));
    const at = rows.indexOf(document.activeElement as HTMLElement);
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    let next = -1;
    if (dir) {
      const pos = enabled.indexOf(at);
      next = enabled[(pos + dir + enabled.length) % enabled.length];
    } else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (next < 0 || next === undefined) return;
    e.preventDefault();
    rows[next]?.focus();
    if (!multiple) pick(options[next]);   /* radio semantics: moving selects */
  };
  return (
    <div role={multiple ? 'group' : 'radiogroup'} aria-label={label} className={cx('sg-list', className)} style={style} onKeyDown={onKey}>
      {options.map((o, i) => (
        <div key={o.value} className="sg-list-row" data-has-leading={o.icon ? true : undefined}>
          <button type="button" data-sg-choice role={multiple ? 'checkbox' : 'radio'} aria-checked={isOn(o.value)} aria-disabled={o.disabled || undefined}
            tabIndex={multiple ? (o.disabled ? -1 : 0) : i === tabStop ? 0 : -1}
            className="sg-list-item sg-list-item--action sg-choice" onClick={() => pick(o)}>
            {o.icon && <span className="sg-list-item__leading" style={o.tileColor ? ({ '--_tile': o.tileColor } as CSSProperties) : undefined} aria-hidden="true">{o.icon}</span>}
            <span className="sg-list-item__text">
              <span className="sg-list-item__title">{o.label}</span>
              {o.description && <span className="sg-list-item__subtitle">{o.description}</span>}
            </span>
            <CheckIcon className="sg-choice__check" />
          </button>
        </div>
      ))}
    </div>
  );
}
