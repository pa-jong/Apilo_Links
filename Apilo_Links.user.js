// ==UserScript==
// @name         Apilo Links
// @namespace    http://tampermonkey.net/
// @version      1.6
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

    const isDetailView = location.pathname.includes("/order/order/detail/");
    const isOverviewView = location.pathname.startsWith("/order/order/") && !isDetailView;

    console.log("[Apilo Links] Widok szczegółowy:", isDetailView);
    console.log("[Apilo Links] Widok ogólny:", isOverviewView);

    if (isDetailView) {
        console.log("[Apilo Links] Wszedłem do widoku szczegółowego");

        let channelElement = [...document.querySelectorAll('.kt-portlet__body .row.static-info')].find(row => row.textContent.includes("Kanał sprzedaży:"));
        let shopUrl = channelElement ? channelElement.querySelector('.col-md-7.value')?.textContent.trim() : null;

        if (!shopUrl) {
            console.warn('Nie znaleziono kanału sprzedaży!');
            return;
        }

        const isSupportedChannel = shopUrl === "elektrone.pl" || shopUrl === "elektronikadomowa.pl";

        if (!shopUrl.startsWith("http://") && !shopUrl.startsWith("https://")) {
            shopUrl = "https://" + shopUrl;
        }

        let externalNumberRow = [...document.querySelectorAll('.kt-portlet__body .row.static-info')].find(row => row.textContent.includes("Numer zewnętrzny:"));
        let externalNumberElement = externalNumberRow?.querySelector('.col-md-7.value');

        if (isSupportedChannel && externalNumberElement) {
            let externalNumber = externalNumberElement.textContent.trim();
            let orderLink = `${shopUrl}/zarzadzanie/sprzedaz/zamowienia_szczegoly.php?id_poz=${externalNumber}`;
            externalNumberElement.innerHTML = `<a href="${orderLink}" target="_blank" title="Otwórz zamówienie w sklepie">${externalNumber}</a>`;
        }

        let rows = document.querySelectorAll('.table.table-hover.table-striped tbody tr');

        rows.forEach(row => {
            let skuCell = row.querySelector('td:nth-child(4)');

            if (skuCell) {
                let cellText = skuCell.textContent.trim();
                let parts = cellText.split('/');
                let ean = parts.length > 1 ? parts[parts.length - 1].trim() : null;

                if (ean && ean !== "-") {
                    let productUrl = `${shopUrl}/szukaj.html/szukaj=${ean}`;
                    skuCell.innerHTML = cellText.replace(ean, `<a href="${productUrl}" target="_blank" title="Otwórz produkt w sklepie">${ean}</a>`);
                }
            }
        });
    }

    if (isOverviewView) {
        console.log("[Apilo Links] Wszedłem do widoku ogólnego");

        const interval = setInterval(() => {
            let rows = document.querySelectorAll('table tbody tr');
            if (rows.length === 0) return;

            clearInterval(interval);
            console.log(`[Apilo Links] Znaleziono ${rows.length} wierszy w tabeli`);

            rows.forEach((row, index) => {
                let orderCell = row.querySelector('td:nth-child(2)');

                if (orderCell) {
                    let fullHTML = orderCell.innerHTML;
                    console.log(`[#${index}] orderCell.innerHTML:`, fullHTML);

                    let shopUrlMatch = fullHTML.match(/(elektronikadomowa\.pl|elektrone\.pl)/i);
                    if (!shopUrlMatch) {
                        console.log(`[#${index}] Pominięto – brak kanału sprzedaży w HTML.`);
                        return;
                    }

                    let shopUrl = `https://${shopUrlMatch[1]}`;
                    console.log(`[#${index}] Rozpoznany kanał sprzedaży: ${shopUrl}`);

                    let spans = orderCell.querySelectorAll('span.text-elipsis');

                    spans.forEach(span => {
                        let num = span.textContent.trim();
                        console.log(`[#${index}] Sprawdzam span: "${num}"`);
                        if (/^\d{4,}$/.test(num)) {
                            let orderLink = `${shopUrl}/zarzadzanie/sprzedaz/zamowienia_szczegoly.php?id_poz=${num}`;
                            console.log(`[#${index}] Podmieniam numer zamówienia ${num} → ${orderLink}`);
                            span.innerHTML = `<a href="${orderLink}" target="_blank" title="Otwórz zamówienie w sklepie">${num}</a>`;
                        }
                    });
                }
            });
        }, 300);
    }
})();
