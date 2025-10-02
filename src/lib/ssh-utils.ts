import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const execAsync = promisify(exec);

interface SshCommandResult<T extends 'utf8' | 'buffer'> {
  stdout: T extends 'utf8' ? string : Buffer;
  stderr: T extends 'utf8' ? string : Buffer;
  code: number;
}

interface ServerDetails {
  ip_address: string;
  ssh_port: number;
  ssh_username: string;
  ssh_password?: string;
}

const SSH_OPTIONS = "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=300";

// Overloaded function signature for better TypeScript type inference
export async function executeSshCommand(serverDetails: ServerDetails, command: string, options: { encoding: 'buffer' }): Promise<SshCommandResult<'buffer'>>;
export async function executeSshCommand(serverDetails: ServerDetails, command: string, options?: { encoding?: 'utf8' }): Promise<SshCommandResult<'utf8'>>;
export async function executeSshCommand(
  serverDetails: ServerDetails,
  command: string,
  options: { encoding?: 'utf8' | 'buffer' } = { encoding: 'utf8' }
): Promise<SshCommandResult<'utf8' | 'buffer'>> {
  const sshCommand = `sshpass -p '${serverDetails.ssh_password}' ssh ${SSH_OPTIONS} -p ${serverDetails.ssh_port || 22} ${serverDetails.ssh_username}@${serverDetails.ip_address} "${command.replace(/"/g, '\\"')}"`;

  const execOptions = {
    timeout: 300000,
    encoding: options.encoding,
    maxBuffer: 10 * 1024 * 1024, // 10 MB buffer for stdout
  };

  try {
    // The type assertion is safe because of the function overloads
    const { stdout, stderr } = await execAsync(sshCommand, execOptions as any);
    return { stdout, stderr, code: 0 };
  } catch (error: any) {
    const isBuffer = options.encoding === 'buffer';
    if (error.killed && error.signal === 'SIGTERM') {
      const stderrMessage = `Comando SSH excedió el tiempo de espera de 5 minutos. El servidor puede estar inaccesible o sobrecargado.`;
      return {
        stdout: isBuffer ? Buffer.from('') : '',
        stderr: isBuffer ? Buffer.from(stderrMessage) : stderrMessage,
        code: 1,
      } as SshCommandResult<'utf8' | 'buffer'>;
    }
    return {
      stdout: error.stdout || (isBuffer ? Buffer.from('') : ''),
      stderr: error.stderr || (isBuffer ? Buffer.from(error.message) : error.message),
      code: error.code || 1,
    } as SshCommandResult<'utf8' | 'buffer'>;
  }
}

/**
 * Transfers a local directory to a remote server using scp.
 * @param serverDetails Details for connecting to the SSH server.
 * @param localPath The local directory path to transfer.
 * @param remotePath The destination path on the remote server.
 */
export async function transferDirectoryScp(
  serverDetails: ServerDetails,
  localPath: string,
  remotePath: string
): Promise<void> {
  const scpCommand = `sshpass -p '${serverDetails.ssh_password}' scp ${SSH_OPTIONS} -r -P ${serverDetails.ssh_port || 22} '${localPath}' ${serverDetails.ssh_username}@${serverDetails.ip_address}:'${remotePath}'`;

  try {
    await execAsync(scpCommand, { timeout: 300000 }); // 5 minute timeout for file transfers (was 60 seconds)
  } catch (error: any) {
    if (error.killed && error.signal === 'SIGTERM') {
      throw new Error(`La transferencia de archivos excedió el tiempo de espera de 5 minutos.`);
    }
    throw new Error(`Failed to transfer directory via scp. Stderr: ${error.stderr || error.message}`);
  }
}

/**
 * Writes content to a file on the remote server by creating a temporary local file
 * and transferring it via scp.
 * @param serverDetails Details for connecting to the SSH server.
 * @param remoteFilePath The path to the file on the remote server.
 * @param content The content to write to the file.
 */
export async function writeRemoteFile(
  serverDetails: ServerDetails,
  remoteFilePath: string,
  content: string
): Promise<void> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dyad-scp-'));
  const localFilePath = path.join(tempDir, path.basename(remoteFilePath));

  try {
    await fs.writeFile(localFilePath, content);
    const scpCommand = `sshpass -p '${serverDetails.ssh_password}' scp ${SSH_OPTIONS} -P ${serverDetails.ssh_port || 22} '${localFilePath}' ${serverDetails.ssh_username}@${serverDetails.ip_address}:'${remoteFilePath}'`;
    await execAsync(scpCommand, { timeout: 300000 }); // 5 minute timeout for single file transfers (was 30 seconds)
  } catch (error: any) {
    // The error from execAsync will have code and stderr on failure
    if (error.killed && error.signal === 'SIGTERM') {
      throw new Error(`La escritura de archivo remoto excedió el tiempo de espera de 5 minutos.`);
    }
    if (error.code) {
      throw new Error(`scp failed with code ${error.code}: ${error.stderr}`);
    }
    // Handle other errors like fs.writeFile
    throw new Error(`Failed to write remote file via scp: ${error.message}`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}