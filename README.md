# PDF Comment Remover

Aplicación web para eliminar automáticamente comentarios y anotaciones de PDFs sin aplanar las páginas.

## Objetivo

Automatizar una tarea que normalmente se hace manualmente en Adobe Acrobat: quitar los comentarios/anotaciones de muchos PDFs y conservar el documento como PDF editable.

## Qué hace

- Procesa uno o muchos PDFs en lote.
- Elimina anotaciones reales del PDF (comentarios, notas, highlights, subrayados, tachados, dibujos y otras anotaciones compatibles).
- **No rasteriza, no imprime y no aplana** las páginas.
- Conserva el contenido normal del PDF como contenido seleccionable.
- Mantiene los nombres originales de los archivos.
- En Chrome/Edge de escritorio puede guardar directamente sobre los archivos originales, después de pedir permiso de escritura.
- Si el navegador no permite escribir sobre el original, ofrece la alternativa de descargar el PDF o un ZIP.
- Verifica el PDF resultante antes de guardar y vuelve a comprobar el archivo después de guardarlo.
- Si un PDF no contiene anotaciones, no lo reescribe innecesariamente.
- El procesamiento se realiza localmente en el navegador; los PDFs no se suben a un servidor.

## Uso

1. Abre la aplicación.
2. Pulsa **Abrir PDFs para guardar** si quieres trabajar directamente sobre los originales (Chrome/Edge de escritorio).
3. Selecciona uno o muchos PDFs.
4. Pulsa **Eliminar comentarios y guardar**.
5. La aplicación muestra cuántas anotaciones encontró y eliminó en cada archivo.

También puedes arrastrar PDFs al área de selección. En ese caso, si el navegador no proporciona acceso de escritura al archivo original, se utilizará una descarga como alternativa.

## Tecnología

La primera versión usa `annotpdf` para leer, eliminar y escribir las anotaciones del PDF directamente en memoria. La aplicación es estática y está preparada para GitHub Pages.

## Limitación importante

Esta herramienta elimina anotaciones que existen como objetos de anotación PDF. Si una marca ya fue convertida en parte del contenido gráfico de la página (por ejemplo, al imprimir o aplanar un PDF), no existe una anotación independiente que pueda eliminarse sin reconstruir el contenido de la página.

## Despliegue

El repositorio incluye un workflow de GitHub Actions para publicar la aplicación mediante GitHub Pages. GitHub Pages debe estar habilitado para el repositorio usando **GitHub Actions** como fuente de publicación.

<!-- deployment-trigger: 2026-08-09 -->
