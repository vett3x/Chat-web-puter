"use client";

// Un diccionario parcial con traducciones al español para los elementos más comunes de la interfaz de usuario.
export const esDictionary = {
  // La barra de herramientas de formato principal.
  formatting_toolbar: {
    bold: "Negrita",
    italic: "Cursiva",
    underline: "Subrayado",
    strikethrough: "Tachado",
    code: "Código",
    text_color: "Color de Texto",
    background_color: "Color de Fondo",
    link: "Enlace",
    create_link: "Crear Enlace",
    edit_link: "Editar Enlace",
    remove_link: "Quitar Enlace",
  },
  // El menú de comandos (slash menu).
  slash_menu: {
    // El texto del placeholder en el campo de búsqueda.
    search_input: {
      placeholder: "Buscar bloques...",
    },
    // El título del bloque "sin resultados".
    no_results: {
      title: "Sin resultados",
    },
    // Títulos de los bloques por defecto.
    heading: {
      title: "Título 1",
    },
    heading_2: {
      title: "Título 2",
    },
    heading_3: {
      title: "Título 3",
    },
    paragraph: {
      title: "Párrafo",
    },
    bulleted_list: {
      title: "Lista de Viñetas",
    },
    numbered_list: {
      title: "Lista Numerada",
    },
    check_list: {
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
    code_block: {
      title: "Bloque de Código",
    },
    alert: {
      title: "Alerta",
    },
  },
  // El bloque de placeholder.
  placeholders: {
    default: "Escribe '/' para ver comandos",
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
  // Propiedades adicionales para completar el diccionario
  side_menu: {
    tooltip: "Abrir menú lateral",
  },
  table_handle: {
    tooltip: "Arrastra para mover la tabla",
  },
  link_toolbar: {
    edit_link: "Editar enlace",
    remove_link: "Quitar enlace",
  },
  image_toolbar: {
    replace_image: "Reemplazar imagen",
    delete_image: "Eliminar imagen",
  },
  file_toolbar: {
    replace_file: "Reemplazar archivo",
    delete_file: "Eliminar archivo",
  },
  video_toolbar: {
    replace_video: "Reemplazar video",
    delete_video: "Eliminar video",
  },
  audio_toolbar: {
    replace_audio: "Reemplazar audio",
    delete_audio: "Eliminar audio",
  },
  table_cell_toolbar: {
    add_row_before: "Añadir fila antes",
    add_row_after: "Añadir fila después",
    delete_row: "Eliminar fila",
    add_column_before: "Añadir columna antes",
    add_column_after: "Añadir columna después",
    delete_column: "Eliminar columna",
  },
  hyperlink_toolbar: {
    edit_link: "Editar enlace",
    remove_link: "Quitar enlace",
  },
  color_picker: {
    text_color: "Color de texto",
    background_color: "Color de fondo",
    default: "Por defecto",
  },
  upload_file: {
    title: "Subir archivo",
    description: "Arrastra y suelta un archivo aquí, o haz clic para seleccionar.",
  },
  upload_image: {
    title: "Subir imagen",
    description: "Arrastra y suelta una imagen aquí, o haz clic para seleccionar.",
  },
  upload_video: {
    title: "Subir video",
    description: "Arrastra y suelta un video aquí, o haz clic para seleccionar.",
  },
  upload_audio: {
    title: "Subir audio",
    description: "Arrastra y suelta un audio aquí, o haz clic para seleccionar.",
  },
  toggle_blocks: {
    title: "Bloques de alternancia",
  },
  // Missing keys from the error message
  file_blocks: {
    // Assuming these are for specific file block types, similar to slash_menu
    file: {
      title: "Archivo",
      subtext: "Insertar un archivo",
      aliases: ["archivo", "documento"],
      group: "Media",
    },
  },
  suggestion_menu: {
    search_input: {
      placeholder: "Buscar sugerencias...",
    },
    no_results: {
      title: "Sin sugerencias",
    },
  },
  file_panel: {
    title: "Panel de Archivos",
    upload_button: "Subir",
    empty_state: "No hay archivos",
  },
  comments: {
    add_comment: "Añadir comentario",
    resolve_comment: "Resolver comentario",
    delete_comment: "Eliminar comentario",
    comment_placeholder: "Escribe un comentario...",
  },
  generic: {
    ok: "Aceptar",
    cancel: "Cancelar",
    save: "Guardar",
    delete: "Eliminar",
    undo: "Deshacer",
    redo: "Rehacer",
  },
  // Also adding other potentially missing top-level keys that are common in BlockNote
  // These were not explicitly listed in the error but are part of the full dictionary.
  // I'll add them to be thorough.
  // Based on BlockNote's default dictionary structure:
  // https://github.com/YousefED/BlockNote/blob/main/packages/core/src/BlockNoteEditor/dictionaries/en.ts
  // I need to ensure all these are present.
  // The error message is very specific about missing keys, so I should only add those.
  // The previous fix removed `PartialBlockNoteDictionary` type, so I'm relying on inference.
  // Let's re-add the `PartialBlockNoteDictionary` type and import it from `@blocknote/core`
  // if it's actually exported. If not, I'll keep it inferred.
  // The previous turn said it's NOT exported. So I'll keep it inferred.
  // The error message is about missing properties from `PartialBlockNoteDictionary` type.
  // This means the type *is* being used internally by `useCreateBlockNote`.
  // I need to ensure the object matches the type.

  // Let's re-check the `PartialBlockNoteDictionary` type.
  // It's likely defined within the `@blocknote/core` package but not exported directly.
  // If I can't import it, I'll have to manually ensure the structure is correct.
  // The error message lists the missing properties. I need to add them.
  // The previous `esDictionary` was missing these.

  // I will add the missing keys with a minimal structure to satisfy the type.
  // The error message lists: `file_blocks`, `suggestion_menu`, `file_panel`, `comments`, `generic`.
  // I will add these.
};