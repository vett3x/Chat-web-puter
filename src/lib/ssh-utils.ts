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
 * Writes content to a file on the remote server by piping base64 encoded content
 * directly over SSH, avoiding local temp files and scp.
 * @param serverDetails Details for connecting to the SSH server.
 * @param remoteFilePath The path to the file on the remote server.
 * @param content The content to write to the file.
 */
export async function writeRemoteFile(
  serverDetails: ServerDetails,
  remoteFilePath: string,
  content: string
): Promise<void> {
  try {
    // 1. Base64 encode the content to ensure safe transfer of all characters
    const encodedContent = Buffer.from(content).toString('base64');

    // 2. Construct a command to decode and write the file on the remote server
    //    - `echo '${encodedContent}'`: Prints the base64 string.
    //    - `| base64 -d`: Pipes the string to the base64 command to decode it.
    //    - `> '${remoteFilePath}'`: Redirects the decoded output to the target file.
    const command = `echo '${encodedContent}' | base64 -d > '${remoteFilePath}'`;

    // 3. Execute the command via SSH
    const { stderr, code } = await executeSshCommand(serverDetails, command);

    if (code !== 0) {
      throw new Error(`Failed to write remote file. Exit code: ${code}. Stderr: ${stderr}`);
    }
  } catch (error: any) {
    throw new Error(`Failed to write remote file '${remoteFilePath}': ${error.message}`);
  }
}