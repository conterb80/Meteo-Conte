# Meteo Conte 1.1 · RC24.1 — Ripristino collegamenti operativi

Versione correttiva della RC24. Non aggiunge funzioni: ripristina i collegamenti bloccanti emersi nel test reale.

## Correzioni
- Home → Zoom Earth apre il radar Zoom Earth reale centrato sull’area locale;
- Radar Live → apre la pagina radar attuale di Meteo Pedemontana Forlivese (`radar.php`);
- Radar, Grandine e fallback interni non puntano più alla pagina inesistente `nowcasting.php`;
- Fulmini → apre Blitzortung già centrato su Emilia-Romagna / Borgo Viazza;
- Nowcasting ufficiale → resta collegato alla pagina ufficiale Allerta Meteo Emilia-Romagna;
- cache PWA aggiornata per evitare che il telefono mantenga i vecchi link.

## Installazione
Caricare tutti i file nella root GitHub Pages sostituendo quelli esistenti. Aprire una volta `reset.html`, quindi riaprire l’app.
