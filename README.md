# PDF Comment Remover

Aplicación web para eliminar automáticamente comentarios y anotaciones de PDFs sin aplanar las páginas.

## Qué hace

- Procesa uno o muchos PDFs en lote.
- Elimina anotaciones reales del PDF (comentarios, highlights, subrayados, dibujos y otras anotaciones compatibles).
- No rasteriza ni imprime el documento.
- Conserva el contenido de las páginas como contenido PDF seleccionable.
- Mantiene los nombres originales de los archivos.
- Con varios PDFs, genera un ZIP con los archivos procesados.
- El procesamiento se realiza localmente en el navegador; los PDFs no se suben a un servidor.

## Uso

Abre la aplicación, selecciona o arrastra los PDFs y pulsa **Eliminar comentarios**.

La primera versión usa `annotpdf` para leer, eliminar y escribir las anotaciones del PDF directamente en memoria.

## Limitación importante

Esta versión elimina anotaciones que existen como objetos de anotación PDF. Si una marca ya fue convertida en parte del contenido gráfico de la página (por ejemplo, al imprimir/aplanar un PDF), no existe una anotación independiente que pueda eliminarse sin reconstruir el contenido de la página.
