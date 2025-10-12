import {
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import EmailLayout from './components/EmailLayout';
import EmailButton from './components/EmailButton';

interface ResetPasswordEmailProps {
  resetPasswordUrl?: string;
}

export const ResetPasswordEmail = ({ resetPasswordUrl = '{{ .ConfirmationURL }}' }: ResetPasswordEmailProps) => (
  <EmailLayout
    preview="Restablece tu contraseña de DeepAI Coder"
    title="Restablecer Contraseña"
  >
    <Text className="text-black text-sm leading-6">
      Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.
    </Text>
    <Text className="text-black text-sm leading-6">
      Haz clic en el botón de abajo para establecer una nueva contraseña. Este enlace es válido por 60 minutos.
    </Text>
    <Section className="text-center mt-8 mb-8">
      <EmailButton href={resetPasswordUrl}>
        Restablecer mi contraseña
      </EmailButton>
    </Section>
    <Text className="text-black text-sm leading-6">
      Si no solicitaste un restablecimiento de contraseña, por favor ignora este correo.
    </Text>
  </EmailLayout>
);

export default ResetPasswordEmail;