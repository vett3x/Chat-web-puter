"use client";

import { useEffect } from 'react';

export function SuppressWarnings() {
  useEffect(() => {
    const originalWarn = console.warn;
    const warningToSuppress = "linkifyjs has already been initialized.";

    console.warn = function (...args) {
      if (typeof args[0] === 'string' && args[0].includes(warningToSuppress)) {
        return; // Suprime la advertencia específica
      }
      originalWarn.apply(console, args);
    };

    // Función de limpieza para restaurar el console.warn original cuando el componente se desmonte
    return () => {
      console.warn = originalWarn;
    };
  }, []); // El array vacío asegura que esto se ejecute solo una vez al montar

  return null; // Este componente no renderiza nada en la UI
}