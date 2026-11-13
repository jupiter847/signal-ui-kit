/**
 * Signal UI — small, framework-free interface components.
 * Copyright (c) 2026 Janina. Released under the MIT license.
 * Importing this module is safe outside a browser; component factories need a DOM.
 */

let sequence = 0;
const scrollLocks = new WeakMap();
const uniqueId = (name) => `sg-${name}-${++sequence}`;

function element(document, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function requireElement(node, name) {
  if (!node || node.nodeType !== 1 || typeof node.addEventListener !== 'function') {
    throw new TypeError(`Signal UI: ${name} must be an HTML element.`);
  }
  return node;
}

function browserDocument(node) {
  const document = node?.ownerDocument ?? globalThis.document;
  if (!document?.body) throw new Error('Signal UI: mount components after the document body exists.');
  return document;
}

function rememberAttributes(node, names) {
  const original = names.map((name) => [name, node.getAttribute(name)]);
  return () => original.forEach(([name, value]) => {
    if (value === null) node.removeAttribute(name);
    else node.setAttribute(name, value);
  });
}

function lockScroll(document) {
  let state = scrollLocks.get(document);
  if (!state) {
    state = { count: 0, overflow: document.body.style.overflow };
    scrollLocks.set(document, state);
  }
  state.count += 1;
  document.body.style.overflow = 'hidden';
}

function unlockScroll(document) {
  const state = scrollLocks.get(document);
  if (!state) return;
  state.count -= 1;
  if (state.count === 0) {
    document.body.style.overflow = state.overflow;
    scrollLocks.delete(document);
  }
}

function nativeModal(document, className) {
  const dialog = element(document, 'dialog', className);
  if (typeof dialog.showModal !== 'function') {
    throw new Error('Signal UI: this component needs a browser with native <dialog> support.');
  }
  let previousFocus = null;
  let locked = false;
  let pointerStartedOutside = false;
  let destroyed = false;
  const outside = (event) => {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  const pointerDown = (event) => { pointerStartedOutside = event.button === 0 && event.target === dialog && outside(event); };
  const click = (event) => {
    if (pointerStartedOutside && event.target === dialog && outside(event)) close();
    pointerStartedOutside = false;
  };
  const afterClose = () => {
    if (dialog.open) return;
    if (locked) { unlockScroll(document); locked = false; }
    // Native dialog restores focus. This also covers a removed initial focus target.
    const active = document.activeElement;
    if (previousFocus?.isConnected && (active === document.body || dialog.contains(active))) {
      previousFocus.focus({ preventScroll: true });
    }
  };
  dialog.addEventListener('pointerdown', pointerDown);
  dialog.addEventListener('click', click);
  dialog.addEventListener('close', afterClose);
  document.body.append(dialog);

  function open(focusTarget) {
    if (destroyed) return false;
    if (dialog.open) { focusTarget?.focus({ preventScroll: true }); return true; }
    previousFocus = document.activeElement;
    dialog.showModal();
    if (!locked) { lockScroll(document); locked = true; }
    focusTarget?.focus({ preventScroll: true });
    return true;
  }
  function close(value = '') {
    if (dialog.open) dialog.close(value);
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    close();
    afterClose();
    dialog.removeEventListener('pointerdown', pointerDown);
    dialog.removeEventListener('click', click);
    dialog.removeEventListener('close', afterClose);
    dialog.remove();
  }
  return { dialog, open, close, destroy };
}

function folded(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Filter commands by every space-separated word in a query, preserving order.
 * Matches label, description and keywords; ignores letter case and diacritics.
 * Returns a new array and does not change commands, including disabled items.
 */
export function filterCommands(commands, query = '') {
  if (!Array.isArray(commands)) throw new TypeError('Signal UI: commands must be an array.');
  const words = folded(query).split(' ').filter(Boolean);
  return commands.filter((command) => {
    const text = folded([command.label, command.description, ...(command.keywords ?? [])].join(' '));
    return words.every((word) => text.includes(word));
  });
}

function validCommands(commands) {
  if (!Array.isArray(commands)) throw new TypeError('Signal UI: commands must be an array.');
  const ids = new Set();
  return commands.map((command) => {
    if (!command || typeof command.id !== 'string' || !command.id || ids.has(command.id)) {
      throw new TypeError('Signal UI: each command needs a unique, nonempty string id.');
    }
    if (typeof command.label !== 'string' || !command.label.trim()) {
      throw new TypeError('Signal UI: each command needs a nonempty label.');
    }
    if (!command.disabled && typeof command.onSelect !== 'function') {
      throw new TypeError('Signal UI: enabled commands need an onSelect callback.');
    }
    if (command.keywords !== undefined && (!Array.isArray(command.keywords) || !command.keywords.every((word) => typeof word === 'string'))) {
      throw new TypeError('Signal UI: command keywords must be an array of strings.');
    }
    ids.add(command.id);
    return { ...command, keywords: command.keywords ? [...command.keywords] : [] };
  });
}

/** A searchable command dialog. Ctrl/Meta+K toggles unless another field is being edited. */
export function createCommandMenu({ trigger, commands = [], title = 'Quick actions', placeholder = 'Search for a command…', shortcut = true } = {}) {
  requireElement(trigger, 'trigger');
  const document = browserDocument(trigger);
  let allCommands = validCommands(commands);
  const modal = nativeModal(document, 'sg-command-dialog');
  const { dialog } = modal;
  const titleId = uniqueId('command-title');
  const inputId = uniqueId('command-search');
  const listId = uniqueId('command-list');
  const heading = element(document, 'h2', 'sg-command-title', title);
  heading.id = titleId;
  dialog.setAttribute('aria-labelledby', titleId);
  const top = element(document, 'div', 'sg-command-top');
  const closeButton = element(document, 'button', 'sg-icon-button', '×');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close command menu');
  top.append(heading, closeButton);
  const field = element(document, 'div', 'sg-command-search');
  const searchSymbol = element(document, 'span', 'sg-command-search-symbol', '⌕');
  searchSymbol.setAttribute('aria-hidden', 'true');
  const label = element(document, 'label', 'sg-sr-only', 'Search commands');
  label.htmlFor = inputId;
  const input = element(document, 'input', 'sg-command-input');
  input.id = inputId;
  input.type = 'text';
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', listId);
  input.setAttribute('aria-expanded', 'true');
  field.append(searchSymbol, label, input);
  const results = element(document, 'div', 'sg-command-results');
  const list = element(document, 'div', 'sg-command-list');
  list.id = listId;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Commands');
  const empty = element(document, 'p', 'sg-command-empty', 'No commands found. Try another search.');
  const status = element(document, 'div', 'sg-sr-only');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-atomic', 'true');
  results.append(list, empty, status);
  const footer = element(document, 'div', 'sg-command-footer');
  const movement = element(document, 'span', '', '↑ ↓ to move');
  const selection = element(document, 'span', '', 'Enter to select');
  const escape = element(document, 'span', '', 'Esc to close');
  footer.append(movement, selection, escape);
  dialog.append(top, field, results, footer);
  const restoreTrigger = rememberAttributes(trigger, ['aria-haspopup', 'aria-controls', 'aria-expanded']);
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', dialog.id = uniqueId('command-menu'));
  trigger.setAttribute('aria-expanded', 'false');
  let visible = [];
  let optionNodes = [];
  let activeIndex = -1;
  let destroyed = false;
  let keyboardNavigation = false;

  function setActive(index, scroll = false) {
    activeIndex = index >= 0 && visible[index] && !visible[index].disabled ? index : -1;
    optionNodes.forEach((node, i) => node.setAttribute('aria-selected', String(i === activeIndex)));
    if (activeIndex === -1) input.removeAttribute('aria-activedescendant');
    else {
      input.setAttribute('aria-activedescendant', optionNodes[activeIndex].id);
      if (scroll) optionNodes[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }
  function render() {
    visible = filterCommands(allCommands, input.value);
    list.replaceChildren();
    optionNodes = visible.map((command, index) => {
      const option = element(document, 'div', 'sg-command-option');
      option.id = uniqueId('command-option');
      option.dataset.sgIndex = String(index);
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      if (command.disabled) option.setAttribute('aria-disabled', 'true');
      const symbol = element(document, 'span', 'sg-command-option-symbol', '↗');
      symbol.setAttribute('aria-hidden', 'true');
      const text = element(document, 'span', 'sg-command-option-copy');
      text.append(element(document, 'span', 'sg-command-option-label', command.label));
      if (command.description) text.append(element(document, 'span', 'sg-command-option-description', command.description));
      option.append(symbol, text);
      if (command.shortcut) option.append(element(document, 'kbd', 'sg-command-kbd', command.shortcut));
      list.append(option);
      return option;
    });
    empty.hidden = visible.length > 0;
    list.hidden = visible.length === 0;
    setActive(visible.findIndex((command) => !command.disabled));
    status.textContent = visible.length ? `${visible.length} command${visible.length === 1 ? '' : 's'} available.` : 'No commands found.';
  }
  function open() {
    if (destroyed) return;
    if (!dialog.open) {
      input.value = '';
      keyboardNavigation = false;
      render();
    }
    modal.open(input);
    trigger.setAttribute('aria-expanded', 'true');
  }
  function close() {
    if (destroyed) return;
    modal.close();
    trigger.setAttribute('aria-expanded', 'false');
  }
  function choose(index) {
    const command = visible[index];
    if (!command || command.disabled) return;
    close();
    command.onSelect();
  }
  const inputChange = () => { keyboardNavigation = false; render(); };
  const keydown = (event) => {
    if (event.defaultPrevented || event.isComposing) return;
    const enabled = visible.map((command, index) => command.disabled ? -1 : index).filter((index) => index !== -1);
    const current = enabled.indexOf(activeIndex);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      keyboardNavigation = true;
      if (!enabled.length) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = current === -1 ? (step === 1 ? 0 : enabled.length - 1) : (current + step + enabled.length) % enabled.length;
      setActive(enabled[next], true);
    } else if ((event.key === 'Home' || event.key === 'End') && keyboardNavigation && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      // Home/End retain their normal text-editing behavior until list navigation starts.
      event.preventDefault();
      setActive(enabled[event.key === 'Home' ? 0 : enabled.length - 1] ?? -1, true);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(activeIndex);
    }
  };
  const optionAt = (target) => target?.closest?.('[data-sg-index]');
  const pointerMove = (event) => {
    const option = optionAt(event.target);
    if (option && list.contains(option)) setActive(Number(option.dataset.sgIndex));
  };
  const pointerDown = (event) => { if (optionAt(event.target)) event.preventDefault(); };
  const optionClick = (event) => {
    const option = optionAt(event.target);
    if (option && list.contains(option)) choose(Number(option.dataset.sgIndex));
  };
  const globalKeydown = (event) => {
    if (!shortcut || event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
    if (dialog.open) { event.preventDefault(); close(); return; }
    const editing = event.composedPath().some((node) => node?.nodeType === 1 && (node.matches?.('input, textarea, select') || node.isContentEditable));
    if (editing || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    open();
  };
  const afterClose = () => { if (!dialog.open) trigger.setAttribute('aria-expanded', 'false'); };
  input.addEventListener('input', inputChange);
  input.addEventListener('keydown', keydown);
  list.addEventListener('pointermove', pointerMove);
  list.addEventListener('pointerdown', pointerDown);
  list.addEventListener('click', optionClick);
  trigger.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  dialog.addEventListener('close', afterClose);
  document.addEventListener('keydown', globalKeydown);
  render();
  return {
    open, close,
    setCommands(nextCommands) {
      if (destroyed) return;
      allCommands = validCommands(nextCommands);
      render();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      trigger.removeEventListener('click', open);
      closeButton.removeEventListener('click', close);
      input.removeEventListener('input', inputChange);
      input.removeEventListener('keydown', keydown);
      list.removeEventListener('pointermove', pointerMove);
      list.removeEventListener('pointerdown', pointerDown);
      list.removeEventListener('click', optionClick);
      document.removeEventListener('keydown', globalKeydown);
      dialog.removeEventListener('close', afterClose);
      modal.destroy();
      restoreTrigger();
    },
  };
}

/** A native modal with explicit cancel and confirm paths. Text is never treated as HTML. */
export function createDialog({ trigger, title = 'A moment to confirm', description = '', content, onConfirm, confirmLabel = 'Confirm', cancelLabel = 'Cancel' } = {}) {
  if (trigger) requireElement(trigger, 'trigger');
  if (content) requireElement(content, 'content');
  if (onConfirm !== undefined && typeof onConfirm !== 'function') throw new TypeError('Signal UI: onConfirm must be a function.');
  const document = browserDocument(trigger ?? content);
  const modal = nativeModal(document, 'sg-dialog');
  const { dialog } = modal;
  const heading = element(document, 'h2', 'sg-dialog-title', title);
  heading.id = uniqueId('dialog-title');
  dialog.setAttribute('aria-labelledby', heading.id);
  const header = element(document, 'div', 'sg-dialog-header');
  const closeButton = element(document, 'button', 'sg-icon-button', '×');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close dialog');
  header.append(heading, closeButton);
  dialog.append(header);
  if (description) {
    const text = element(document, 'p', 'sg-dialog-description', description);
    text.id = uniqueId('dialog-description');
    dialog.setAttribute('aria-describedby', text.id);
    dialog.append(text);
  }
  const contentParent = content?.parentNode;
  const contentNextSibling = content?.nextSibling;
  const body = element(document, 'div', 'sg-dialog-content');
  if (content) { body.append(content); dialog.append(body); }
  const footer = element(document, 'div', 'sg-dialog-footer');
  const cancel = element(document, 'button', 'sg-button sg-button-secondary', cancelLabel);
  const confirm = element(document, 'button', 'sg-button sg-button-primary', confirmLabel);
  cancel.type = confirm.type = 'button';
  footer.append(cancel, confirm);
  dialog.append(footer);
  const restoreTrigger = trigger ? rememberAttributes(trigger, ['aria-haspopup', 'aria-controls', 'aria-expanded']) : () => {};
  dialog.id = uniqueId('dialog');
  if (trigger) {
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', dialog.id);
    trigger.setAttribute('aria-expanded', 'false');
  }
  let destroyed = false;
  function open() {
    if (destroyed) return;
    const initial = body.querySelector('[autofocus], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href]') ?? cancel;
    modal.open(initial);
    trigger?.setAttribute('aria-expanded', 'true');
  }
  function close() {
    if (destroyed) return;
    modal.close();
    trigger?.setAttribute('aria-expanded', 'false');
  }
  const confirmAction = () => { close(); onConfirm?.(); };
  const afterClose = () => { if (!dialog.open) trigger?.setAttribute('aria-expanded', 'false'); };
  trigger?.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  cancel.addEventListener('click', close);
  confirm.addEventListener('click', confirmAction);
  dialog.addEventListener('close', afterClose);
  return {
    open, close,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      trigger?.removeEventListener('click', open);
      closeButton.removeEventListener('click', close);
      cancel.removeEventListener('click', close);
      confirm.removeEventListener('click', confirmAction);
      dialog.removeEventListener('close', afterClose);
      modal.destroy();
      restoreTrigger();
      if (contentParent?.isConnected && content) {
        if (contentNextSibling?.parentNode === contentParent) contentParent.insertBefore(content, contentNextSibling);
        else contentParent.append(content);
      } else content?.remove();
    },
  };
}

/** Enhance authored tabs. Arrows move focus; Enter/Space activate the focused tab. */
export function createTabs(root, { onChange } = {}) {
  requireElement(root, 'tabs root');
  if (onChange !== undefined && typeof onChange !== 'function') throw new TypeError('Signal UI: onChange must be a function.');
  const document = browserDocument(root);
  const list = root.querySelector('[role="tablist"]');
  if (!list) throw new Error('Signal UI: tabs need a role="tablist" inside their root.');
  const tabs = Array.from(list.children).filter((node) => node.getAttribute('role') === 'tab');
  if (!tabs.length) throw new Error('Signal UI: the tablist needs direct role="tab" children.');
  const ids = new Set();
  const panels = tabs.map((tab) => {
    const panelId = tab.getAttribute('aria-controls');
    const panel = document.getElementById(panelId);
    if (!tab.id || document.getElementById(tab.id) !== tab || !panel || !root.contains(panel) || ids.has(panelId)) {
      throw new Error('Signal UI: use unique tab IDs and aria-controls IDs pointing to unique panels inside the root.');
    }
    ids.add(panelId);
    return panel;
  });
  const disabled = (tab) => tab.disabled || tab.getAttribute('aria-disabled') === 'true' || tab.hidden;
  const first = tabs.findIndex((tab) => !disabled(tab));
  if (first < 0) throw new Error('Signal UI: at least one tab must be enabled.');
  const restore = tabs.map((tab) => rememberAttributes(tab, ['aria-selected', 'tabindex', 'type']));
  restore.push(...panels.map((panel) => rememberAttributes(panel, ['role', 'aria-labelledby', 'hidden', 'tabindex'])));
  const hadClass = root.classList.contains('sg-tabs');
  root.classList.add('sg-tabs');
  let active = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true' && !disabled(tab));
  if (active < 0) active = first;
  let destroyed = false;

  function update() {
    tabs.forEach((tab, index) => {
      const selected = index === active;
      if (tab.tagName === 'BUTTON') tab.type = 'button';
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[index].setAttribute('role', 'tabpanel');
      panels[index].setAttribute('aria-labelledby', tab.id);
      if (!panels[index].hasAttribute('tabindex')) panels[index].tabIndex = 0;
      panels[index].hidden = !selected;
    });
  }
  function select(id) {
    const index = tabs.findIndex((tab) => tab.id === id);
    if (destroyed || index < 0 || disabled(tabs[index])) return false;
    if (index === active) return true;
    active = index;
    update();
    onChange?.({ id: tabs[index].id, panelId: panels[index].id, tab: tabs[index], panel: panels[index] });
    return true;
  }
  const click = (event) => {
    const tab = event.target.closest?.('[role="tab"]');
    if (tab && tabs.includes(tab)) { event.preventDefault(); select(tab.id); }
  };
  const focusIn = (event) => {
    const tab = event.target.closest?.('[role="tab"]');
    if (tab && tabs.includes(tab)) tabs.forEach((item) => { item.tabIndex = item === tab ? 0 : -1; });
  };
  const focusOut = (event) => {
    if (!list.contains(event.relatedTarget)) tabs.forEach((tab, index) => { tab.tabIndex = index === active ? 0 : -1; });
  };
  const keydown = (event) => {
    const tab = event.target.closest?.('[role="tab"]');
    if (!tab || !tabs.includes(tab) || event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(tab.id); return; }
    const enabled = tabs.filter((item) => !disabled(item));
    const current = enabled.indexOf(tab);
    const vertical = list.getAttribute('aria-orientation') === 'vertical';
    const rtl = document.defaultView.getComputedStyle(list).direction === 'rtl';
    const previousKey = vertical ? 'ArrowUp' : (rtl ? 'ArrowRight' : 'ArrowLeft');
    const nextKey = vertical ? 'ArrowDown' : (rtl ? 'ArrowLeft' : 'ArrowRight');
    let next;
    if (event.key === previousKey) next = enabled[(current - 1 + enabled.length) % enabled.length];
    else if (event.key === nextKey) next = enabled[(current + 1) % enabled.length];
    else if (event.key === 'Home') next = enabled[0];
    else if (event.key === 'End') next = enabled[enabled.length - 1];
    if (!next) return;
    event.preventDefault();
    // Manual activation lets users inspect tab labels without changing the panel.
    next.focus();
  };
  list.addEventListener('click', click);
  list.addEventListener('keydown', keydown);
  list.addEventListener('focusin', focusIn);
  list.addEventListener('focusout', focusOut);
  update();
  return {
    select,
    get activeId() { return tabs[active]?.id ?? null; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      list.removeEventListener('click', click);
      list.removeEventListener('keydown', keydown);
      list.removeEventListener('focusin', focusIn);
      list.removeEventListener('focusout', focusOut);
      restore.forEach((reset) => reset());
      if (!hadClass) root.classList.remove('sg-tabs');
    },
  };
}

/** A three-card toast stack with queued overflow and pause-on-hover/focus timers. */
export function createToasts({ position = 'bottom-right', duration = 4500 } = {}) {
  const positions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
  if (!positions.includes(position)) throw new TypeError(`Signal UI: position must be one of ${positions.join(', ')}.`);
  if (!Number.isFinite(duration) || duration < 0) throw new TypeError('Signal UI: duration must be a nonnegative number.');
  const document = browserDocument();
  const window = document.defaultView;
  const container = element(document, 'section', `sg-toasts sg-toasts-${position}`);
  container.setAttribute('aria-label', 'Notifications');
  const polite = element(document, 'div', 'sg-sr-only');
  polite.setAttribute('role', 'status');
  polite.setAttribute('aria-live', 'polite');
  polite.setAttribute('aria-atomic', 'true');
  const urgent = element(document, 'div', 'sg-sr-only');
  urgent.setAttribute('role', 'alert');
  urgent.setAttribute('aria-atomic', 'true');
  document.body.append(container, polite, urgent);
  const active = new Map();
  const queue = [];
  let destroyed = false;
  const announcements = { polite: [], urgent: [] };
  const frames = { polite: null, urgent: null };

  function announce(message, isUrgent) {
    const key = isUrgent ? 'urgent' : 'polite';
    const region = isUrgent ? urgent : polite;
    announcements[key].push(message);
    if (frames[key] !== null) return;
    region.textContent = '';
    frames[key] = window.requestAnimationFrame(() => {
      frames[key] = null;
      if (!destroyed) region.textContent = announcements[key].splice(0).join(' ');
    });
  }
  function pause(entry, reason) {
    if (entry.paused.has(reason)) return;
    entry.paused.add(reason);
    if (entry.timer !== null) {
      window.clearTimeout(entry.timer);
      entry.timer = null;
      entry.remaining = Math.max(0, entry.remaining - (window.performance.now() - entry.started));
    }
  }
  function resume(entry, reason) {
    entry.paused.delete(reason);
    if (entry.duration === 0 || entry.paused.size || entry.timer !== null || !active.has(entry.id)) return;
    entry.started = window.performance.now();
    entry.timer = window.setTimeout(() => dismiss(entry.id), entry.remaining);
  }
  function mount(entry) {
    const toast = element(document, 'div', `sg-toast sg-toast-${entry.variant}`);
    toast.setAttribute('role', 'group');
    const icon = element(document, 'span', 'sg-toast-icon', entry.variant === 'success' ? '✓' : entry.variant === 'error' ? '!' : '↗');
    icon.setAttribute('aria-hidden', 'true');
    const copy = element(document, 'div', 'sg-toast-copy');
    const title = element(document, 'strong', 'sg-toast-title', entry.title);
    title.id = uniqueId('toast-title');
    toast.setAttribute('aria-labelledby', title.id);
    copy.append(title);
    if (entry.description) copy.append(element(document, 'p', 'sg-toast-description', entry.description));
    toast.append(icon, copy);
    if (entry.action) {
      const action = element(document, 'button', 'sg-toast-action', entry.action.label);
      action.type = 'button';
      action.addEventListener('click', () => { dismiss(entry.id); entry.action.onClick(); });
      toast.append(action);
    }
    const close = element(document, 'button', 'sg-icon-button sg-toast-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', `Dismiss notification: ${entry.title}`);
    close.addEventListener('click', () => dismiss(entry.id));
    toast.append(close);
    toast.addEventListener('pointerenter', () => pause(entry, 'hover'));
    toast.addEventListener('pointerleave', () => resume(entry, 'hover'));
    toast.addEventListener('focusin', () => pause(entry, 'focus'));
    toast.addEventListener('focusout', (event) => { if (!toast.contains(event.relatedTarget)) resume(entry, 'focus'); });
    entry.element = toast;
    active.set(entry.id, entry);
    container.append(toast);
    if (document.hidden) entry.paused.add('hidden');
    resume(entry, 'initial');
    announce(`${entry.variant === 'error' ? 'Error. ' : entry.variant === 'success' ? 'Success. ' : ''}${entry.title}${entry.description ? `. ${entry.description}` : ''}`, entry.variant === 'error');
  }
  function promote() {
    while (!destroyed && active.size < 3 && queue.length) mount(queue.shift());
  }
  function dismiss(id) {
    const waiting = queue.findIndex((entry) => entry.id === id);
    if (waiting >= 0) { queue.splice(waiting, 1); return true; }
    const entry = active.get(id);
    if (!entry) return false;
    if (entry.timer !== null) window.clearTimeout(entry.timer);
    const hadFocus = entry.element.contains(document.activeElement);
    entry.element.remove();
    active.delete(id);
    promote();
    if (hadFocus) {
      if (entry.returnFocus?.isConnected && !container.contains(entry.returnFocus)) entry.returnFocus.focus({ preventScroll: true });
      else container.querySelector('button')?.focus({ preventScroll: true });
    }
    return true;
  }
  function visibility() {
    active.forEach((entry) => document.hidden ? pause(entry, 'hidden') : resume(entry, 'hidden'));
  }
  document.addEventListener('visibilitychange', visibility);
  return {
    show({ title, description = '', variant = 'default', duration: timeout, action } = {}) {
      if (destroyed) return null;
      if (typeof title !== 'string' || !title.trim()) throw new TypeError('Signal UI: a toast needs a nonempty title.');
      if (!['default', 'success', 'error'].includes(variant)) throw new TypeError('Signal UI: toast variant must be default, success or error.');
      if (action && (typeof action.label !== 'string' || !action.label.trim() || typeof action.onClick !== 'function')) throw new TypeError('Signal UI: a toast action needs a label and onClick callback.');
      const lifetime = timeout ?? (action ? 0 : duration);
      if (!Number.isFinite(lifetime) || lifetime < 0) throw new TypeError('Signal UI: toast duration must be a nonnegative number.');
      const entry = { id: uniqueId('toast'), title, description, variant, action, duration: lifetime, remaining: lifetime, started: 0, timer: null, paused: new Set(), element: null, returnFocus: document.activeElement };
      queue.push(entry);
      promote();
      return entry.id;
    },
    dismiss,
    destroy() {
      if (destroyed) return;
      const hadFocus = container.contains(document.activeElement);
      const returnFocus = [...active.values()].map((entry) => entry.returnFocus).find((node) => node?.isConnected && !container.contains(node));
      destroyed = true;
      queue.length = 0;
      [...active.keys()].forEach(dismiss);
      document.removeEventListener('visibilitychange', visibility);
      Object.values(frames).forEach((frame) => { if (frame !== null) window.cancelAnimationFrame(frame); });
      container.remove();
      polite.remove();
      urgent.remove();
      if (hadFocus) returnFocus?.focus({ preventScroll: true });
    },
  };
}
