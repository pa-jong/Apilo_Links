// ==UserScript==
// @name         Apilo Links
// @namespace    http://tampermonkey.net/
// @version      1.7.1
// @description  Zamienia numery zamówień na linki na podstawie kanału sprzedaży w widoku ogólnym i szczegółowym (bez EAN w ogólnym) z obsługą dynamicznego ładowania tabeli (setInterval)
// @author       Pa-Jong
// @match        https://elektrone.apilo.com/order/order/detail/*
// @match        https://elektrone.apilo.com/order/order/*
// @require      https://pa-jong.github.io/Apilo_Links/Apilo_Links.user.js
// @updateURL    https://pa-jong.github.io/Apilo_Links/update.json
// @downloadURL  https://pa-jong.github.io/Apilo_Links/Apilo_Links.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /* ================= CONFIG ================= */
    const CONFIG = {
        SUPPORTED_CHANNELS: [
            "elektrone.pl",
            "elektronikadomowa.pl"
        ]
    };

    const isDetailView = location.pathname.includes("/order/order/detail/");
    const isOverviewView = location.pathname.startsWith("/order/order/") && !isDetailView;

    console.log("[Apilo Links] Start | detail:", isDetailView, "| overview:", isOverviewView);

    /* ================= DETAIL VIEW ================= */
    if (isDetailView) {
        console.log("[Apilo Links] Detail view");

        const channelRow = [...document.querySelectorAll('.kt-portlet__body .row.static-info')]
            .find(r => r.textContent.includes("Kanał sprzedaży:"));

        const rawChannel = channelRow?.querySelector('.col-md-7.value')?.textContent?.trim();

        const matchedDomain = CONFIG.SUPPORTED_CHANNELS.find(d =>
            rawChannel && rawChannel.includes(d)
        );

        const isSupportedChannel = Boolean(matchedDomain);

        if (isSupportedChannel) {
            const shopUrl = `https://${matchedDomain}`;

            // Numer zewnętrzny
            const extRow = [...document.querySelectorAll('.kt-portlet__body .row.static-info')]
                .find(r => r.textContent.includes("Numer zewnętrzny:"));

            const extVal = extRow?.querySelector('.col-md-7.value');

            if (extVal) {
                const num = extVal.textContent.trim();
                extVal.innerHTML =
                    `<a href="${shopUrl}/zarzadzanie/sprzedaz/zamowienia_szczegoly.php?id_poz=${num}" target="_blank">${num}</a>`;
            }

            // Produkty (EAN)
            document.querySelectorAll('.table tbody tr').forEach(row => {
                const skuCell = row.querySelector('td:nth-child(4)');
                if (!skuCell) return;

                const txt = skuCell.textContent.trim();
                const parts = txt.split('/');
                const ean = parts.length > 1 ? parts[parts.length - 1].trim() : null;

                if (!ean || ean === "-") return;

                skuCell.innerHTML = txt.replace(
                    ean,
                    `<a href="${shopUrl}/szukaj.html/szukaj=${ean}" target="_blank">${ean}</a>`
                );
            });

        } else {
            console.log("[Apilo Links] Detail – kanał pominięty:", rawChannel);
        }
    }

    /* ================= OVERVIEW VIEW ================= */
    if (isOverviewView) {
        console.log("[Apilo Links] Overview view");

        const processRows = () => {
            document.querySelectorAll('table tbody tr').forEach(row => {
                if (row.dataset.apiloProcessed) return;

                const cell = row.querySelector('td:nth-child(2)');
                const span = cell?.querySelector('div.text-break > span');
                if (!cell || !span) return;

                const domain = CONFIG.SUPPORTED_CHANNELS.find(d =>
                    cell.innerText.includes(d)
                );

                if (!domain) return;

                const num = span.textContent.trim();
                if (!/^\d{4,}$/.test(num)) return;

                span.innerHTML =
                    `<a href="https://${domain}/zarzadzanie/sprzedaz/zamowienia_szczegoly.php?id_poz=${num}" target="_blank">${num}</a>`;

                row.dataset.apiloProcessed = "1";
            });
        };

        const table = document.querySelector('table');
        if (table) {
            new MutationObserver(() => requestAnimationFrame(processRows))
                .observe(table, { childList: true, subtree: true });
        }

        setTimeout(processRows, 500);
    }

})();
