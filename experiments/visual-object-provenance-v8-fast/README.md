# Visual Object Provenance Lab v8 FAST

Laboratorio independiente para atribución visual de objetos PDF.

## Objetivo

Reducir drásticamente el tiempo de análisis sin relajar la verificación final.

## Estrategia de dos fases

- Precalcula un render rápido con escala máxima 0.32.
- Análisis inicial: prueba hasta 120 grupos a baja resolución y re-verifica como máximo 28 candidatos a resolución completa.
- Resolución residual: rankea candidatos a baja resolución y solo los mejores pasan a verificación completa por ronda.
- Censo de explicabilidad: prueba hasta 72 hipótesis rápidas y re-verifica como máximo 18 en full.
- El mapa amarillo del censo solo representa hipótesis confirmadas a resolución completa.
- La salida PDF final sigue dependiendo de verificación completa y fail-closed.

## Seguridad

- No usa clasificación por familia de nube, color, lóbulos ni forma.
- Mantiene provenance exacto `streamIndex + byte span`.
- Paths cross-stream y páginas parser-inseguras siguen fallando cerrado.
- No está importado por `index.html` ni conectado a la URL pública.

El HTML ejecutable se mantiene como artefacto autónomo durante la fase de laboratorio; no se integra en producción hasta una autorización explícita posterior.
