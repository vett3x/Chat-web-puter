"use client";

// Diccionario parcial en español para BlockNote
// Solo incluimos las traducciones más importantes para evitar conflictos de tipos
export const esDictionary = {
  // Barra de herramientas de formato
  formatting_toolbar: {
    bold: { tooltip: "Negrita" },
    italic: { tooltip: "Cursiva" },
    underline: { tooltip: "Subrayado" },
    strike: { tooltip: "Tachado" },
    code: { tooltip: "Código" },
    link: { tooltip: "Enlace" },
  },
  
  // Menú de comandos (slash menu)
  slash_menu: {
    heading: { title: "Título 1", subtext: "Encabezado grande", aliases: ["h1"], group: "Encabezados" },
    heading_2: { title: "Título 2", subtext: "Encabezado mediano", aliases: ["h2"], group: "Encabezados" },
    heading_3: { title: "Título 3", subtext: "Encabezado pequeño", aliases: ["h3"], group: "Encabezados" },
    paragraph: { title: "Párrafo", subtext: "Texto normal", aliases: ["p"], group: "Básico" },
    bullet_list: { title: "Lista con viñetas", subtext: "Lista simple", aliases: ["lista"], group: "Listas" },
    numbered_list: { title: "Lista numerada", subtext: "Lista con números", aliases: ["números"], group: "Listas" },
    check_list: { title: "Lista de tareas", subtext: "Lista con casillas", aliases: ["tareas"], group: "Listas" },
    table: { title: "Tabla", subtext: "Insertar tabla", aliases: ["tabla"], group: "Avanzado" },
    image: { title: "Imagen", subtext: "Subir imagen", aliases: ["img"], group: "Media" },
    code_block: { title: "Código", subtext: "Bloque de código", aliases: ["code"], group: "Avanzado" },
    quote: { title: "Cita", subtext: "Texto citado", aliases: ["cita"], group: "Básico" },
  },
  
  // Placeholders
  placeholders: {
    default: "Escribe '/' para ver comandos o empieza a escribir...",
  },
  
  // Genérico
  generic: {
    ctrl_shortcut: "Cmd",
  },
};