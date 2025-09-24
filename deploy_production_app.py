import paramiko
import time
import json
import base64
import uuid
import requests
import os
import random # Added for random.choice

# --- Configuration ---
# Replace with your actual server details
SERVER_IP = "your_server_ip_address"
SSH_USERNAME = "your_ssh_username"
SSH_PASSWORD = "your_ssh_password" # Or use SSH_KEY_PATH
SSH_PORT = 22
SSH_KEY_PATH = None # e.g., "/path/to/your/ssh/key.pem"

# Replace with your Supabase project details
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "https://juxrggowingqlchwfuct.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "YOUR_SUPABASE_SERVICE_ROLE_KEY") # IMPORTANT: Use your actual SERVICE_ROLE_KEY, NOT the anon key
USER_ID = "the_user_id_to_associate_with_this_server" # UUID of the user in your Supabase auth.users table

# Replace with your Cloudflare API details
CLOUDFLARE_API_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN", "YOUR_CLOUDFLARE_API_TOKEN")
CLOUDFLARE_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID", "YOUR_CLOUDFLARE_ACCOUNT_ID")
CLOUDFLARE_ZONE_ID = os.getenv("CLOUDFLARE_ZONE_ID", "YOUR_CLOUDFLARE_ZONE_ID")
CLOUDFLARE_DOMAIN_NAME = os.getenv("CLOUDFLARE_DOMAIN_NAME", "yourdomain.com") # The base domain you manage in Cloudflare

# --- Constants ---
DOCKER_INSTALL_SCRIPT = """
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
curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify installations
echo "--- Docker Version ---"
docker --version
echo "--- Docker Compose Version ---"
docker-compose --version

# Pull ubuntu:latest Docker image
echo "--- Pulling ubuntu:latest Docker image ---"
docker pull ubuntu:latest

echo "--- Host Provisioning Complete ---"
"""

DEFAULT_INSTALL_DEPS_SCRIPT_TEMPLATE = """
set -ex # -e: exit on error, -x: print commands and arguments as they are executed
export DEBIAN_FRONTEND=noninteractive

echo "--- Initial apt update... ---"
apt-get update -y || { echo "ERROR: initial apt-get update failed"; exit 1; }
echo "--- Initial apt update complete. ---"

echo "--- Installing sudo... ---"
apt-get install -y sudo || { echo "ERROR: sudo installation failed"; exit 1; }
echo "--- sudo installed. ---"

echo "--- Installing core dependencies (curl, gnupg, lsb-release, apt-utils, git)..."
sudo apt-get install -y curl gnupg lsb-release apt-utils git || { echo "ERROR: core dependencies installation failed"; exit 1; }
echo "--- Core dependencies installed. ---"

echo "--- Verifying Node.js and npm installation... ---"
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"
echo "--- Node.js and npm are pre-installed. ---"

echo "--- Installing cloudflared... ---"
# Add cloudflare gpg key
sudo mkdir -p --mode=0755 /usr/share/keyrings || { echo "ERROR: mkdir /usr/share/keyrings failed"; exit 1; }
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null || { echo "ERROR: adding cloudflare gpg key failed"; exit 1; }
chmod a+r /usr/share/keyrings/cloudflare-main.gpg # Ensure correct permissions

# Add this repo to your apt repositories
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null || { echo "ERROR: adding cloudflared repo failed"; exit 1; }

# install cloudflared
sudo apt-get update -y && sudo apt-get install -y cloudflared || { echo "ERROR: cloudflared installation failed"; exit 1; }

echo "--- Verifying cloudflared installation ---"
which cloudflared || { echo "ERROR: cloudflared binary not found in PATH"; exit 1; }
cloudflared --version || { echo "ERROR: cloudflared --version command failed"; exit 1; }
echo "--- cloudflared installed and verified. ---"

echo "--- Creating Next.js 'hello-world' app in /app directory... ---"
# Run as root, so no sudo needed here. Use --yes to skip prompts.
cd /
npx --yes create-next-app@latest app --use-npm --example "https://github.com/vercel/next.js/tree/canary/examples/hello-world" || { echo "ERROR: create-next-app failed"; exit 1; }
echo "--- Next.js app created. ---"

echo "--- Installing Next.js app dependencies... ---"
cd /app
npm install || { echo "ERROR: npm install failed"; exit 1; }
echo "--- Dependencies installed. ---"

echo "--- Starting Next.js dev server in the background... ---"
# Run the dev server in the background using nohup and redirect output
# The __CONTAINER_PORT__ placeholder will be replaced by the backend with the correct port.
nohup npm run dev -- --hostname 0.0.0.0 -p __CONTAINER_PORT__ > /app/dev.log 2>&1 &
echo "--- Next.js dev server started. Check /app/dev.log for output. ---"

echo "--- Container dependency installation complete ---"
"""

