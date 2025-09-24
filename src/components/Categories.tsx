"use client";

import React from 'react';
import { Computer, Gamepad2, Headphones, Cpu } from 'lucide-react';

const categories = [
  {
    name: 'PC Gaming',
    description: 'Computadoras y componentes',
    icon: Computer,
    href: '/categorias/pc-gaming',
    color: 'purple-500',
  },
  {
    name: 'Consolas',
    description: 'PlayStation, Xbox, Nintendo',
    icon: Gamepad2,
    href: '/categorias/consolas',
    color: 'blue-500',
  },
  {
    name: 'Periféricos',
    description: 'Teclados, ratones, auriculares',
    icon: Headphones,
    href: '/categorias/perifericos',
    color: 'green-500',
  },
  {
    name: 'Componentes',
    description: 'GPU, CPU, RAM, SSD',
    icon: Cpu,
    href: '/categorias/componentes',
    color: 'red-500',
  },
];

export default function Categories() {
  return (
    <section className="py-16 bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white">Nuestras Categorías</h2>
          <p className="text-gray-400 text-lg">
            Encuentra exactamente lo que necesitas para tu setup gaming.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {categories.map((category) => (
            <div key={category.name} className="bg-gray-800 p-6 rounded-lg text-center hover:bg-gray-700 transition-colors">
              <category.icon className={`h-12 w-12 mx-auto mb-4 text-${category.color}`} />
              <h3 className="text-xl font-semibold text-white mb-2">{category.name}</h3>
              <p className="text-gray-400">{category.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}