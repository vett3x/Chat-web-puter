import { Client as SshClient } from 'ssh2';

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

/**
 * Executes an SSH command on a remote server.
 * @param serverDetails Details for connecting to the SSH server.
 * @param command The command string to execute.
 * @returns A promise that resolves with the stdout, stderr, and exit code of the command.
 */
export async function executeSshCommand(
  serverDetails: ServerDetails,
  command: string
): Promise<SshCommandResult> {
  const conn = new SshClient();
  let stdout = '';
  let stderr = '';
  let exitCode = 1; // Default to non-zero exit code for errors

  console.log(`[SSH-UTIL] Attempting SSH connection to ${serverDetails.ssh_username}@${serverDetails.ip_address}:${serverDetails.ssh_port}`);
  console.log(`[SSH-UTIL] Command to execute: "${command}"`);

  try {
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', () => {
        console.log(`[SSH-UTIL] SSH connection ready for ${serverDetails.ip_address}.`);
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            console.error(`[SSH-UTIL] SSH exec error for command "${command}": ${err.message}`);
            return reject(new Error(`SSH exec error: ${err.message}`));
          }
          stream.on('data', (data: Buffer) => { stdout += data.toString(); });
          stream.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
          stream.on('close', (code: number) => {
            exitCode = code;
            console.log(`[SSH-UTIL] Command "${command}" exited with code ${code}.`);
            console.log(`[SSH-UTIL] STDOUT: ${stdout.trim()}`);
            console.log(`[SSH-UTIL] STDERR: ${stderr.trim()}`);
            resolve();
          });
        });
      }).on('error', (err) => {
        console.error(`[SSH-UTIL] SSH connection error to ${serverDetails.ip_address}: ${err.message}`);
        reject(new Error(`SSH connection error: ${err.message}`));
      }).connect({
        host: serverDetails.ip_address,
        port: serverDetails.ssh_port || 22,
        username: serverDetails.ssh_username,
        password: serverDetails.ssh_password,
        readyTimeout: 10000,
      });
    });
  } finally {
    conn.end();
    console.log(`[SSH-UTIL] SSH connection to ${serverDetails.ip_address} closed.`);
  }

  return { stdout, stderr, code: exitCode };
}

/**
 * Writes content to a file on the remote server via SSH.
 * @param serverDetails Details for connecting to the SSH server.
 * @param filePath The path to the file on the remote server.
 * @param content The content to write to the file.
 * @param mode The file permissions (e.g., '0600').
 */
export async function writeRemoteFile(
  serverDetails: ServerDetails,
  filePath: string,
  content: string,
  mode: string = '0600' // Keep as string for input, convert to number for sftp
): Promise<void> {
  const conn = new SshClient();
  try {
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', () => {
        conn.sftp((err, sftp) => {
          if (err) {
            conn.end();
            return reject(new Error(`SFTP error: ${err.message}`));
          }
          // Convert mode string (e.g., '0600') to an octal number (e.g., 0o600)
          const numericMode = parseInt(mode, 8);
          const writeStream = sftp.createWriteStream(filePath, { mode: numericMode });
          writeStream.write(content);
          writeStream.end();
          writeStream.on('finish', () => {
            sftp.end();
            resolve();
          });
          writeStream.on('error', (writeErr: Error) => { // Explicitly type writeErr as Error
            sftp.end();
            reject(new Error(`Error writing file to remote server: ${writeErr.message}`));
          });
        });
      }).on('error', (err) => {
        reject(new Error(`SSH connection error for file write: ${err.message}`));
      }).connect({
        host: serverDetails.ip_address,
        port: serverDetails.ssh_port || 22,
        username: serverDetails.ssh_username,
        password: serverDetails.ssh_password,
        readyTimeout: 10000,
      });
    });
  } finally {
    conn.end();
  }
}