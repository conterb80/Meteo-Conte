# Meteo Conte 1.1 · RC24 — Fix affidabilità radar

Versione correttiva della RC23, preparata per rendere affidabili i test sul campo.

## Correzioni principali
- corretto il conteggio della pioggia corrente: i campi Open-Meteo non vengono più sommati più volte;
- eliminati falsi accumuli e falsi stati «Evento intenso» causati dal doppio/triplo conteggio;
- caricamento RainViewer con timeout e tentativi automatici;
- indicazione visibile quando l'ultimo frame radar è in ritardo;
- fallback funzionanti verso Radar Pedemontana e Nowcasting ufficiale ER;
- il futuro ufficiale +1/+2/+3 ore non usa più un iframe bloccabile: si apre direttamente dalla fonte ufficiale;
- pulsanti Radar, Fulmini, Grandine e Pioggia collegati a fonti operative reali;
- cache e identificazione aggiornate a RC24.

## Installazione
Caricare tutti i file nella root del repository GitHub Pages sostituendo quelli esistenti. Aprire `reset.html` una volta, oppure aprire l'app con `?v=rc24`.

## Nota operativa
La mappa radar incorporata usa RainViewer. Il nowcasting +1/+2/+3 ore è quello ufficiale Emilia-Romagna e viene aperto esternamente, perché il sito può impedire l'incorporamento. Radar e fulmini restano strumenti di verifica visiva e non vengono letti automaticamente dal motore decisionale.