# --- Helper Functions ---

def execute_ssh_command(ssh_client, command, log_prefix=""):
    """Executes an SSH command and returns stdout, stderr, and exit code."""
    print(f"{log_prefix}Executing: {command}")
    stdin, stdout, stderr = ssh_client.exec_command(command)
    exit_code = stdout.channel.recv_exit_status()
    stdout_str = stdout.read().decode().strip()
    stderr_str = stderr.read().decode().strip()

    if stdout_str:
        print(f"{log_prefix}STDOUT:\n{stdout_str}")
    if stderr_str:
        print(f"{log_prefix}STDERR:\n{stderr_str}")
    print(f"{log_prefix}Exit Code: {exit_code}")

    return stdout_str, stderr_str, exit_code

def generate_random_port(min_port=49152, max_port=65535):
    """Generates a random port number."""
    return random.randint(min_port, max_port)

def generate_random_subdomain(length=15):
    """Generates a random subdomain."""
    characters = 'abcdefghijklmnopqrstuvwxyz0123456789'
    return ''.join(random.choice(characters) for i in range(length))

def call_cloudflare_api(method, path, api_token, account_id=None, zone_id=None, body=None):
    """Generic function to call Cloudflare API."""
    base_url = "https://api.cloudflare.com/client/v4"
    url = f"{base_url}{path}"

    headers = {
        'Authorization': f'Bearer {api_token}',
        'Content-Type': 'application/json',
    }

    response = requests.request(method, url, headers=headers, json=body)
    response.raise_for_status() # Raise an exception for HTTP errors

    data = response.json()
    if not data['success'] or data['errors']:
        error_messages = "; ".join([e['message'] for e in data['errors']]) if data['errors'] else "Unknown Cloudflare API error."
        raise Exception(f"Cloudflare API Error: {error_messages}")
    
    return data['result']

def create_cloudflare_tunnel_api(api_token, account_id, tunnel_name):
    """Creates a Cloudflare Tunnel via API."""
    path = f"/accounts/{account_id}/cfd_tunnel"
    body = {
        "name": tunnel_name,
        "config_src": "cloudflare",
    }
    result = call_cloudflare_api('POST', path, api_token, account_id=account_id, body=body)
    if not result or 'id' not in result or 'token' not in result:
        raise Exception('Failed to create tunnel or retrieve ID/token from Cloudflare API response.')
    return {"tunnel_id": result['id'], "tunnel_token": result['token']}

def configure_cloudflare_tunnel_ingress_api(api_token, account_id, tunnel_id, full_domain, container_port):
    """Configures ingress rules for a Cloudflare Tunnel via API."""
    path = f"/accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations"
    body = {
        "config": {
            "ingress": [
                {
                    "hostname": full_domain,
                    "service": f"http://localhost:{container_port}",
                    "originRequest": {
                        "noTLSVerify": True,
                    },
                },
                {"service": "http_status:404"},
            ],
        },
    }
    call_cloudflare_api('PUT', path, api_token, account_id=account_id, body=body)

def create_cloudflare_dns_record(api_token, zone_id, record_name, record_content, record_type='CNAME', proxied=True):
    """Creates a Cloudflare DNS record via API."""
    path = f"/zones/{zone_id}/dns_records"
    body = {
        "type": record_type,
        "name": record_name,
        "content": record_content,
        "proxied": proxied,
        "ttl": 1,
    }
    return call_cloudflare_api('POST', path, api_token, zone_id=zone_id, body=body)

