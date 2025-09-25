"use client";

import React from 'react';

const APP_VERSION = "v0.4b Stable";
const BUILD_NUMBER = "666"; // Updated build number

export function VersionDisplay() {
  return (
    <div className="px-2 py-2 text-center text-xs text-sidebar-foreground/50">
      <p>
        Versión: <span className="font-semibold">{APP_VERSION}</span>
      </p>
      <p>
        Compilación: <span className="font-semibold">{BUILD_NUMBER}</span>
      </p>
    </div>
  );
}