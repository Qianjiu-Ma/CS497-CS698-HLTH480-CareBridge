import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from './WorkspaceUi';
import { useOverlayScrollbars } from '../utils/overlayScrollbars';

type Option<Value> = { value: Value; label: string; lang?: string };
type Group<Value> = { label: string; options: readonly Option<Value>[] };

// Keep the panel above clipped cards and within the viewport in either direction.
function positionMenu(panel: HTMLDivElement, trigger: HTMLButtonElement) {
  const anchor = trigger.getBoundingClientRect();
  const edge = 8;
  const gap = 6;
  const width = Math.min(Math.max(240, anchor.width), document.documentElement.clientWidth - 2 * edge);
  const rtl = getComputedStyle(trigger).direction === 'rtl';
  const start = rtl ? anchor.left : anchor.right - width;
  panel.style.width = width + 'px';
  panel.style.left = Math.max(edge, Math.min(start, document.documentElement.clientWidth - width - edge)) + 'px';

  const below = window.innerHeight - anchor.bottom - gap - edge;
  const above = anchor.top - gap - edge;
  const placeAbove = below < Math.min(panel.scrollHeight + 2, 384) && above > below;
  panel.style.maxHeight = `min(24rem, ${Math.max(0, placeAbove ? above : below)}px)`;
  panel.style.top = (placeAbove ? anchor.top - gap - panel.offsetHeight : anchor.bottom + gap) + 'px';
}

export function SelectPopover<Value extends string | number>({
  label, value, onChange, options = [], groups = [], icon, displayValue, disabled, id, className, triggerRef,
  notifyOnReselect = false,
}: {
  label: string;
  value: Value;
  onChange: (value: Value) => void;
  options?: readonly Option<Value>[];
  groups?: readonly Group<Value>[];
  icon?: ReactNode;
  displayValue?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  notifyOnReselect?: boolean;
}) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const picker = useRef<HTMLDivElement>(null);
  const defaultTrigger = useRef<HTMLButtonElement>(null);
  const trigger = triggerRef ?? defaultTrigger;
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ prefix: '', time: 0 });
  const [openAt, setOpenAt] = useState<number | null>(null);
  const open = openAt !== null && !disabled;
  const all = [...options, ...groups.flatMap((group) => group.options)];
  const selectedIndex = all.findIndex((option) => option.value === value);
  const selected = all[selectedIndex];

  useLayoutEffect(() => {
    const panel = menu.current;
    const button = trigger.current;
    if (!panel || !button || !open) return;
    const place = (event?: Event) => {
      if (event?.target === panel) return;
      const bounds = button.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > window.innerHeight) {
        setOpenAt(null);
        return;
      }
      positionMenu(panel, button);
    };
    panel.showPopover?.();
    place();
    search.current = { prefix: '', time: 0 };
    panel.querySelectorAll('button')[openAt]?.focus();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, openAt, trigger]);
  useOverlayScrollbars(menu, 'y', open);

  useLayoutEffect(() => {
    if (menu.current && trigger.current) positionMenu(menu.current, trigger.current);
  }, [all.length, trigger]);

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !picker.current?.contains(event.target)) setOpenAt(null);
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [open]);

  function dismissAndRestoreFocus() {
    trigger.current?.focus();
    setOpenAt(null);
  }

  function handleMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
      dismissAndRestoreFocus();
      return;
    }

    const items = Array.from(menu.current?.querySelectorAll('button') ?? []);
    const index = items.findIndex((option) => option === event.target);
    const last = items.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowDown': next = index === last ? 0 : index + 1; break;
      case 'ArrowUp': next = index <= 0 ? last : index - 1; break;
      case 'Home': next = 0; break;
      case 'End': next = last; break;
      default: {
        if (event.key.length !== 1 || !event.key.trim() || event.ctrlKey || event.metaKey || event.altKey) return;
        const letter = event.key.toLocaleLowerCase();
        const previous = event.timeStamp - search.current.time < 600 ? search.current.prefix : '';
        const prefix = previous === letter ? letter : previous + letter;
        search.current = { prefix, time: event.timeStamp };
        const start = prefix.length === 1 ? index + 1 : index;
        const ordered = [...items.slice(start), ...items.slice(0, start)];
        const match = ordered.find((item) => item.textContent?.trim().toLocaleLowerCase().startsWith(prefix));
        if (!match) return;
        next = items.indexOf(match);
        break;
      }
    }
    event.preventDefault();
    items[next]?.focus();
  }

  const renderOption = (option: Option<Value>) => (
    <button key={option.value} type="button" className="cb-select-option" data-value={option.value}
      role="menuitemradio" aria-checked={option.value === value} tabIndex={-1}
      onClick={() => {
        dismissAndRestoreFocus();
        if (notifyOnReselect || option.value !== value) onChange(option.value);
      }}>
      <bdi lang={option.lang}>{option.label}</bdi>
      <Check className="cb-select-check" aria-hidden="true" />
    </button>
  );

  return (
    <div className={'cb-select' + (className ? ' ' + className : '')} ref={picker} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpenAt(null);
    }}>
      <Button id={triggerId} ref={trigger} className="cb-select-trigger"
        aria-label={label} aria-describedby={generatedId + '-current'}
        aria-haspopup="menu" aria-expanded={open} aria-controls={open ? generatedId + '-menu' : undefined}
        disabled={disabled || !all.length}
        onClick={() => setOpenAt(open ? null : Math.max(0, selectedIndex))}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          setOpenAt(event.key === 'ArrowDown' ? 0 : all.length - 1);
        }}
      >
        {icon}
        <bdi className="cb-select-value" lang={displayValue ? undefined : selected?.lang}>
          {displayValue ?? selected?.label ?? value}
        </bdi>
        <ChevronDown className="cb-disclosure-icon" aria-hidden="true" />
      </Button>
      <bdi id={generatedId + '-current'} className="sr-only" lang={selected?.lang}>{selected?.label ?? value}</bdi>
      {open && (
        <div id={generatedId + '-menu'} ref={menu} role="menu" aria-labelledby={triggerId} popover="manual"
          className="cb-select-menu cb-motion-popover" onKeyDown={handleMenuKey}>
          {options.map(renderOption)}
          {groups.map((group) => (
            <div className="cb-select-group" key={group.label} role="group" aria-label={group.label}>
              <p aria-hidden="true">{group.label}</p>
              {group.options.map(renderOption)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
