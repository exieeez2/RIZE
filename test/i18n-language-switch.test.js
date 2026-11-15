const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('Language switcher styling and event handling in settings', () => {
  const root = path.join(__dirname, '..');
  const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  const i18nJs = fs.readFileSync(path.join(root, 'src/i18n.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');

  // 1. Verify CSS styles for .lang-seg and .lang-seg-btn
  assert.ok(css.includes('.lang-seg-btn'), 'CSS must include rules for .lang-seg-btn');
  assert.ok(css.includes('background: transparent;'), 'CSS must set background: transparent for .lang-seg-btn');
  assert.ok(css.includes('border: none;'), 'CSS must remove button borders for .lang-seg-btn');
  assert.ok(css.includes('cursor: pointer;'), 'CSS must set cursor: pointer for .lang-seg-btn');

  // Verify .lang-seg-btn.active has accent styling
  const activeRegex = /\.lang-seg-btn\.active[\s\S]*?color:\s*var\(--md-sys-color-on-primary/;
  assert.match(css, activeRegex, '.lang-seg-btn.active must have accented active style');

  // 2. Verify HTML structure
  assert.ok(html.includes('id="lang-seg"'), 'index.html must have #lang-seg');
  assert.ok(html.includes('data-lang="ru"'), 'index.html must have ru button');
  assert.ok(html.includes('data-lang="en"'), 'index.html must have en button');

  // 3. Verify logic in i18n.js
  assert.ok(i18nJs.includes('bindLangEvents'), 'i18n.js must define bindLangEvents');
  assert.ok(i18nJs.includes("e.target.closest('.lang-seg-btn')"), 'i18n.js must listen for clicks on .lang-seg-btn');
  assert.ok(i18nJs.includes('syncLangSeg'), 'i18n.js must define syncLangSeg');

  // Mock DOM environment to verify event delegation and language switching
  const mockStorage = {};
  const mockClassList = (classes = []) => {
    const set = new Set(classes);
    return {
      contains: (c) => set.has(c),
      add: (c) => set.add(c),
      remove: (c) => set.delete(c),
      toggle: (c, force) => {
        if (force !== undefined) {
          if (force) set.add(c); else set.delete(c);
        } else {
          if (set.has(c)) set.delete(c); else set.add(c);
        }
      }
    };
  };

  const createMockElement = (tag, attrs = {}) => {
    const el = {
      tagName: tag.toUpperCase(),
      attributes: { ...attrs },
      classList: mockClassList(),
      children: [],
      textContent: '',
      getAttribute: (k) => el.attributes[k] || null,
      setAttribute: (k, v) => { el.attributes[k] = v; },
      removeAttribute: (k) => { delete el.attributes[k]; },
      closest: (sel) => {
        if (sel === '.lang-seg-btn' && el.attributes.class && el.attributes.class.includes('lang-seg-btn')) return el;
        return null;
      }
    };
    return el;
  };

  const ruBtn = createMockElement('button', { class: 'lang-seg-btn', 'data-lang': 'ru' });
  const enBtn = createMockElement('button', { class: 'lang-seg-btn', 'data-lang': 'en' });
  const langSeg = createMockElement('div', { id: 'lang-seg', class: 'lang-seg' });
  langSeg.children = [ruBtn, enBtn];

  const listeners = {};
  const mockDoc = {
    readyState: 'complete',
    documentElement: createMockElement('html'),
    addEventListener: (ev, fn) => {
      listeners[ev] = listeners[ev] || [];
      listeners[ev].push(fn);
    },
    dispatchEvent: () => true,
    getElementById: (id) => (id === 'lang-seg' ? langSeg : null),
    querySelectorAll: (sel) => {
      if (sel === '.lang-seg-btn') return [ruBtn, enBtn];
      return [];
    }
  };
  langSeg.querySelectorAll = (sel) => (sel === '.lang-seg-btn' ? [ruBtn, enBtn] : []);

  const mockWindow = {
    localStorage: {
      getItem: (k) => mockStorage[k] || null,
      setItem: (k, v) => { mockStorage[k] = String(v); }
    },
    navigator: { language: 'ru-RU' },
    document: mockDoc
  };

  const vm = require('node:vm');
  const context = vm.createContext({
    window: mockWindow,
    document: mockDoc,
    localStorage: mockWindow.localStorage,
    navigator: mockWindow.navigator,
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
  });

  vm.runInContext(i18nJs, context);

  // Initial language should be 'ru' based on navigator.language
  assert.equal(context.window.RizeI18n.getLang(), 'ru');
  assert.equal(ruBtn.classList.contains('active'), true);
  assert.equal(enBtn.classList.contains('active'), false);

  // Simulate click on EN button
  const clickListeners = listeners['click'] || [];
  assert.ok(clickListeners.length > 0, 'Document must have click listener attached');

  const clickEvent = {
    target: enBtn,
    preventDefault: () => {}
  };
  for (const listener of clickListeners) {
    listener(clickEvent);
  }

  // Now language should be switched to 'en'
  assert.equal(context.window.RizeI18n.getLang(), 'en');
  assert.equal(ruBtn.classList.contains('active'), false);
  assert.equal(enBtn.classList.contains('active'), true);
  assert.equal(mockStorage['rize_lang'], 'en');

  // Simulate click back to RU button
  const clickRuEvent = {
    target: ruBtn,
    preventDefault: () => {}
  };
  for (const listener of clickListeners) {
    listener(clickRuEvent);
  }

  assert.equal(context.window.RizeI18n.getLang(), 'ru');
  assert.equal(ruBtn.classList.contains('active'), true);
  assert.equal(enBtn.classList.contains('active'), false);
  assert.equal(mockStorage['rize_lang'], 'ru');
});
