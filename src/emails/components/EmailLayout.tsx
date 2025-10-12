import {
  Body,
  Container,
  Head,
  Heading,
  Html,
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

const EmailLayout = ({ preview, title, children }: EmailLayoutProps) => {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="bg-gray-100 my-auto mx-auto font-sans">
          <Container className="border border-solid border-gray-200 rounded my-10 mx-auto p-5 w-[465px] bg-white">
            <Section className="mt-8">
              <Heading className="text-black text-2xl font-normal text-center p-0 my-8 mx-0">
                DeepAI Coder
              </Heading>
            </Section>
            <Heading className="text-black text-xl font-normal text-center p-0 my-8 mx-0">
              {title}
            </Heading>
            {children}
            <Section className="text-center mt-10 text-gray-500 text-xs">
              <Text>&copy; {new Date().getFullYear()} DeepAI Coder. Todos los derechos reservados.</Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default EmailLayout;