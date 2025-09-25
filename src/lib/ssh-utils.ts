import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';

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

// Common SSH options to avoid interactive prompts
const SSH_OPTIONS = "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null";

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
    const { stdout, stderr } = await execAsync(sshCommand);
    return { stdout, stderr, code: 0 };
  } catch (error: any) {
    // execAsync rejects with an object that contains stdout and stderr
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      code: error.code || 1,
    };
  }
}

/**
 * Writes content to a file on the remote server by creating a local temp file
 * and using the native scp client to transfer it.
 * @param serverDetails Details for connecting to the SSH server.
 * @param remoteFilePath The path to the file on the remote server.
 * @param content The content to write to the file.
 */
export async function writeRemoteFile(
  serverDetails: ServerDetails,
  remoteFilePath: string,
  content: string
): Promise<void> {
  const tempFileName = `dyad-upload-${randomBytes(16).toString('hex')}.tmp`;
  const localTempPath = path.join('/tmp', tempFileName);

  try {
    // 1. Write content to a temporary file on the local server (where this code runs)
    await fs.writeFile(localTempPath, content, 'utf8');

    // 2. Use scp to copy the local temporary file to the remote server
    const scpCommand = `sshpass -p '${serverDetails.ssh_password}' scp ${SSH_OPTIONS} -P ${serverDetails.ssh_port || 22} '${localTempPath}' '${serverDetails.ssh_username}@${serverDetails.ip_address}:${remoteFilePath}'`;
    
    const { stderr } = await execAsync(scpCommand);
    if (stderr) {
      // scp can sometimes write to stderr on success, so we check for common error keywords
      const lowerStderr = stderr.toLowerCase();
      if (lowerStderr.includes('error') || lowerStderr.includes('denied') || lowerStderr.includes('failed')) {
        throw new Error(`SCP error: ${stderr}`);
      }
    }
  } catch (error: any) {
    throw new Error(`Failed to write remote file: ${error.stderr || error.message}`);
  } finally {
    // 3. Clean up the local temporary file
    try {
      await fs.unlink(localTempPath);
    } catch (cleanupError) {
      console.warn(`Warning: Failed to clean up temporary file ${localTempPath}:`, cleanupError);
    }
  }
}