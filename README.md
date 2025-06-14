# Gestor de Horneadas

Aplicación web ligera para registrar, visualizar y comparar curvas de temperatura de hornadas de leña.  
Pensada para ceramistas que quieren llevar control histórico y visual de sus procesos.

---

## Funcionalidades

- Registrar datos de una hornada: nombre, fecha, hora, tipo, leña, notas.
- Añadir registros de temperatura (hora, °C, nota).
- Visualizar en tabla y gráfico tipo curva.
- Guardar, cargar, editar y eliminar hornadas.
- Exportar e importar datos (JSON, CSV, Excel).
- Comparar curvas de varias hornadas en un solo gráfico.
- Imprimir informes.
- Modal de ayuda rápida.
- Soporta edición en línea de tablas y deshacer borrado de registros.

---

## Instalación y uso

1. **Clona este repositorio o descarga los archivos:**
    ```bash
    git clone https://github.com/<TU_USUARIO>/gestor-horneadas.git
    ```
2. **Abre `index.html` en tu navegador.**  
   _No requiere servidor ni instalación adicional._

3. **Opcional:**  
   Publica la app usando GitHub Pages para acceso web instantáneo.

---

## Estructura de archivos

```
gestor-horneadas/
├── index.html
├── script.js
├── style.css
└── (assets/)
```

---

## Tecnologías utilizadas

- [Dexie.js](https://dexie.org/) (IndexedDB) para base de datos local.
- [Chart.js](https://www.chartjs.org/) para gráficas.
- HTML5, CSS3, JavaScript.

---

## Créditos y licencia

Desarrollado por [fabitky](https://github.com/fabitky).  
Libre para usar, modificar y compartir.  
Licencia: [MIT](LICENSE)

---

## Capturas de pantalla

_Puedes añadir capturas aquí tras tu primer release._

---

## Mejoras sugeridas para próximas ediciones

- Personalización de colores y tema oscuro.
- Ajustes avanzados de exportación.
- Sincronización en la nube.
- Soporte multiusuario.
- Más tipos de gráficos.