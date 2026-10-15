# Rendimiento · Club Unión de Santo Tomé

Página del área de rendimiento de la Primera de básquet: evaluaciones físicas (saltos, test 30-15, encoder),
distancias para los intermitentes y una hoja por jugador para mostrarle sus resultados.

Los datos **no están en este repositorio**: viven en las planillas de Google y la página los pide con una clave
a un script de Google (ver `apps-script/INSTRUCCIONES.md`). Para ver la página con datos inventados: agregá `?demo` al link.

## Estructura

| Archivo | Qué hace |
|---|---|
| `index.html` | La página y sus pestañas |
| `css/estilos.css` | Diseño (colores del club) |
| `js/config.js` | La URL del script de Google |
| `js/calculos.js` | Todos los cálculos, sin tocar la página (se prueban con Node) |
| `js/graficos.js` | Los gráficos (d3) |
| `js/app.js` | Carga de datos, clave, pestañas y la hoja del jugador |
| `apps-script/Codigo.gs` | El script que lee la planilla DATOS PRIMERA - LIMPIO |
| `datos/ejemplo.json` | Datos inventados para `?demo` |

## Sumar una sección nueva (wellness, minutos, carga)
1. En el script, una función `leerX_` para la pestaña o planilla nueva, y sumarla en `leerTodo_`.
2. En `js/calculos.js`, los cálculos de esa sección.
3. En `index.html`, una pestaña y su panel; en `js/app.js`, la función que la dibuja.

## Pruebas
```
node --test pruebas/*.test.js
```

## Publicar con GitHub Pages
**Settings > Pages > Source: Deploy from a branch > main / (root)**. Queda en
`https://juanpablogomezesc-glitch.github.io/clubunion-rendimiento/`.
