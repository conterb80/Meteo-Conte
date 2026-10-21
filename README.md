# Meteo Conte 1.1 · RC35.4

Applicazione meteo personale per Borgo Viazza, con Home, previsioni, Sala Controllo, radar, fulmini, avvisi e monitoraggio Lamone.

## Versione pubblicata
**RC35.4 · Manutenzione ed Evoluzione**

- Evoluzione: collegamento esterno al radar animato di Meteo & Radar (senza incorporamento non autorizzato).
- Notifiche: utilizzo del service worker quando supportato; nessuna promessa di push con app completamente chiusa.
- Linguaggio meteo più prudente: distinzione fra previsioni e fenomeni osservati.
- Lamone: eliminato il verde forzato in assenza di dati.
- Aggiornamento periodico dei dati della Home mentre l'app è visibile.
- Versioni principali, cache e reset allineati a RC35.4.

## File attivi
- `index.html`, `style.css`, `app.js`
- `radar.html`, `radar.css`, `radar.js`
- `manifest.json`, `sw.js`, `reset.html`
- icone dell'app

## Installazione e verifica
Aprire https://conterb80.github.io/Meteo-Conte/ e verificare la versione visualizzata.
Se necessario, utilizzare `reset.html` per cancellare le vecchie cache e riaprire l'app.

## Note
Le notifiche a PWA completamente chiusa richiedono un servizio push/server.
Gli avvisi Conte non sostituiscono le allerte ufficiali della Protezione Civile.
Questo README descrive la versione RC35.4: eventuali file storici sono materiale di sviluppo e non documentazione corrente.
