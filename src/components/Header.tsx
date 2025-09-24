"use client";

import React from 'react';
import { Gamepad2 } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-gray-800 text-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Gamepad2 className="h-8 w-8 mr-2 text-purple-500" />
          <h1 className="text-2xl font-bold">Tienda Gamer</h1>
        </div>
        <nav className="hidden md:flex space-x-6">
          <a href="#" className="hover:text-purple-400 transition-colors">PC Gaming</a>
          <a href="#" className="hover:text-purple-400 transition-colors">Consolas</a>
          <a href="#" className="hover:text-purple-400 transition-colors">Periféricos</a>
          <a href="#" className="hover:text-purple-400 transition-colors">Componentes</a>
        </nav>
        <button className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition-colors">
          Contacto
        </button>
      </div>
    </header>
  );
}