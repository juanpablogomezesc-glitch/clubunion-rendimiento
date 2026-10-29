# Conectar la página con la planilla: paso a paso

Se hace **una sola vez**, en la computadora. El script va dentro de la planilla **DATOS PRIMERA - LIMPIO** (carpeta Club Union Santo Tome 🏀). No cambia ninguna pestaña: solo agrega una nueva, "Accesos".

## Cómo funciona
- La página no guarda datos. Cuando alguien la abre, le pide los datos a este script con una **clave**.
- Cada persona que quieras que entre tiene una fila en la pestaña **Accesos** con su clave y su link (por ejemplo `.../clubunion-rendimiento/?c=AbCd...`). Quien no tiene el link no ve nada.
- El script solo manda jugador, fecha, test y valor de las pestañas **Saltos**, **IFT** y **Encoder**. No manda nada de la hoja Plantel (nacimiento, peso) ni las notas.
- Lo que está "Excluido" no se manda. En el encoder, lo que está "A revisar" llega sin velocidad, igual que en el resumen de la planilla.

## 1. Pegar el código
1. Abrí **DATOS PRIMERA - LIMPIO**.
2. **Extensiones > Apps Script**.
3. Abrí este link, que muestra el archivo como texto: `https://raw.githubusercontent.com/juanpablogomezesc-glitch/clubunion-rendimiento/main/apps-script/Codigo.gs`
4. Clic en la página, **Ctrl + A**, **Ctrl + C**.
5. En Apps Script: clic en el editor, **Ctrl + A**, **Suprimir**, **Ctrl + V**. Revisá que la última línea termine en `};`.
6. Guardá (**Ctrl + S**).

## 2. Crear las claves
1. Arriba elegí la función **configurar** y tocá **Ejecutar**. Google pide permisos: elegí tu cuenta. Si aparece "Google no verificó esta aplicación", tocá **Configuración avanzada > Ir a … (no seguro)**. Es normal: el código es tuyo y solo usa esta planilla.
2. Aparece la pestaña **Accesos** con una fila con tu nombre. Si querés más personas (el DT, el asistente), agregá una fila con el nombre de cada una.
3. Elegí **generarClaves** y **Ejecutar**. Se completan la clave y el link de cada fila.

## 3. (Opcional) Probar la lectura
Elegí **probarLectura**, **Ejecutar** y mirá el registro de ejecución: dice cuántas filas leyó de cada pestaña y qué jugadores encontró.

## 4. Publicarlo
1. **Implementar > Nueva implementación**.
2. Tipo: **Aplicación web**.
3. **Ejecutar como: Yo**. **Quién tiene acceso: Cualquier persona**. (La clave es la que protege los datos.)
4. **Implementar** y copiá la **URL de la aplicación web**. Termina en `/exec`.
5. Pasame esa URL y la conecto con la página (va en `js/config.js`).

## Carga: minutos y RPE (planilla CARGA PRIMERA)
La pestaña **Carga** de la página lee otra planilla, **CARGA PRIMERA** (misma carpeta). Para activarla, una sola vez:
1. Pegá la versión nueva de `Codigo.gs` (paso 1) y guardá.
2. Elegí la función **crearFormularioRPE** y **Ejecutar**. Google pide permisos de nuevo (ahora también para crear formularios y abrir la otra planilla): aceptalos.
3. En el registro aparece el **link para los jugadores**. También queda en la página, en la pestaña Carga, con un botón para copiarlo.
4. **Implementar > Administrar implementaciones > lápiz > Versión: Nueva versión > Implementar.**

Después, en el día a día:
- **Sesiones**: una fila por entrenamiento, gimnasio o partido, con la fecha, el tipo y cuántos minutos duró.
- **Partidos**: una fila por partido con los minutos de cada jugador.
- Los jugadores completan el formulario al terminar. Las respuestas caen solas en la pestaña "Respuestas RPE".
- Si cambia el plantel, editá la pestaña **Plantel** de CARGA PRIMERA (y la columna en Partidos) y ejecutá **actualizarFormulario**.

## Minutos desde la planilla de la CAP (PDF)
Los minutos de los partidos (y las estadísticas: puntos, tiros, rebotes, etc.) se pueden cargar solos desde el PDF de estadísticas de la app de la CAP.

Una sola vez:
1. En el editor de Apps Script, a la izquierda, **Servicios** (el **+**) > **Drive API** > **Agregar**. Sirve para convertir el PDF en texto.
2. Ejecutá **probarPlanilla**: lee el PDF más nuevo de la carpeta "Planillas de partido (PDF)" y muestra en el registro qué entendió (rival, minutos y a qué jugador de tu plantel corresponde cada nombre). No escribe nada.
3. Si está bien, ejecutá **activarLecturaAutomatica**. Desde ahí, cada hora el script lee los PDF nuevos de la carpeta.
4. **Implementar > Administrar implementaciones > lápiz > Versión: Nueva versión > Implementar.**

Después de cada partido:
- Cargá la fila "Partido" en **Sesiones** (fecha y duración), como siempre: de ahí sale la **fecha**, porque el PDF no la trae.
- Subí el PDF a la carpeta **Planillas de partido (PDF)** (desde el celular con la app de Drive).
- En menos de una hora aparecen los minutos en **Partidos** y todas las métricas en la pestaña **Estadísticas**.

Si un nombre de la CAP no coincide con el plantel (por ejemplo "BARONI, JUANSE"), corregilo en la pestaña **Equivalencias**: columna A como figura en la planilla de la CAP, columna B el nombre de tu plantel. Un jugador que no estaba en el plantel se agrega solo (revisá las tildes del nombre).

## Cuando cargás una evaluación nueva
No hay que hacer nada: cargala en Saltos, IFT o Encoder con el mismo formato y la página la muestra sola (tarda hasta 5 minutos, o tocá **Actualizar** en la página). Los cambios se calculan entre la primera y la última evaluación.

## Si un link se filtra o alguien deja de tener acceso
Borrá la clave de esa fila. El link deja de funcionar enseguida. Si querés darle uno nuevo, ejecutá **generarClaves**.

## Si cambio el código más adelante
Pegá la versión nueva, guardá y hacé **Implementar > Administrar implementaciones > editar (lápiz) > Versión: Nueva versión**. La URL no cambia.
