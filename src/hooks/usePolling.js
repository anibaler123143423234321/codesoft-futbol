import { useEffect, useRef } from 'react';

/**
 * Ejecuta `task` cada `everyMs` mientras la pestaña está visible.
 *
 * - Corre de inmediato al montar y cada vez que cambia `key` (p. ej. otra liga u otro partido),
 *   aunque la pestaña esté oculta, para que el contenido esté listo al mirarla.
 * - Con la pestaña oculta los ticks no hacen nada.
 * - Al volver a la pestaña, solo vuelve a pedir datos si la última ejecución ya venció;
 *   así cambiar de pestaña rápido no dispara peticiones de más.
 * - Nunca superpone dos ejecuciones.
 * - `everyMs` en null (o `enabled` en false) detiene el sondeo.
 */
export function usePolling(task, everyMs, { key, enabled = true } = {}) {
  const taskRef = useRef(task);
  taskRef.current = task;
  const lastRunRef = useRef(0);
  const runningRef = useRef(false);

  const run = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    lastRunRef.current = Date.now();
    try {
      await taskRef.current();
    } finally {
      runningRef.current = false;
    }
  };

  // Primera ejecución y cada cambio de clave
  useEffect(() => {
    if (!enabled) return;
    run();
  }, [key, enabled]);

  // Ticks periódicos y actualización al volver a la pestaña
  useEffect(() => {
    if (!enabled || !everyMs) return;
    const isStale = () => Date.now() - lastRunRef.current >= everyMs;

    const tick = setInterval(() => {
      if (!document.hidden && isStale()) run();
    }, Math.min(everyMs, 5000));

    const onVisible = () => {
      if (!document.hidden && isStale()) run();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [everyMs, enabled]);
}
