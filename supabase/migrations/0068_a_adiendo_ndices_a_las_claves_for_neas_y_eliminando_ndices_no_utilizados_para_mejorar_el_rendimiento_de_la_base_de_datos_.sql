-- Remove unused index
DROP INDEX IF EXISTS public.idx_profiles_status;

-- Add missing indexes to foreign keys for performance
CREATE INDEX IF NOT EXISTS idx_ai_key_groups_user_id ON public.ai_key_groups (user_id);
CREATE INDEX IF NOT EXISTS idx_app_file_backups_user_id ON public.app_file_backups (user_id);
CREATE INDEX IF NOT EXISTS idx_app_versions_app_id ON public.app_versions (app_id);
CREATE INDEX IF NOT EXISTS idx_app_versions_user_id ON public.app_versions (user_id);
CREATE INDEX IF NOT EXISTS idx_cloudflare_domains_user_id ON public.cloudflare_domains (user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_folder_id ON public.conversations (folder_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_docker_tunnels_cloudflare_domain_id ON public.docker_tunnels (cloudflare_domain_id);
CREATE INDEX IF NOT EXISTS idx_docker_tunnels_user_id ON public.docker_tunnels (user_id);
CREATE INDEX IF NOT EXISTS idx_error_tickets_conversation_id ON public.error_tickets (conversation_id);
CREATE INDEX IF NOT EXISTS idx_error_tickets_user_id ON public.error_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders (parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages (user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_moderator_user_id ON public.moderation_logs (moderator_user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_target_user_id ON public.moderation_logs (target_user_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON public.notes (folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes (user_id);
CREATE INDEX IF NOT EXISTS idx_server_events_log_server_id ON public.server_events_log (server_id);
CREATE INDEX IF NOT EXISTS idx_server_events_log_user_id ON public.server_events_log (user_id);
CREATE INDEX IF NOT EXISTS idx_server_resource_logs_user_id ON public.server_resource_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_group_id ON public.user_api_keys (group_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON public.user_api_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_user_apps_conversation_id ON public.user_apps (conversation_id);
CREATE INDEX IF NOT EXISTS idx_user_apps_server_id ON public.user_apps (server_id);
CREATE INDEX IF NOT EXISTS idx_user_apps_tunnel_id ON public.user_apps (tunnel_id);
CREATE INDEX IF NOT EXISTS idx_user_apps_user_id ON public.user_apps (user_id);
CREATE INDEX IF NOT EXISTS idx_user_servers_user_id ON public.user_servers (user_id);