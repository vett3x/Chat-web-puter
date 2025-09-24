"use client";

import Categories from '@/components/Categories';
import Header from '@/components/Header';
import Hero from '@/components/Hero';

export default function Home() {
  return (
    <main className="bg-gray-900">
      <Header />
      <Hero />
      <Categories />
    </main>
  );
}