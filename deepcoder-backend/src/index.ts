import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config(); // Carga las variables de entorno desde .env

const app = express();
const PORT = process.env.PORT || 5000; // Puerto para el backend

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Permite solicitudes desde tu frontend
  credentials: true,
}));
app.use(express.json()); // Para parsear cuerpos de solicitud JSON

// Esquema de validación para añadir un servidor
const serverSchema = z.object({
  ip_address: z.string().ip({ message: 'Dirección IP inválida.' }),
  ssh_username: z.string().min(1, { message: 'El usuario SSH es requerido.' }),
  ssh_password: z.string().min(1, { message: 'La contraseña SSH es requerida.' }),
  name: z.string().optional(),
});

// Almacenamiento temporal de servidores (¡solo para desarrollo, no para producción!)
interface ServerConfig extends z.infer<typeof serverSchema> {
  id: string;
}
const registeredServers: ServerConfig[] = [];
let serverIdCounter = 1;

// Rutas API
app.get('/', (req, res) => {
  res.send('DeepCoder Backend está funcionando!');
});

// Endpoint para añadir un nuevo servidor
app.post('/servers', (req, res) => {
  try {
    const newServerData = serverSchema.parse(req.body);
    const newServer: ServerConfig = {
      id: `srv-${serverIdCounter++}`,
      ...newServerData,
    };
    registeredServers.push(newServer);
    console.log('Servidor añadido (simulado):', newServer.name || newServer.ip_address);
    res.status(201).json({ message: 'Servidor añadido correctamente (simulado).', server: { id: newServer.id, name: newServer.name, ip_address: newServer.ip_address } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Error de validación', errors: error.errors });
    }
    console.error('Error al añadir servidor:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// Endpoint para obtener la lista de servidores registrados (sin credenciales sensibles)
app.get('/servers', (req, res) => {
  const safeServers = registeredServers.map(({ id, name, ip_address }) => ({ id, name, ip_address }));
  res.status(200).json(safeServers);
});


// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`DeepCoder Backend escuchando en http://localhost:${PORT}`);
});