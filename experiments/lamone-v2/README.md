# Lamone V2 — laboratorio separato

Questo prototipo è sul ramo `lamone-v2-prototipo` e **non** modifica la Home pubblicata.

## Funzionalità già implementate
- Layout mobile con gerarchia: sintesi, pioggia a monte, livelli del fiume, Villanova.
- Chiamata Open-Meteo reale a Marradi e Modigliana, stime orarie 6/12/24/48 ore e prossime 12 ore.
- Grafico a barre delle ultime 24 ore di pioggia stimata a Marradi.
- Aggiornamento al ritorno nell'app e ogni dieci minuti in primo piano.
- Gestione esplicita dei dati assenti e orario dell'ultima ora nel modello.
- Collegamenti ad ARPAE per livelli e allerte.

## Limiti non negoziabili
- Le stime puntuali Open-Meteo non sono pluviometri né medie sull'intero bacino.
- Le soglie della sintesi pioggia (10 e 30 mm/24h) sono soltanto **indicatori editoriali sperimentali**, non soglie ufficiali di rischio.
- I livelli idrometrici non sono ancora acquisiti. Non presentare trend, onda, velocità o tempo d'arrivo come misurati.
- Il prototipo non è un sistema di allerta.

## Per passare alla produzione
1. Individuare endpoint ufficiali accessibili e licenze per le serie temporali idrometriche e pluviometriche ARPAE.
2. Mappare identificativi, coordinate, unità e tempi di aggiornamento delle stazioni reali del Lamone e del Marzeno.
3. Verificare su più giorni la disponibilità e la continuità dei dati, inclusi casi di errore.
4. Calcolare differenze su 1h/3h solo su misure temporali valide, e mostrare età del dato.
5. Validare il comportamento mobile, poi integrare nella PWA con possibilità di rollback.

File: `experiments/lamone-v2/index.html`. Può essere aperto come pagina statica in un server HTTP, senza build.
