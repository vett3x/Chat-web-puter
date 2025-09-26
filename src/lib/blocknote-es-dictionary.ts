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
      subtext: "Encabezado de sección grande",
      aliases: ["h1", "encabezado grande", "encabezado de sección"],
      group: "Encabezados",
    },
    heading_2: {
      title: "Título 2",
      subtext: "Encabezado de subsección",
      aliases: ["h2", "subencabezado"],
      group: "Encabezados",
    },
    heading_3: {
      title: "Título 3",
      subtext: "Encabezado pequeño",
      aliases: ["h3", "encabezado pequeño"],
      group: "Encabezados",
    },
    heading_4: {
      title: "Título 4",
      subtext: "Encabezado muy pequeño",
      aliases: ["h4"],
      group: "Encabezados",
    },
    heading_5: {
      title: "Título 5",
      subtext: "Encabezado diminuto",
      aliases: ["h5"],
      group: "Encabezados",
    },
    heading_6: {
      title: "Título 6",
      subtext: "Encabezado minúsculo",
      aliases: ["h6"],
      group: "Encabezados",
    },
    toggle_heading: {
      title: "Título Plegable 1",
      subtext: "Crear un título que se puede plegar",
      aliases: ["toggle", "plegable"],
      group: "Encabezados",
    },
    toggle_heading_2: {
      title: "Título Plegable 2",
      subtext: "Crear un título de nivel 2 que se puede plegar",
      aliases: ["toggle h2", "plegable h2"],
      group: "Encabezados",
    },
    toggle_heading_3: {
      title: "Título Plegable 3",
      subtext: "Crear un título de nivel 3 que se puede plegar",
      aliases: ["toggle h3", "plegable h3"],
      group: "Encabezados",
    },
    paragraph: {
      title: "Párrafo",
      subtext: "Texto simple",
      aliases: ["p", "texto"],
      group: "Básico",
    },
    bullet_list: {
      title: "Lista de Viñetas",
      subtext: "Crear una lista simple",
      aliases: ["lista", "viñetas"],
      group: "Listas",
    },
    numbered_list: {
      title: "Lista Numerada",
      subtext: "Crear una lista con números",
      aliases: ["lista", "números"],
      group: "Listas",
    },
    check_list: {
      title: "Lista de Tareas",
      subtext: "Crear una lista de tareas pendientes",
      aliases: ["tareas", "check"],
      group: "Listas",
    },
    toggle_list: {
      title: "Lista Plegable",
      subtext: "Crear una lista de elementos que se pueden plegar",
      aliases: ["toggle list", "lista plegable"],
      group: "Listas",
    },
    table: {
      title: "Tabla",
      subtext: "Insertar una tabla",
      aliases: ["tabla", "grid"],
      group: "Media",
    },
    image: {
      title: "Imagen",
      subtext: "Subir una imagen",
      aliases: ["imagen", "foto"],
      group: "Media",
    },
    file: {
      title: "Archivo",
      subtext: "Subir un archivo",
      aliases: ["archivo", "documento"],
      group: "Media",
    },
    video: {
      title: "Video",
      subtext: "Insertar un video",
      aliases: ["video", "clip"],
      group: "Media",
    },
    audio: {
      title: "Audio",
      subtext: "Insertar un audio",
      aliases: ["audio", "sonido"],
      group: "Media",
    },
    quote: {
      title: "Cita",
      subtext: "Citar texto",
      aliases: ["cita", "quote", "blockquote"],
      group: "Básico",
    },
    code_block: {
      title: "Bloque de Código",
      subtext: "Insertar un bloque de código",
      aliases: ["código", "code"],
      group: "Básico",
    },
    alert: {
      title: "Alerta",
      subtext: "Insertar un bloque de alerta",
      aliases: ["alerta", "aviso"],
      group: "Básico",
    },
    horizontal_rule: {
      title: "Separador",
      subtext: "Insertar una línea horizontal",
      aliases: ["hr", "línea", "separador"],
      group: "Básico",
    },
    columns: {
      title: "Columnas",
      subtext: "Crear un diseño de columnas",
      aliases: ["columnas", "layout"],
      group: "Layout",
    },
    group: {
      title: "Grupo",
      subtext: "Agrupar bloques",
      aliases: ["grupo", "contenedor"],
      group: "Layout",
    },
    callout: {
      title: "Destacado",
      subtext: "Insertar un bloque de texto destacado",
      aliases: ["callout", "nota"],
      group: "Básico",
    },
    equation: {
      title: "Ecuación",
      subtext: "Insertar una ecuación matemática",
      aliases: ["ecuación", "math"],
      group: "Media",
    },
    mermaid: {
      title: "Diagrama Mermaid",
      subtext: "Insertar un diagrama Mermaid",
      aliases: ["mermaid", "diagrama"],
      group: "Media",
    },
    diagram: {
      title: "Diagrama",
      subtext: "Insertar un diagrama",
      aliases: ["diagrama", "flowchart"],
      group: "Media",
    },
    embed: {
      title: "Incrustar",
      subtext: "Incrustar contenido externo",
      aliases: ["embed", "iframe"],
      group: "Media",
    },
    divider: {
      title: "Divisor",
      subtext: "Insertar un divisor",
      aliases: ["divisor", "línea"],
      group: "Básico",
    },
    emoji: {
      title: "Emoji",
      subtext: "Insertar un emoji",
      aliases: ["emoji", "emoticono"],
      group: "Básico",
    },
    page_break: {
      title: "Salto de Página",
      subtext: "Insertar un salto de página",
      aliases: ["salto", "página"],
      group: "Básico",
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
    add_block_label: "Añadir bloque",
    drag_handle_label: "Arrastrar bloque",
  },
  table_handle: {
    tooltip: "Arrastra para mover la tabla",
    delete_menuitem: "Eliminar Tabla",
    colors_menuitem: "Colores de Tabla",
    header_row_menuitem: "Fila de Encabezado",
    header_column_menuitem: "Columna de Encabezado",
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
    add_block_button: "Añadir bloque",
  },
  file_blocks: {
    add_button_text: {
      file: "Añadir Archivo",
      image: "Añadir Imagen",
      video: "Añadir Video",
      audio: "Añadir Audio",
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
};