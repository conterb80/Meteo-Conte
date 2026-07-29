# Meteo Conte 1.1 RC26 — Radar Conte integrato

Base: Meteo Conte RC25 + Radar Conte RC13.

## Integrazione
- Radar Conte è incluso nella cartella `radar-conte/` e aperto dentro la Sala Controllo.
- Nessun reindirizzamento a una seconda app durante l’uso normale.
- Funzioni Radar RC13 preservate: radar live, fulmini, analisi cella, tracking, timeline ed evoluzione.
- I vecchi monitor della Sala Controllo sono mantenuti nel codice come fallback ma nascosti, evitando doppioni.
- Home, PRETEMP, Lamone, Trend e Modelli previsionali restano quelli della RC25.
- Il service worker secondario di Radar Conte non viene registrato dentro Meteo Conte, evitando conflitti di cache.

## Installazione
Caricare tutti i file e tutte le cartelle nella root della repository, compresa `radar-conte/`. Aprire poi `reset.html` una volta.
