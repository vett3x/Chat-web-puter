"use client";

import React from 'react';

export default function Hero() {
  return (
    <section className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-extrabold mb-4">El Universo Gamer a tu Alcance</h1>
        <p className="text-xl text-gray-300 mb-8">
          Equipa tu setup con lo último en tecnología y domina el juego.
        </p>
        <button className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full text-lg transition-transform transform hover:scale-105">
          Explorar Productos
        </button>
      </div>
    </section>
  );
}