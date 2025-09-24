export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Client as SshClient } from 'ssh2';
import { getAppAndServerForFileOps } from '@/lib/app-state-manager';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUserId() {
  const cookieStore = cookies() as any;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Acceso denegado.');
  return session.user.id;
}

export async function GET(req: NextRequest, context: any) {
  const appId = context.params.id;
  const conn = new SshClient();
  
  try {
    const userId = await getUserId();
    const { app, server } = await getAppAndServerForFileOps(appId, userId);
    
    const testResults = {
      appId,
      containerId: app.container_id,
      serverIp: server.ip_address,
      serverPort: server.ssh_port,
      username: server.ssh_username,
      steps: [] as any[],
    };
    
    // Test 1: SSH Connection
    testResults.steps.push({ step: 'SSH Connection', status: 'testing' });
    
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        conn.end();
        reject(new Error('SSH connection timeout (10s)'));
      }, 10000);
      
      conn.on('ready', () => {
        clearTimeout(timeout);
        testResults.steps[testResults.steps.length - 1].status = 'success';
        resolve();
      }).on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      }).connect({
        host: server.ip_address,
        port: server.ssh_port || 22,
        username: server.ssh_username,
        password: server.ssh_password,
        readyTimeout: 10000,
      });
    });
    
    // Test 2: Docker exec test
    testResults.steps.push({ step: 'Docker exec test', status: 'testing' });
    
    await new Promise<void>((resolve, reject) => {
      conn.exec(`docker exec ${app.container_id} echo "test"`, (err, stream) => {
        if (err) {
          testResults.steps[testResults.steps.length - 1].status = 'failed';
          testResults.steps[testResults.steps.length - 1].error = err.message;
          return reject(err);
        }
        
        let output = '';
        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });
        
        stream.on('close', (code: number) => {
          if (code === 0 && output.trim() === 'test') {
            testResults.steps[testResults.steps.length - 1].status = 'success';
            resolve();
          } else {
            testResults.steps[testResults.steps.length - 1].status = 'failed';
            testResults.steps[testResults.steps.length - 1].error = `Exit code: ${code}, Output: ${output}`;
            reject(new Error(`Docker exec failed with code ${code}`));
          }
        });
      });
    });
    
    // Test 3: SFTP Connection
    testResults.steps.push({ step: 'SFTP Connection', status: 'testing' });
    
    await new Promise<void>((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) {
          testResults.steps[testResults.steps.length - 1].status = 'failed';
          testResults.steps[testResults.steps.length - 1].error = err.message;
          return reject(err);
        }
        
        testResults.steps[testResults.steps.length - 1].status = 'success';
        
        // Test 4: Check container root path
        testResults.steps.push({ step: 'Container root path check', status: 'testing' });
        
        const containerRootPath = `/proc/${app.container_id}/root`;
        sftp.stat(containerRootPath, (statErr, stats) => {
          if (statErr) {
            testResults.steps[testResults.steps.length - 1].status = 'failed';
            testResults.steps[testResults.steps.length - 1].error = statErr.message;
            testResults.steps[testResults.steps.length - 1].path = containerRootPath;
          } else {
            testResults.steps[testResults.steps.length - 1].status = 'success';
            testResults.steps[testResults.steps.length - 1].isDirectory = stats.isDirectory();
          }
          
          sftp.end();
          resolve();
        });
      });
    });
    
    conn.end();
    
    return NextResponse.json({
      success: true,
      results: testResults,
    });
    
  } catch (error: any) {
    conn.end();
    return NextResponse.json({
      success: false,
      error: error.message,
      results: {
        error: error.message,
        stack: error.stack,
      },
    }, { status: 500 });
  }
}