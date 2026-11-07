# 🗺️ GeoMaster · Comunidades Autónomas de España

Juego para repasar las comunidades autónomas de España (pensado para niños de 11–12 años).
Funciona en el navegador, con ratón o con pantalla táctil, sin instalar nada.

## Cómo jugar

Abre `index.html` en el navegador (o publícalo con GitHub Pages) y elige:

- **¿Qué comunidad es?** – En el mapa (solo la silueta de España) se rellena una comunidad.
  Tienes que tocar su nombre en la lista de la derecha antes de que se acabe el tiempo.
- **¿Dónde está?** – Se marca un nombre en la lista y el mapa muestra el perfil de todas las comunidades.
  Tienes que tocar la comunidad correcta en el mapa.
- **Mezclado** – Un poco de cada.

Reglas:

- Tiempo por pregunta configurable: 3, **5 (por defecto)**, 8, 12 segundos o sin límite.
- Si aciertas, la comunidad se queda coloreada y con su nombre en el mapa.
- Si fallas o se acaba el tiempo, se muestra cuál era, se vuelve a ocultar y saldrá otra vez más adelante.
- La partida termina cuando están todas descubiertas. Al final se ven las estrellas y las comunidades para repasar.
- Opción para incluir o no Ceuta y Melilla (ciudades autónomas).

## Estructura

```
index.html        Página del juego
css/style.css     Estilos (adaptado a horizontal y vertical)
js/game.js        Lógica del juego
js/map-data.js    Mapa ya proyectado a SVG (generado)
tools/            Script para regenerar js/map-data.js
```

## Regenerar el mapa (opcional)

El mapa sale de [es-atlas](https://github.com/martgnz/es-atlas) (licencia MIT, datos del IGN) y se proyecta con d3-geo:

```bash
cd tools && npm install && npm run generate
```
