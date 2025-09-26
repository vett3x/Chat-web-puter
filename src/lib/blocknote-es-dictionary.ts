"use client";

import { type PartialBlockNoteDictionary } from "@blocknote/core";

// Un diccionario parcial con traducciones al español para los elementos más comunes de la interfaz de usuario.
export const esDictionary: PartialBlockNoteDictionary = {
  // La barra de herramientas de formato principal.
  formatting_toolbar: {
    bold: "Negrita",
    italic: "Cursiva",
    underline: "Subrayado",
    strikethrough: "Tachado",
    code: "Código",
    textColor: "Color de Texto",
    backgroundColor: "Color de Fondo",
    link: "Enlace",
    createLink: "Crear Enlace",
    editLink: "Editar Enlace",
    removeLink: "Quitar Enlace",
  },
  // El menú de comandos (slash menu).
  slash_menu: {
    // El texto del placeholder en el campo de búsqueda.
    searchInput: {
      placeholder: "Buscar bloques...",
    },
    // El título del bloque "sin resultados".
    noResults: {
      title: "Sin resultados",
    },
    // Títulos de los bloques por defecto.
    heading: {
      title: "Título 1",
    },
    heading2: {
      title: "Título 2",
    },
    heading3: {
      title: "Título 3",
    },
    paragraph: {
      title: "Párrafo",
    },
    bulletedList: {
      title: "Lista de Viñetas",
    },
    numberedList: {
      title: "Lista Numerada",
    },
    checkList: {
      title: "Lista de Tareas",
    },
    table: {
      title: "Tabla",
    },
    image: {
      title: "Imagen",
    },
    file: {
      title: "Archivo",
    },
    video: {
      title: "Video",
    },
    audio: {
      title: "Audio",
    },
    blockquote: {
      title: "Cita",
    },
    codeBlock: {
      title: "Bloque de Código",
    },
    alert: {
      title: "Alerta",
    },
  },
  // El bloque de placeholder.
  placeholders: {
    title: "Escribe '/' para ver comandos",
  },
  // El manejador para arrastrar.
  drag_handle: {
    tooltip: "Arrastra para reordenar",
  },
  // El menú del bloque.
  block_toolbar: {
    "Turn into": "Convertir en",
    "Delete": "Eliminar",
  },
  // El bloque de alerta.
  alert: {
    info: "Información",
    warning: "Advertencia",
    error: "Error",
    success: "Éxito",
  },
};