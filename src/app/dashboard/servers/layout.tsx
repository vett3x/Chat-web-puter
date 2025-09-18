import React from 'react';

export default function ServersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full p-6 bg-background">
      {children}
    </div>
  );
}