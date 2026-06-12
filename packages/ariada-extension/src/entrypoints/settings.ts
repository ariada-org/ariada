// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Settings page controller. Lists the active domain modules and validates the
// "add module" input against the three loading paths (companion-CLI npm name,
// local sandboxed file, rejected remote URL).

import { BUILT_IN_DOMAINS, validateModuleInput } from '../lib/domain-config.js';

interface Refs {
  moduleList: HTMLUListElement;
  addInput: HTMLInputElement;
  addButton: HTMLButtonElement;
  feedback: HTMLElement;
  cliHint: HTMLElement;
}

function refs(): Refs {
  const byId = <T extends HTMLElement>(id: string): T => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`missing #${id} in settings.html`);
    return el as T;
  };
  return {
    moduleList: byId('module-list'),
    addInput: byId('module-input'),
    addButton: byId('module-add'),
    feedback: byId('module-feedback'),
    cliHint: byId('cli-hint'),
  };
}

function renderBuiltins(r: Refs): void {
  r.moduleList.replaceChildren();
  for (const d of BUILT_IN_DOMAINS) {
    const li = document.createElement('li');
    li.className = 'module-row';
    li.dataset['source'] = 'built-in';

    const name = document.createElement('span');
    name.className = 'module-name';
    name.textContent = d.label;

    const meta = document.createElement('span');
    meta.className = 'module-meta';
    meta.textContent = `${d.id} · built-in · v0.1.0`;

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = true;
    toggle.setAttribute('aria-label', `Enable ${d.label} domain`);

    li.append(toggle, name, meta);
    r.moduleList.appendChild(li);
  }
}

function onAdd(r: Refs): void {
  const value = r.addInput.value;
  const result = validateModuleInput(value);
  r.feedback.replaceChildren();
  r.feedback.setAttribute('role', 'status');

  if (!result.ok) {
    r.feedback.classList.add('error');
    r.feedback.classList.remove('ok');
    r.feedback.setAttribute('role', 'alert');
    r.feedback.textContent = result.reason;
    return;
  }

  r.feedback.classList.add('ok');
  r.feedback.classList.remove('error');
  if (result.kind === 'npm') {
    r.feedback.textContent = `"${value.trim()}" is a valid companion-CLI module name.`;
    r.cliHint.textContent = `Run \`ariada extension add ${value.trim()}\` in your terminal, then reload the extension.`;
    r.cliHint.hidden = false;
  } else {
    r.feedback.textContent = `"${value.trim()}" will load in a sandbox and cannot access Chrome APIs or your browsing data.`;
    r.cliHint.hidden = true;
  }
}

function init(): void {
  const r = refs();
  renderBuiltins(r);
  r.cliHint.hidden = true;
  r.addButton.addEventListener('click', () => onAdd(r));
  r.addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onAdd(r);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
