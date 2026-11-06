# Meteo Conte 1.1 · Home RC35.4 / Sala Controllo RC35.5

App meteo personale per Borgo Viazza (Ravenna): Home, previsioni, Radar Live, Evoluzione, Fulmini, avvisi e Lamone.

## Versioni
- **Home e motore meteo:** RC35.4, invariati.
- **Sala Controllo:** RC35.5, revisione organizzativa e grafica mobile-first.
- **Radar e analisi:** algoritmi esistenti mantenuti; questa release non introduce nuove fonti o nuove funzioni.

## Sala Controllo RC35.5
- Riepilogo sintetico prima della mappa, con meno duplicazioni.
- Mappa radar in posizione prioritaria.
- Play, selezione fotogrammi e timeline subito dopo la mappa.
- Analisi automatica, storico eventi e tracking manuale in sezioni di approfondimento.
- Intervallo, velocità, trasparenza e aggiornamento nelle impostazioni radar.
- Evoluzione apre Meteo & Radar esternamente; Fulmini resta disponibile.

## File attivi
- Home: `index.html`, `style.css`, `app.js`.
- Sala Controllo: `radar.html`, `radar.css`, `radar.js`.
- PWA: `manifest.json`, `sw.js`, `reset.html`.

## Verifica
Aprire https://conterb80.github.io/Meteo-Conte/radar.html e verificare la scritta RC35.5.
Se si vede ancora RC35.4, chiudere e riaprire la PWA; evitare reset inutili.

## Limiti
Le stime di nuclei e ETA sono sperimentali, non sostituiscono osservazioni o allerte ufficiali. Le notifiche con app chiusa richiedono infrastruttura push.
