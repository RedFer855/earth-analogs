## Submódulo

- ID: `SM-NN.N` (o "no aplica": documentación, configuración)
- Especificación: `contexto/35-modulos/M-NN-.../SM-NN.N-....md`

## Qué cambia

<!-- Qué comportamiento queda funcionando. -->

## Checklist

- [ ] La especificación está `aprobado` y sin preguntas abiertas.
- [ ] Unas 500 líneas de código o menos; nunca más de 3000 con pruebas (el CI lo revisa).
- [ ] Sin datos crudos pesados, secretos ni rutas absolutas.
- [ ] Cada dataset nuevo tiene su nota en `contexto/50-referencia/` con fuente, licencia y fecha.
- [ ] `contexto/` actualizado: nota de sesión y ficha si cambió un contrato.
- [ ] `node scripts/contexto/verificar.js` sin errores.
