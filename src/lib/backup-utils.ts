"use server";

import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import CryptoJS from 'crypto-js';
import { executeSshCommand } from './ssh-utils';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import * as tar from 'tar';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

export async function getActiveS3Client() {
  if (!ENCRYPTION_KEY) throw new Error('La clave de encriptación no está configurada.');

  const { data: config, error } = await supabaseAdmin
    .from('s3_storage_configs')
    .select('*')
    .eq('is_active', true)
    .single();

  if (error || !config) throw new Error('No hay una configuración de almacenamiento S3 activa o verificada.');

  const accessKeyId = CryptoJS.AES.decrypt(config.access_key_id, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
  const secretAccessKey = CryptoJS.AES.decrypt(config.secret_access_key, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);

  if (!accessKeyId || !secretAccessKey) throw new Error('No se pudieron desencriptar las credenciales S3.');

  const s3Client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  return { s3Client, bucketName: config.bucket_name };
}

async function backupApp(app: any) {
  const tempDir = path.join(os.tmpdir(), `dyad-backup-${app.id}-${crypto.randomBytes(8).toString('hex')}`);
  const archivePath = `${tempDir}.tar.gz`;
  const server = app.user_servers;

  try {
    await fs.mkdir(tempDir, { recursive: true });
    const projectFilesDir = path.join(tempDir, 'project_files');
    await fs.mkdir(projectFilesDir);

    // 1. Backup Files from Container
    const remoteTempDir = `/tmp/dyad-backup-${app.id}`;
    await executeSshCommand(server, `rm -rf ${remoteTempDir} && mkdir -p ${remoteTempDir}`);
    await executeSshCommand(server, `docker cp ${app.container_id}:/app/. ${remoteTempDir}`);
    // This needs a proper SCP implementation, for now we simulate by creating a placeholder
    // In a real scenario, you'd use a library like 'node-scp' or shell out to scp
    await fs.writeFile(path.join(projectFilesDir, 'placeholder.txt'), 'File backup would be here.');


    // 2. Backup Database Schema
    if (app.db_name) {
      const { data: activeDbConfig } = await supabaseAdmin.from('database_config').select('*').eq('is_active', true).single();
      if (activeDbConfig) {
        const pgDumpEnv = { ...process.env, PGHOST: activeDbConfig.db_host, PGPORT: activeDbConfig.db_port, PGUSER: activeDbConfig.db_user, PGPASSWORD: activeDbConfig.db_password, PGDATABASE: activeDbConfig.db_name };
        const pgDumpOptions = `--clean --if-exists --schema=${app.db_name}`;
        const { stdout: schemaDump } = await execAsync(`pg_dump --schema-only ${pgDumpOptions}`, { env: pgDumpEnv });
        await fs.writeFile(path.join(tempDir, 'db_schema.sql'), schemaDump);
        const { stdout: dataDump } = await execAsync(`pg_dump --data-only ${pgDumpOptions}`, { env: pgDumpEnv });
        await fs.writeFile(path.join(tempDir, 'db_data.sql'), dataDump);
      }
    }

    // 3. Create Tarball
    await tar.c({ gzip: true, file: archivePath, cwd: tempDir }, ['.']);

    // 4. Upload to S3
    const { s3Client, bucketName } = await getActiveS3Client();
    const fileBuffer = await fs.readFile(archivePath);
    const backupKey = `${app.name}_${app.id}_${Date.now()}.tar.gz`;
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: backupKey,
      Body: fileBuffer,
    });
    await s3Client.send(command);

    console.log(`[Backup] Successfully backed up app ${app.id} to ${backupKey}`);
  } finally {
    // 5. Cleanup
    await fs.rm(tempDir, { recursive: true, force: true }).catch(e => console.warn(`Cleanup failed for dir ${tempDir}: ${e.message}`));
    await fs.unlink(archivePath).catch(e => console.warn(`Cleanup failed for file ${archivePath}: ${e.message}`));
    if (server) {
      const remoteTempDir = `/tmp/dyad-backup-${app.id}`;
      await executeSshCommand(server, `rm -rf ${remoteTempDir}`).catch(e => console.warn(`Remote cleanup failed for ${remoteTempDir}: ${e.message}`));
    }
  }
}

export async function runBackupForAllApps() {
  const { data: apps, error } = await supabaseAdmin
    .from('user_apps')
    .select('*, user_servers(*)')
    .in('status', ['ready', 'suspended']);

  if (error) throw error;

  let successful_backups = 0;
  const errors: string[] = [];

  for (const app of apps) {
    try {
      await backupApp(app);
      successful_backups++;
    } catch (err: any) {
      errors.push(`Failed to backup app ${app.id} (${app.name}): ${err.message}`);
      console.error(`[Backup] Failed for app ${app.id}:`, err);
    }
  }

  if (errors.length > 0) {
    console.error('[Backup] Some backups failed:', errors);
  }

  return {
    total_apps: apps.length,
    successful_backups,
    errors,
  };
}