import { NextResponse } from 'next/server';
import { setupWebSocketServer } from '@/lib/socket-server';

const PORT = 3001;
let wssInitialized = false;

export async function GET() {
  if (!wssInitialized) {
    try {
      // This will run only once
      setupWebSocketServer(PORT);
      wssInitialized = true;
      console.log('WebSocket server initialized via API route.');
    } catch (error: any) {
      console.error('Failed to initialize WebSocket server:', error);
      return NextResponse.json({
        status: 'error',
        message: 'Failed to initialize WebSocket server.',
        error: error.message,
      }, { status: 500 });
    }
  }

  return NextResponse.json({
    status: 'success',
    message: 'WebSocket server is running.',
    port: PORT,
  });
}