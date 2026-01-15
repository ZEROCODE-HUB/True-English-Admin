import { useRef, useCallback } from 'react';

/**
 * Hook para prevenir doble-clic rápido en botones.
 * Retorna una función wrapper que debe envolver el handler del onClick.
 * 
 * @param delayMs - Tiempo en milisegundos para permitir el siguiente clic (default: 300ms)
 * @returns Función wrapper para usar en onClick
 * 
 * @example
 * const preventDoubleClick = usePreventDoubleClick();
 * <Button onClick={preventDoubleClick(() => handleSave())} />
 */
export const usePreventDoubleClick = (delayMs: number = 300) => {
  const lastClickRef = useRef<number>(0);

  const handler = useCallback(
    (callback: () => void | Promise<void>) => {
      return async () => {
        const now = Date.now();
        if (now - lastClickRef.current < delayMs) {
          // Ignorar clic si ocurrió muy rápido
          return;
        }
        lastClickRef.current = now;
        try {
          await callback();
        } catch (err) {
          console.error('Error en handler:', err);
        }
      };
    },
    [delayMs]
  );

  return handler;
};
