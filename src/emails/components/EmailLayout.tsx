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
  Markdown,
} from '@react-email/components';
import * as React from 'react';
import EmailButton from './EmailButton';

interface EmailLayoutProps {
  preview: string;
  title: string;
  content: string;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://juxrggowingqlchwfuct.supabase.co`
  : 'http://localhost:3000';

const EmailLayout = ({ preview, title, content }: EmailLayoutProps) => {
  const buttonRegex = /\[BUTTON:(.+)\]\((.+)\)/;
  const match = content.match(buttonRegex);

  return (
    <Html>
      <Head>
        <style>
          {`
            a {
              color: #6d28d9 !important;
              text-decoration: underline !important;
            }
          `}
        </style>
      </Head>
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
            
            {match ? (
              <>
                <Markdown
                  markdownCustomStyles={{
                    p: { color: '#374151', fontSize: '16px', lineHeight: '28px' },
                  }}
                >
                  {content.split(match[0])[0]}
                </Markdown>
                <Section className="text-center my-8">
                  <EmailButton href={match[2]}>{match[1]}</EmailButton>
                </Section>
                <Markdown
                  markdownCustomStyles={{
                    p: { color: '#374151', fontSize: '16px', lineHeight: '28px' },
                  }}
                >
                  {content.split(match[0])[1]}
                </Markdown>
              </>
            ) : (
              <Markdown
                markdownCustomStyles={{
                  p: { color: '#374151', fontSize: '16px', lineHeight: '28px' },
                }}
              >
                {content}
              </Markdown>
            )}

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