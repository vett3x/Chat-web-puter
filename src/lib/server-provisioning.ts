"use server";

import { Client } from 'ssh2';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with the service role key
// This allows us to bypass RLS and update the server status from the backend.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DOCKER_INSTALL_SCRIPT = `
export DEBIAN_FRONTEND=noninteractive
echo "--- Starting Docker Installation ---"
# Update package list and install dependencies
apt-get update -y
apt-get install -y ca-certificates curl

# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# Add the Docker repository to Apt sources
echo \\
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \\
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \\
  tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y

# Install Docker Engine, CLI, and Containerd
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Install Docker Compose standalone
DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -oP '"tag_name": "\\K(v[0-9\\.]+)')
curl -L "https://github.com/docker/compose/releases/download/\${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify installations
echo "--- Docker Version ---"
docker --version
echo "--- Docker Compose Version ---"
docker-compose --version

# Pull ubuntu:latest Docker image
echo "--- Pulling ubuntu:latest Docker image ---"
docker pull ubuntu:latest

echo "--- Starting Node.js and npm Installation ---"
# Install Node.js (using NodeSource PPA for latest LTS)
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt-get install -y nodejs

# Verify Node.js and npm installations
echo "--- Node.js Version ---"
node -v
echo "--- npm Version ---"
npm -v

echo "--- Node.js Environment Setup Complete ---"

echo "--- Starting Cloudflared Installation ---"
# Update package list and install dependencies for cloudflared
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release

# Add Cloudflare's official GPG key using gpg --dearmor
mkdir -p /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-release.gpg | gpg --yes --dearmor -o /usr/share/keyrings/cloudflare-archive-keyring.gpg
chmod 644 /usr/share/keyrings/cloudflare-archive-keyring.gpg # Ensure correct permissions

# Add the Cloudflare repository to Apt sources
echo "deb [signed-by=/usr/share/keyrings/cloudflare-archive-keyring.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/cloudflared.list > /dev/null

# Update package list again and install cloudflared
apt-get update -y
apt-get install -y cloudflared

echo "--- Cloudflared Installation Complete ---"

echo "--- Provisioning Complete ---"
`;

async function updateServerLog(serverId: string, logChunk: string) {
  const { error } = await supabaseAdmin.rpc('append_to_provisioning_log', {
    server_id: serverId,
    log_content: logChunk,
  });
  if (error) {
    console.error(`[Provisioning] Error updating log for server ${serverId}:`, error);
  }
}

export async function provisionServer(server: {
  id: string;
  ip_address: string;
  ssh_port: number;
  ssh_username: string;
  ssh_password?: string;
}) {
  const { id, ip_address, ssh_port, ssh_username, ssh_password } = server;

  // 1. Set status to 'provisioning'
  await supabaseAdmin
    .from('user_servers')
    .update({ status: 'provisioning', provisioning_log: 'Starting provisioning...\n' })
    .eq('id', id);

  const conn = new Client();
  
  conn.on('ready', () => {
    updateServerLog(id, 'SSH connection successful. Executing install script...\n\n');
    
    conn.exec(DOCKER_INSTALL_SCRIPT, (err, stream) => {
      if (err) {
        console.error(`[Provisioning] SSH exec error for server ${id}:`, err);
        updateServerLog(id, `\nSSH execution error: ${err.message}\n`);
        supabaseAdmin
          .from('user_servers')
          .update({ status: 'failed' })
          .eq('id', id)
          .then();
        conn.end();
        return;
      }

      stream.on('close', async (code: number) => {
        if (code === 0) {
          await updateServerLog(id, '\nScript finished successfully.\n');
          await supabaseAdmin
            .from('user_servers')
            .update({ status: 'ready' })
            .eq('id', id);
        } else {
          await updateServerLog(id, `\nScript exited with error code: ${code}\n`);
          await supabaseAdmin
            .from('user_servers')
            .update({ status: 'failed' })
            .eq('id', id);
        }
        conn.end();
      }).on('data', (data: Buffer) => {
        updateServerLog(id, data.toString());
      }).stderr.on('data', (data: Buffer) => {
        updateServerLog(id, `STDERR: ${data.toString()}`);
      });
    });
  }).on('error', async (err) => {
    console.error(`[Provisioning] SSH connection error for server ${id}:`, err);
    await supabaseAdmin
      .from('user_servers')
      .update({
        status: 'failed',
        provisioning_log: `SSH connection failed: ${err.message}\nCheck IP address, port, and credentials. Ensure the server is reachable.`,
      })
      .eq('id', id);
  }).connect({
    host: ip_address,
    port: ssh_port,
    username: ssh_username,
    password: ssh_password,
    readyTimeout: 20000 // 20 seconds timeout for connection
  });
}