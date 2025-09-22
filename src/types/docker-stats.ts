export interface DockerContainerStat {
  ID: string;
  Name: string;
  Image: string; // Added Image field
  'CPU %': string;
  'Mem Usage': string; // e.g., "10.0MiB / 1.936GiB"
  'Mem %': string;
  'Net I/O': string; // e.g., "1.23kB / 4.56kB"
  'Block I/O': string;
  PIDs: string;
  // Add server context
  serverId: string;
  serverName: string;
  serverIpAddress: string;
}