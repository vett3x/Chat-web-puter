"use server";

import { createClient } from '@supabase/supabase-js';
import { executeSshCommand } from './ssh-utils'; // Import SSH utilities

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

# Removed Cloudflared installation from host provisioning
echo "--- Host Provisioning Complete ---"
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

  try {
    await updateServerLog(id, 'SSH connection successful. Executing install script...\n\n');
    
    const { stdout, stderr, code } = await executeSshCommand(server, DOCKER_INSTALL_SCRIPT);

    await updateServerLog(id, stdout); // Append stdout to log
    if (stderr) {
      await updateServerLog(id, `STDERR: ${stderr}`); // Append stderr to log
    }

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
  } catch (err: any) {
    console.error(`[Provisioning] SSH connection or execution error for server ${id}:`, err);
    await supabaseAdmin
      .from('user_servers')
      .update({
        status: 'failed',
        provisioning_log: `SSH connection or execution failed: ${err.message}\nCheck IP address, port, and credentials. Ensure the server is reachable.`,
      })
      .eq('id', id);
  }
}