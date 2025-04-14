// ==UserScript==
// @name         Apilo Links
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Zamienia kody EAN na linki do produktów na podstawie kanału sprzedaży oraz link do zamówienia na sklepie (na podstawie numeru zewnętrznego) z tooltipem (bez ikon)
// @author       Pa-Jong
// @match        https://elektrone.apilo.com/order/order/detail/*
// @require      https://pa-jong.github.io/Apilo_Links/Apilo_Links.user.js
// @updateURL    https://pa-jong.github.io/Apilo_Links/update.json
// @downloadURL  https://pa-jong.github.io/Apilo_Links/Apilo_Links.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Znajdź "Kanał sprzedaży" w sekcji "Szczegóły zamówienia"
    let channelElement = [...document.querySelectorAll('.kt-portlet__body .row.static-info')].find(row => row.textContent.includes("Kanał sprzedaży:"));
    let shopUrl = channelElement ? channelElement.querySelector('.col-md-7.value')?.textContent.trim() : null;

    if (!shopUrl) {
        console.warn('Nie znaleziono kanału sprzedaży!');
        return;
    }

    const isSupportedChannel = shopUrl === "elektrone.pl" || shopUrl === "elektronikadomowa.pl";

    // Dodaj https:// jeśli nie ma
    if (!shopUrl.startsWith("http://") && !shopUrl.startsWith("https://")) {
        shopUrl = "https://" + shopUrl;
    }

    // Szukamy numeru zewnętrznego
    let externalNumberRow = [...document.querySelectorAll('.kt-portlet__body .row.static-info')].find(row => row.textContent.includes("Numer zewnętrzny:"));
    let externalNumberElement = externalNumberRow?.querySelector('.col-md-7.value');

    if (isSupportedChannel && externalNumberElement) {
        let externalNumber = externalNumberElement.textContent.trim();
        let orderLink = `${shopUrl}/zarzadzanie/sprzedaz/zamowienia_szczegoly.php?id_poz=${externalNumber}`;
        externalNumberElement.innerHTML = `<a href="${orderLink}" target="_blank" title="Otwórz zamówienie w sklepie">${externalNumber}</a>`;
    }

    // Przeszukujemy tabelę z pozycjami, gdzie znajduje się SKU/EAN
    let rows = document.querySelectorAll('.table.table-hover.table-striped tbody tr');

    rows.forEach(row => {
        let skuCell = row.querySelector('td:nth-child(4)'); // SKU/EAN jest w 4. kolumnie

        if (skuCell) {
            let cellText = skuCell.textContent.trim();

            // Wyciągnięcie EAN (ostatni element po "/")
            let parts = cellText.split('/');
            let ean = parts.length > 1 ? parts[parts.length - 1].trim() : null;

            if (ean && ean !== "-") {
                let productUrl = `${shopUrl}/szukaj.html/szukaj=${ean}`;
                skuCell.innerHTML = cellText.replace(ean, `<a href="${productUrl}" target="_blank" title="Otwórz produkt w sklepie">${ean}</a>`);
            }
        }
    });
})();
