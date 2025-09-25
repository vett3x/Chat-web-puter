import { Client as SshClient, type ExecChannel, type SFTPStream } from 'ssh2'; // Import Client as value, others as types

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

  try {
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', () => {
        conn.exec(command, (err: Error | undefined, stream: ExecChannel) => { // Explicitly type err and stream
          if (err) {
            conn.end();
            return reject(new Error(`SSH exec error: ${err.message}`));
          }
          stream.on('data', (data: Buffer) => { stdout += data.toString(); });
          stream.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
          stream.on('close', (code: number) => {
            exitCode = code;
            resolve();
          });
        });
      }).on('error', (err: Error) => { // Explicitly type err
        reject(new Error(`SSH connection error: ${err.message}`));
      }).connect({
        host: serverDetails.ip_address,
        port: serverDetails.ssh_port || 22,
        username: serverDetails.ssh_username,
        password: serverDetails.ssh_password,
        readyTimeout: 10000, // 10 seconds timeout for connection
      });
    });
  } finally {
    conn.end();
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
        conn.sftp((err: Error | undefined, sftp: SFTPStream) => { // Explicitly type err and sftp
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
      }).on('error', (err: Error) => { // Explicitly type err
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