// ==UserScript==
// @name         APILO: Asystent UI
// @namespace    http://tampermonkey.net/
// @version      1.7.2
// @description  Modufikuje widok szczegółów zamówienia usuwa zbędne elemety poprawia widoczność na panelu dotykowym
// @author       Pa-Jong
// @match        https://elektrone.apilo.com/order/order/detail/*
// @updateURL    https://pa-jong.github.io/ApiloAsystentUI/update.json
// @downloadURL  https://pa-jong.github.io/ApiloAsystentUI/ApiloAsystentUI.user.js
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function(){
  'use strict';

  const HIDE_CLASS = 'apilo-hide-kt-portlet';
  const STORAGE_KEY = 'apilo_portlet_hidden_v6_noDetailsPanel';
  const MAX_ATTEMPTS = 80;
  const INTERVAL_MS = 250;

  // ===== style =====
  const style = document.createElement('style');
  style.id = 'apilo-combined-style-right';
  style.textContent = `
/* Gdy panel schowany: ukryj wszystkie elementy toolbara poza przyciskiem "Pakuj" */
body.apilo-hide-kt-portlet .kt-portlet__head-toolbar {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
}

/* domyślnie ukryj wszystkie bezpośrednie dzieci toolbara (tylko przy stanie schowany) */
body.apilo-hide-kt-portlet .kt-portlet__head-toolbar > * {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

/* ale przycisk "Pakuj" zawsze pokazujemy, nawet gdy toolbar jest "schowany" */
body.apilo-hide-kt-portlet .kt-portlet__head-toolbar a[data-packing-assistant-button] {
  display: inline-block !important;
  visibility: visible !important;
  opacity: 1 !important;
  pointer-events: auto !important;
  margin-left: 8px !important;
  z-index: 120000 !important;
}

/* ukrywanie panelu statusów/toolbara (tylko elementy statusów w lewym bloku) */
body.${HIDE_CLASS} .mr-3.d-none.d-lg-block .kt-portlet { display: none !important; }

/* podstawowe style dla elementów apilo */
.apilo-toggle-link { margin-left: 12px; font-size: 13px; cursor: pointer; color: #007bff; user-select: none; vertical-align: middle; }
.apilo-toggle-link:hover { text-decoration: underline; }

/* SKU jako główny, nazwa pod spodem */
.apilo-sku-main { font-size: 1.4em !important; font-weight: 700 !important; display: block; line-height: 1.1; }
.apilo-name-sub { font-size: 0.92rem !important; color: #9a9a9a !important; display: block; margin-top: 4px; }
.apilo-qty-cell { font-size: 1.02rem !important; font-weight: 600 !important; vertical-align: middle; }

.thumb { position: relative; }
.thumb a.apilo-thumb-link { display:inline-block; }
.thumb a.apilo-thumb-link img { display:block; max-height:64px; }

td.apilo-hide-col { display: none !important; }
thead th.apilo-hide-col { display: none !important; }

table.table tbody td { vertical-align: middle; }

/* ukrywanie czatów i widgetów pomocniczych */
#button-chat,
#apilo-live-chat,
#apilo-chat-widget,
.apilo-chat-widget,
.chat-widget,
.chatbot,
.chat-bot,
.chat-boat,
#chat-iframe,
iframe[src*="chat"],
iframe[src*="support"],
iframe[src*="help"],
div[id*="chat"],
div[class*="chat"],
div[id*="help"],
div[class*="help"],
div[class*="support"],
div[class*="porozmawiaj"],
div[id*="porozmawiaj"],
a[href*="porozmawiaj"],
a[href*="chat"],
a[href*="help"],
.kodabots-widget-animated-4gHwe12,
.kodabots-widget-animated-4gHwe12.show,
div[class*="kodabots-widget"],
div[class^="kodabots-widget"] {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
}

/* --- Zapewnij widoczność przycisku Pakuj (override generalny) --- */
a[data-packing-assistant-button],
a[href*="packing-assistant"],
a.btn.btn-info.rajax.btn-primary {
  display: inline-block !important;
  visibility: visible !important;
  opacity: 1 !important;
  pointer-events: auto !important;
  z-index: 110000 !important;
}

/* ====== RIGHT-TOP TOGGLE CONTAINER ====== */
#apilo-right-toggle {
  position: absolute;
  right: 12px;
  top: 12px;
  z-index: 120000;
  display: flex;
  gap: 8px;
  align-items: center;
}
#apilo-right-toggle .apilo-btn {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:6px 10px;
  border-radius:4px;
  border:1px solid rgba(0,0,0,0.08);
  background:#5867dd;
  color:#fff;
  text-decoration:none;
  font-size:13px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
@media (max-width:900px){
  #apilo-right-toggle { right:8px; top:8px; transform: none; }
  #apilo-right-toggle .apilo-btn { padding:5px 8px; font-size:12px; }
}

/* Dodatkowe zabezpieczenie: jeśli toolbar ma inline display:none ustawiony gdzieś indziej, pokaż tylko "Pakuj" */
body.apilo-hide-kt-portlet .kt-portlet__head-toolbar[style*="display:none"] {
  display: flex !important;
}
body.apilo-hide-kt-portlet .kt-portlet__head-toolbar[style*="display:none"] > * { display:none !important; }
body.apilo-hide-kt-portlet .kt-portlet__head-toolbar[style*="display:none"] a[data-packing-assistant-button] {
  display:inline-block !important;
  visibility: visible !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}
`;
  document.head.appendChild(style);

  // ===== utilities =====
  function escapeRegExp(string) {
    return (string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ===== ensure right-top toggle button =====
  const RIGHT_TOGGLE_ID = 'apilo-right-toggle';
  function ensureRightToggle() {
    const header = document.getElementById('kt_header') || document.querySelector('.kt-header') || document.body;
    if (!header) return false;

    if (getComputedStyle(header).position === 'static') header.style.position = 'relative';

    let container = document.getElementById(RIGHT_TOGGLE_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = RIGHT_TOGGLE_ID;
      header.appendChild(container);
    }

    if (!container.querySelector('.apilo-btn-toggle')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'apilo-btn apilo-btn-toggle';
      btn.textContent = document.body.classList.contains(HIDE_CLASS) ? 'Pokaż panel' : 'Ukryj panel';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const nowHidden = !document.body.classList.contains(HIDE_CLASS);
        if (nowHidden) document.body.classList.add(HIDE_CLASS);
        else document.body.classList.remove(HIDE_CLASS);
        localStorage.setItem(STORAGE_KEY, nowHidden ? '1' : '0');
        btn.textContent = nowHidden ? 'Pokaż panel' : 'Ukryj panel';
      });
      container.appendChild(btn);
    } else {
      const btn = container.querySelector('.apilo-btn-toggle');
      if (btn) btn.textContent = document.body.classList.contains(HIDE_CLASS) ? 'Pokaż panel' : 'Ukryj panel';
    }

    return true;
  }

  // ===== transformTable =====
  function transformTable() {
    const table = document.querySelector('.kt-portlet__body .table-responsive table.table');
    if (!table) return false;

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    if (!thead || !tbody) return false;

    // hide headers: Netto / VAT / SKU/EAN
    Array.from(thead.querySelectorAll('th')).forEach(th => {
      const txt = (th.textContent || '').trim().toLowerCase();
      if (txt.includes('cena netto') || txt.includes('stawka vat') || txt.includes('sku') || txt.includes('ean')) {
        th.classList.add('apilo-hide-col');
      }
    });

    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.forEach(tr => {
      const cells = Array.from(tr.children);
      if (cells.length === 0) return;

      const thumbCell = cells[1] || null;
      const nameCell = cells[2] || cells[1] || cells[0];
      const skuCell = cells[3] || null;
      const qtyCell = cells[4] || cells.find(c => c.classList.contains('text-center')) || null;

      // ============================================================
      // 1) ZAPAMIĘTAJ link original-code zanim nameCell zostanie wyczyszczony
      // ============================================================
      try {
        const a = tr.querySelector('a[href*="original-code/"]');
        if (a) {
          const raw = a.getAttribute('href'); // WAŻNE: getAttribute, nie .href
          if (raw) tr.dataset.apiloOriginalCodeHref = raw;
        }
      } catch(e){}

      // ============================================================
      // 2) PODPINANIE LINKU POD ZDJĘCIE: robimy BEZPOŚREDNIO allegro.pl/iID.html
      // ============================================================
      try {
        if (thumbCell && tr.dataset.apiloOriginalCodeHref) {

          const m = tr.dataset.apiloOriginalCodeHref.match(/original-code\/(\d+)/);
          if (m && m[1]) {
            const allegroHref = 'https://allegro.pl/i' + m[1] + '.html';

            const img = thumbCell.querySelector('img');
            if (img) {
              const existingLink = thumbCell.querySelector('a.apilo-thumb-link');

              if (!existingLink) {
                const newA = document.createElement('a');
                newA.className = 'apilo-thumb-link';
                newA.href = allegroHref;
                newA.target = '_blank';
                newA.rel = 'noopener noreferrer';

                img.parentNode.replaceChild(newA, img);
                newA.appendChild(img);
              } else {
                existingLink.href = allegroHref;
              }
            }
          }
        }
      } catch(e){ console.warn('apilo: podpinanie linku do miniatury', e); }

      // ============================================================
      // 3) Resztę przeróbek rób tylko raz
      // ============================================================
      if (tr.dataset.apiloProcessed === '1') return;

      // SKU cleaning
      let skuText = '';
      if (skuCell) {
        skuText = skuCell.textContent.trim();
        skuText = skuText.replace(/\/\s*\d{8,13}\s*$/g, '').replace(/\s*\d{8,13}\s*$/g, '').trim();
        skuText = skuText.replace(/\/\s*$/g, '').trim();
      }

      // product name
      let productNameText = '';
      if (nameCell) {
        const clone = nameCell.cloneNode(true);
        clone.querySelectorAll('i, img, a, .flaticon').forEach(n => n.remove());
        productNameText = (clone.textContent || '').trim();
        if (skuText) {
          const re = new RegExp(escapeRegExp(skuText), 'gi');
          productNameText = productNameText.replace(re, '').trim();
        }
      }

      // remove a.rajax and flaticon icons from original nameCell
      try {
        if (nameCell) {
          const toRemove = nameCell.querySelectorAll('a.rajax, i.flaticon, i.sprite-platform-11');
          toRemove.forEach(n => n.remove());

          const possibleDivs = nameCell.querySelectorAll('div');
          possibleDivs.forEach(d => {
            const styleAttr = (d.getAttribute('style') || '').replace(/\s/g,'').toLowerCase();
            if (styleAttr.includes('margintop:6px') || d.innerHTML.trim() === '') d.remove();
          });
        }
      } catch(e){}

      // insert structure: SKU main, name sub
      if (nameCell && !nameCell.querySelector('.apilo-sku-main')) {
        nameCell.innerHTML = '';
        if (skuText) {
          const skuEl = document.createElement('span');
          skuEl.className = 'apilo-sku-main';
          skuEl.textContent = skuText;
          nameCell.appendChild(skuEl);
        }
        const nameEl = document.createElement('span');
        nameEl.className = 'apilo-name-sub';
        nameEl.textContent = productNameText || '';
        nameCell.appendChild(nameEl);
      }

      // hide original sku column
      if (skuCell) skuCell.classList.add('apilo-hide-col');

      // enlarge qty
      if (qtyCell) qtyCell.classList.add('apilo-qty-cell');

      // hide netto/vat cells if present (indices 5 and 6)
      if (cells.length >= 7) {
        if (cells[5]) cells[5].classList.add('apilo-hide-col');
        if (cells[6]) cells[6].classList.add('apilo-hide-col');
      } else {
        cells.forEach(c => {
          const txt = (c.textContent || '').trim();
          if (/^\d+(\.\d+)?\s*%$/.test(txt) || /cena netto/i.test(txt)) c.classList.add('apilo-hide-col');
        });
      }

      tr.dataset.apiloProcessed = '1';
    });

    return true;
  }

  // ===== Ensure "Pakuj" button is visible but DO NOT move it =====
  function ensurePackingButtonVisibleButDontMove() {
    try {
      const btn = document.querySelector('a[data-packing-assistant-button], a[href*="packing-assistant"]');
      if (!btn) return;
      btn.style.display = 'inline-block';
      btn.style.visibility = 'visible';
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
      btn.style.zIndex = '110001';
      btn.style.marginLeft = btn.style.marginLeft || '6px';
    } catch(e) { console.warn('apilo: ensurePackingButtonVisibleButDontMove', e); }
  }

  // ===== main polling =====
  const saved = localStorage.getItem(STORAGE_KEY);
  const initiallyHidden = saved === null ? true : (saved === '1');
  if (initiallyHidden) document.body.classList.add(HIDE_CLASS);

  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;

    ensureRightToggle();
    try { transformTable(); } catch(e){ console.warn(e); }
    try { ensurePackingButtonVisibleButDontMove(); } catch(e){ console.warn(e); }

    if (attempts >= MAX_ATTEMPTS) clearInterval(interval);
  }, INTERVAL_MS);

  window.addEventListener('load', () => {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s !== null && s === '1') document.body.classList.add(HIDE_CLASS);
    ensureRightToggle();
    try { transformTable(); } catch(e){}
    try { ensurePackingButtonVisibleButDontMove(); } catch(e){}
  });

})();
