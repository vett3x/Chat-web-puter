import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const execAsync = promisify(exec);

interface SshCommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

interface ServerDetails {
  ip_address: string;
  ssh_port: number;
  ssh_username: string;
  ssh_password?: string;
}

// Common SSH options to avoid interactive prompts and add a connection timeout
const SSH_OPTIONS = "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=30"; // Increased timeout to 30 seconds

/**
 * Executes an SSH command on a remote server using the native ssh client.
 * @param serverDetails Details for connecting to the SSH server.
 * @param command The command string to execute.
 * @returns A promise that resolves with the stdout, stderr, and exit code of the command.
 */
export async function executeSshCommand(
  serverDetails: ServerDetails,
  command: string
): Promise<SshCommandResult> {
  const sshCommand = `sshpass -p '${serverDetails.ssh_password}' ssh ${SSH_OPTIONS} -p ${serverDetails.ssh_port || 22} ${serverDetails.ssh_username}@${serverDetails.ip_address} "${command.replace(/"/g, '\\"')}"`;

  try {
    // Add a timeout to execAsync as a fallback for the entire operation
    const { stdout, stderr } = await execAsync(sshCommand, { timeout: 300000 }); // 5 minute timeout (was 15 seconds)
    return { stdout, stderr, code: 0 };
  } catch (error: any) {
    // If the error is a timeout error, provide a more specific message
    if (error.killed && error.signal === 'SIGTERM') {
      return {
        stdout: '',
        stderr: `Comando SSH excedió el tiempo de espera de 5 minutos. El servidor puede estar inaccesible o sobrecargado.`,
        code: 1,
      };
    }
    // execAsync rejects with an object that contains stdout and stderr
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      code: error.code || 1,
    };
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