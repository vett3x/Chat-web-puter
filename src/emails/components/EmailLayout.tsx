import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Tailwind,
} from '@react-email/components';
import * as React from 'react';

interface EmailLayoutProps {
  preview: string;
  title: string;
  children: React.ReactNode;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://juxrggowingqlchwfuct.supabase.co`
  : 'http://localhost:3000';

const EmailLayout = ({ preview, title, children }: EmailLayoutProps) => {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="max-w-xl mx-auto my-10 p-8 rounded-lg shadow-md bg-white">
            <Section className="text-center">
              <Img
                src={`${baseUrl}/logo.svg`}
                width="40"
                height="40"
                alt="DeepAI Coder Logo"
                className="mx-auto"
              />
              <Heading className="text-2xl font-bold text-gray-800 mt-4">
                {title}
              </Heading>
            </Section>
            {children}
            <Section className="text-center mt-10 text-gray-500 text-xs">
              <Text>
                Si tienes alguna pregunta, no dudes en contactar con nuestro equipo de soporte.
              </Text>
              <Text>&copy; {new Date().getFullYear()} DeepAI Coder. Todos los derechos reservados.</Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default EmailLayout;