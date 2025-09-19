export interface DockerContainer {
  ID: string;
  Image: string;
  Command: string;
  CreatedAt: string;
  Ports: string;
  State: string;
  Status: string;
  Names: string;
  // Add any other fields you might need from `docker ps -a --format "{{json .}}"`
}