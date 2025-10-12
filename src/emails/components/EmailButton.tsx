import { Button } from '@react-email/components';
import * as React from 'react';

interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
}

const EmailButton = ({ href, children }: EmailButtonProps) => {
  return (
    <Button
      className="bg-primary-light-purple rounded text-white text-sm font-semibold no-underline text-center px-5 py-3"
      href={href}
    >
      {children}
    </Button>
  );
};

export default EmailButton;