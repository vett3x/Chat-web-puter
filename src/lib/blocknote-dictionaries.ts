"use client";

import { Dictionary } from "@blocknote/core";
import { esDictionary } from "./blocknote-es-dictionary";

// Puedes añadir más diccionarios aquí para otros idiomas
// Por ejemplo:
// import { enDictionary } from "./blocknote-en-dictionary";

export const dictionaries: { [key: string]: Dictionary } = {
  es: esDictionary,
  // en: enDictionary,
};

// Puedes exportar un idioma por defecto o una función para obtener un diccionario
export const getDictionary = (lang: string): Dictionary => {
  return dictionaries[lang] || esDictionary; // Fallback a español si el idioma no se encuentra
};