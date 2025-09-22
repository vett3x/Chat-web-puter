export interface ServerResources {
  cpu_usage_percent: number;
  memory_used: string;
  memory_total: string;
  memory_used_mib: number; // New
  memory_total_mib: number; // New
  disk_usage_percent: number;
  timestamp: string;
}