def install_and_run_cloudflared_service(ssh_client, container_id, tunnel_id, tunnel_token):
    """Installs and runs cloudflared client inside a Docker container via SSH."""
    print(f"Installing and running cloudflared inside container {container_id[:12]}...")
    
    # The correct command to run the tunnel in the background and log its output
    run_command = f"nohup cloudflared tunnel run --token {tunnel_token} {tunnel_id} > /app/cloudflared.log 2>&1 &"
    
    # Execute the command inside the container
    _stdout, _stderr, exit_code = execute_ssh_command(ssh_client, f"docker exec {container_id} bash -c \"{run_command}\"")
    if exit_code != 0:
        raise Exception(f"Error running cloudflared service inside container: {_stderr}")
    print(f"Cloudflared service started successfully inside container {container_id[:12]}.")


# --- Main Provisioning Script ---

def provision_production_app():
    print("--- Starting Production App Provisioning ---")

    ssh_client = paramiko.SSHClient()
    ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        # 1. Connect to the server via SSH
        print(f"Connecting to {SSH_USERNAME}@{SERVER_IP}:{SSH_PORT}...")
        if SSH_KEY_PATH:
            ssh_client.connect(SERVER_IP, port=SSH_PORT, username=SSH_USERNAME, key_filename=SSH_KEY_PATH)
        else:
            ssh_client.connect(SERVER_IP, port=SSH_PORT, username=SSH_USERNAME, password=SSH_PASSWORD)
        print("SSH connection established.")

        # 2. Install Docker and Docker Compose on the host
        print("Installing Docker and Docker Compose on the host...")
        _stdout, _stderr, exit_code = execute_ssh_command(ssh_client, DOCKER_INSTALL_SCRIPT, log_prefix="[Docker Install] ")
        if exit_code != 0:
            raise Exception(f"Docker installation failed: {_stderr}")
        print("Docker and Docker Compose installed.")

        # 3. Register server in Supabase (if not already registered)
        print("Registering server in Supabase...")
        server_id = str(uuid.uuid4())
        
        # Check if server already exists for this user/IP
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/user_servers?ip_address=eq.{SERVER_IP}&user_id=eq.{USER_ID}&select=id",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
            }
        )
        response.raise_for_status()
        existing_servers = response.json()

        if existing_servers:
            server_id = existing_servers[0]['id']
            print(f"Server already registered with ID: {server_id}. Skipping insertion.")
        else:
            response = requests.post(
                f"{SUPABASE_URL}/rest/v1/user_servers",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                json={
                    "id": server_id,
                    "user_id": USER_ID,
                    "name": f"Production Server ({SERVER_IP})",
                    "ip_address": SERVER_IP,
                    "ssh_port": SSH_PORT,
                    "ssh_username": SSH_USERNAME,
                    "ssh_password": SSH_PASSWORD, # Store securely in production!
                    "status": "ready"
                }
            )
            response.raise_for_status()
            print(f"Server registered in Supabase with ID: {server_id}")

        # 4. Create a Docker container for the Next.js app
        print("Creating Docker container for Next.js app...")
        container_port = 3000
        host_port = generate_random_port()
        app_name = "my-production-nextjs-app" # You might want to make this dynamic
        container_name = f"app-{app_name.replace(' ', '-')}-{str(uuid.uuid4())[:8]}"

        run_command = f"docker run -d --name {container_name} -p {host_port}:{container_port} --entrypoint tail node:lts-bookworm -f /dev/null"
        stdout_container_id, _stderr, exit_code = execute_ssh_command(ssh_client, run_command, log_prefix="[Container Create] ")
        if exit_code != 0:
            raise Exception(f"Failed to create container: {_stderr}")
        container_id = stdout_container_id.strip()
        print(f"Docker container created with ID: {container_id}")

        # 5. Install dependencies and Next.js app inside the container
        print("Installing Next.js app and dependencies inside the container...")
        install_script = DEFAULT_INSTALL_DEPS_SCRIPT_TEMPLATE.replace("__CONTAINER_PORT__", str(container_port))
        encoded_script = base64.b64encode(install_script.encode()).decode()
        
        _stdout, _stderr, exit_code = execute_ssh_command(ssh_client, f"docker exec {container_id} bash -c \"echo '{encoded_script}' | base64 -d | bash\"", log_prefix="[Container Setup] ")
        if exit_code != 0:
            raise Exception(f"Failed to install dependencies in container: {_stderr}")
        print("Next.js app and dependencies installed in container.")

        # 6. Cloudflare Tunnel Setup
        print("Setting up Cloudflare Tunnel...")
        tunnel_name = f"tunnel-{container_id[:12]}"
        
        # Create Cloudflare Tunnel
        tunnel_info = create_cloudflare_tunnel_api(CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, tunnel_name)
        tunnel_id = tunnel_info['tunnel_id']
        tunnel_token = tunnel_info['tunnel_token']
        print(f"Cloudflare Tunnel created. ID: {tunnel_id}")

        # Generate subdomain and full domain
        subdomain = generate_random_subdomain()
        full_domain = f"{subdomain}.{CLOUDFLARE_DOMAIN_NAME}"
        print(f"Using full domain: {full_domain}")

        # Get or create cloudflare_domain_id in Supabase
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/cloudflare_domains?domain_name=eq.{CLOUDFLARE_DOMAIN_NAME}&user_id=eq.{USER_ID}&select=id",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
            }
        )
        response.raise_for_status()
        existing_cf_domains = response.json()

        cloudflare_domain_db_id = None
        if existing_cf_domains:
            cloudflare_domain_db_id = existing_cf_domains[0]['id']
            print(f"Cloudflare domain '{CLOUDFLARE_DOMAIN_NAME}' already registered in Supabase with ID: {cloudflare_domain_db_id}.")
        else:
            response = requests.post(
                f"{SUPABASE_URL}/rest/v1/cloudflare_domains",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                json={
                    "user_id": USER_ID,
                    "domain_name": CLOUDFLARE_DOMAIN_NAME,
                    "api_token": CLOUDFLARE_API_TOKEN, # Store securely in production!
                    "zone_id": CLOUDFLARE_ZONE_ID,
                    "account_id": CLOUDFLARE_ACCOUNT_ID
                }
            )
            response.raise_for_status()
            cloudflare_domain_db_id = response.json()[0]['id']
            print(f"Cloudflare domain '{CLOUDFLARE_DOMAIN_NAME}' registered in Supabase with ID: {cloudflare_domain_db_id}.")


        # Create DNS CNAME record
        dns_record = create_cloudflare_dns_record(CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, full_domain, f"{tunnel_id}.cfargotunnel.com")
        dns_record_id = dns_record['id']
        print(f"DNS CNAME record created. ID: {dns_record_id}")

        # Configure Ingress Rules
        configure_cloudflare_tunnel_ingress_api(CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, tunnel_id, full_domain, container_port)
        print("Ingress rules configured.")

        # Store tunnel details in Supabase
        tunnel_record_id = str(uuid.uuid4())
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/docker_tunnels",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            },
            json={
                "id": tunnel_record_id,
                "user_id": USER_ID,
                "server_id": server_id,
                "container_id": container_id,
                "cloudflare_domain_id": cloudflare_domain_db_id,
                "subdomain": subdomain,
                "full_domain": full_domain,
                "container_port": container_port,
                "host_port": host_port,
                "tunnel_id": tunnel_id,
                "tunnel_secret": tunnel_token,
                "status": "active"
            }
        )
        response.raise_for_status()
        print(f"Tunnel details stored in Supabase with ID: {tunnel_record_id}")

        # Install and run cloudflared client inside container
        install_and_run_cloudflared_service(ssh_client, container_id, tunnel_id, tunnel_token)
        print("Cloudflared client installed and running in container.")

        print(f"--- App Provisioning Complete! ---")
        print(f"Your app should be accessible at: https://{full_domain}")

    except paramiko.AuthenticationException:
        print("Authentication failed, please verify your credentials.")
    except paramiko.SSHException as e:
        print(f"SSH connection error: {e}")
    except requests.exceptions.RequestException as e:
        print(f"API request failed: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
    finally:
        ssh_client.close()
        print("SSH connection closed.")

if __name__ == "__main__":
    provision_production_app()