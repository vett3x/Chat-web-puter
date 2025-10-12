import { Button } from '@react-email/components';
import * as React from 'react';

interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
}

const EmailButton = ({ href, children }: EmailButtonProps) => {
  return (
    <Button
      className="bg-purple-600 rounded-md text-white text-base font-semibold no-underline text-center px-6 py-3"
      href={href}
    >
      {children}
    </Button>
  );
};

export default EmailButton;