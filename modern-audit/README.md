# PDF Tools

Aplicación web estática para trabajar con PDFs localmente en el navegador.

## Herramientas

- **Eliminar comentarios/anotaciones:** elimina objetos de anotación PDF compatibles sin rasterizar ni aplanar las páginas y verifica el resultado antes de guardar.
- **Cambiar texto:** busca texto seleccionable, elimina las coincidencias mediante redacción PDF y añade el reemplazo como texto PDF real en la misma zona. No depende de mapas `ToUnicode` de las fuentes originales.
- Procesamiento secuencial para lotes grandes.
- En Chrome/Edge de escritorio puede guardar directamente sobre los originales mediante File System Access API.
- Cuando se trabaja mediante selección normal, los resultados modificados se descargan individualmente o en ZIP para lotes.
- Los PDFs se procesan localmente y no se suben a un servidor.

## Verificación del cambio de texto

El motor comprueba que el texto antiguo haya desaparecido y que las nuevas apariciones esperadas del reemplazo estén presentes. Si la verificación falla, el archivo no se sobrescribe. En modo de escritura directa también se vuelve a comprobar el archivo ya guardado.

El motor usa MuPDF 1.28.0. Para el texto nuevo se usa una fuente Latin integrada y se codifican los caracteres compatibles con WinAnsi; caracteres fuera de ese conjunto se rechazan explícitamente en lugar de producir texto corrupto.

## Limitaciones

El cambio de texto no conserva necesariamente la fuente, tamaño, color, rotación o composición tipográfica exacta del texto original: reemplaza el área encontrada y coloca texto PDF nuevo en esa posición. La página no se convierte en imagen.

Si una marca ya forma parte del contenido gráfico de una página y no existe como anotación PDF independiente, la herramienta de comentarios no puede eliminarla sin reconstruir ese contenido.
