-- Optimizing RLS policies for performance and security

-- Part 1: Fix 'auth_rls_initplan' warnings by wrapping auth functions in (select ...)

-- Table: profiles
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT TO authenticated USING (((select auth.uid()) = id));
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE TO authenticated USING (((select auth.uid()) = id));
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy" ON public.profiles FOR DELETE TO authenticated USING (((select auth.uid()) = id));

-- Table: conversations
DROP POLICY IF EXISTS "conversations_select_policy" ON public.conversations;
CREATE POLICY "conversations_select_policy" ON public.conversations FOR SELECT TO authenticated USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "conversations_update_policy" ON public.conversations;
CREATE POLICY "conversations_update_policy" ON public.conversations FOR UPDATE TO authenticated USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "conversations_delete_policy" ON public.conversations;
CREATE POLICY "conversations_delete_policy" ON public.conversations FOR DELETE TO authenticated USING (((select auth.uid()) = user_id));

-- Table: messages
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
CREATE POLICY "messages_select_policy" ON public.messages FOR SELECT TO authenticated USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "messages_update_policy" ON public.messages;
CREATE POLICY "messages_update_policy" ON public.messages FOR UPDATE TO authenticated USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "messages_delete_policy" ON public.messages;
CREATE POLICY "messages_delete_policy" ON public.messages FOR DELETE TO authenticated USING (((select auth.uid()) = user_id));

-- Table: folders
DROP POLICY IF EXISTS "Folders can only be viewed by their owner" ON public.folders;
CREATE POLICY "Folders can only be viewed by their owner" ON public.folders FOR SELECT TO authenticated USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "Folders can only be updated by their owner" ON public.folders;
CREATE POLICY "Folders can only be updated by their owner" ON public.folders FOR UPDATE TO authenticated USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "Folders can only be deleted by their owner" ON public.folders;
CREATE POLICY "Folders can only be deleted by their owner" ON public.folders FOR DELETE TO authenticated USING (((select auth.uid()) = user_id));

-- Table: user_servers
DROP POLICY IF EXISTS "Allow authenticated users to select their own servers" ON public.user_servers;
CREATE POLICY "Allow authenticated users to select their own servers" ON public.user_servers FOR SELECT TO authenticated USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "Allow authenticated users to update their own servers" ON public.user_servers;
CREATE POLICY "Allow authenticated users to update their own servers" ON public.user_servers FOR UPDATE TO authenticated USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "Allow authenticated users to delete their own servers" ON public.user_servers;
CREATE POLICY "Allow authenticated users to delete their own servers" ON public.user_servers FOR DELETE TO authenticated USING (((select auth.uid()) = user_id));

-- Table: server_events_log
DROP POLICY IF EXISTS "Users can view their own server events" ON public.server_events_log;
CREATE POLICY "Users can view their own server events" ON public.server_events_log FOR SELECT TO authenticated USING (((select auth.uid()) = user_id));

-- Table: cloudflare_domains
DROP POLICY IF EXISTS "Users can view their own cloudflare domains" ON public.cloudflare_domains;
CREATE POLICY "Users can view their own cloudflare domains" ON public.cloudflare_domains FOR SELECT TO authenticated USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "Users can update their own cloudflare domains" ON public.cloudflare_domains;
CREATE POLICY "Users can update their own cloudflare domains" ON public.cloudflare_domains FOR UPDATE TO authenticated USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "Users can delete their own cloudflare domains" ON public.cloudflare_domains;
CREATE POLICY "Users can delete their own cloudflare domains" ON public.cloudflare_domains FOR DELETE TO authenticated USING (((select auth.uid()) = user_id));

-- Table: docker_tunnels
DROP POLICY IF EXISTS "Users can view their own docker tunnels" ON public.docker_tunnels;
CREATE POLICY "Users can view their own docker tunnels" ON public.docker_tunnels FOR SELECT TO authenticated USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "Users can update their own docker tunnels" ON public.docker_tunnels;
CREATE POLICY "Users can update their own docker tunnels" ON public.docker_tunnels FOR UPDATE TO authenticated USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "Users can delete their own docker tunnels" ON public.docker_tunnels;
CREATE POLICY "Users can delete their own docker tunnels" ON public.docker_tunnels FOR DELETE TO authenticated USING (((select auth.uid()) = user_id));

-- Table: server_resource_logs
DROP POLICY IF EXISTS "Users can view their own server resource logs" ON public.server_resource_logs;
CREATE POLICY "Users can view their own server resource logs" ON public.server_resource_logs FOR SELECT TO authenticated USING (((select auth.uid()) = user_id));

-- Table: user_apps
DROP POLICY IF EXISTS "Los usuarios solo pueden ver sus propias apps" ON public.user_apps;
CREATE POLICY "Los usuarios solo pueden ver sus propias apps" ON public.user_apps FOR SELECT TO authenticated USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "Los usuarios solo pueden actualizar sus propias apps" ON public.user_apps;
CREATE POLICY "Los usuarios solo pueden actualizar sus propias apps" ON public.user_apps FOR UPDATE TO authenticated USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "Los usuarios solo pueden eliminar sus propias apps" ON public.user_apps;
CREATE POLICY "Los usuarios solo pueden eliminar sus propias apps" ON public.user_apps FOR DELETE TO authenticated USING (((select auth.uid()) = user_id));

-- Table: app_file_backups
DROP POLICY IF EXISTS "Users can manage their own file backups" ON public.app_file_backups;
CREATE POLICY "Users can manage their own file backups" ON public.app_file_backups FOR ALL TO authenticated USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));

-- Table: notes
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
CREATE POLICY "Users can view their own notes" ON public.notes FOR SELECT TO authenticated USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
CREATE POLICY "Users can update their own notes" ON public.notes FOR UPDATE TO authenticated USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
CREATE POLICY "Users can delete their own notes" ON public.notes FOR DELETE TO authenticated USING (((select auth.uid()) = user_id));

-- Table: app_versions
DROP POLICY IF EXISTS "Users can manage their own app versions" ON public.app_versions;
CREATE POLICY "Users can manage their own app versions" ON public.app_versions FOR ALL TO authenticated USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));

-- Part 2: Fix 'multiple_permissive_policies' warnings by combining policies

-- Table: conversations (INSERT)
DROP POLICY IF EXISTS "conversations_insert_policy" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.conversations;
CREATE POLICY "conversations_insert_policy" ON public.conversations FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id));

-- Table: notes (INSERT)
DROP POLICY IF EXISTS "notes_insert_policy" ON public.notes;
DROP POLICY IF EXISTS "Users can insert their own notes" ON public.notes;
CREATE POLICY "notes_insert_policy" ON public.notes FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id));

-- Table: folders (INSERT)
DROP POLICY IF EXISTS "Folders can only be created by their owner" ON public.folders;
DROP POLICY IF EXISTS "Users can insert their own folders" ON public.folders;
CREATE POLICY "folders_insert_policy" ON public.folders FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id));

-- Table: messages (INSERT)
DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;
CREATE POLICY "messages_insert_policy" ON public.messages FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id));

-- Table: user_servers (INSERT)
DROP POLICY IF EXISTS "Allow authenticated users to insert their own servers" ON public.user_servers;
CREATE POLICY "user_servers_insert_policy" ON public.user_servers FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id));

-- Table: server_events_log (INSERT)
DROP POLICY IF EXISTS "Users can insert their own server events" ON public.server_events_log;
CREATE POLICY "server_events_log_insert_policy" ON public.server_events_log FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id));

-- Table: cloudflare_domains (INSERT)
DROP POLICY IF EXISTS "Users can insert their own cloudflare domains" ON public.cloudflare_domains;
CREATE POLICY "cloudflare_domains_insert_policy" ON public.cloudflare_domains FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id));

-- Table: docker_tunnels (INSERT)
DROP POLICY IF EXISTS "Users can insert their own docker tunnels" ON public.docker_tunnels;
CREATE POLICY "docker_tunnels_insert_policy" ON public.docker_tunnels FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id));

-- Table: user_apps (INSERT)
DROP POLICY IF EXISTS "Los usuarios solo pueden insertar sus propias apps" ON public.user_apps;
CREATE POLICY "user_apps_insert_policy" ON public.user_apps FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id));

-- Table: error_tickets (INSERT)
DROP POLICY IF EXISTS "Users can insert their own error tickets" ON public.error_tickets;
CREATE POLICY "error_tickets_insert_policy" ON public.error_tickets FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id));

-- Table: ai_key_groups (Combine policies)
DROP POLICY IF EXISTS "Super Admins can manage all AI key groups" ON public.ai_key_groups;
DROP POLICY IF EXISTS "Users can view their own AI key groups" ON public.ai_key_groups;
DROP POLICY IF EXISTS "Users can insert their own AI key groups" ON public.ai_key_groups;
DROP POLICY IF EXISTS "Users can update their own AI key groups" ON public.ai_key_groups;
DROP POLICY IF EXISTS "Users can delete their own AI key groups" ON public.ai_key_groups;
CREATE POLICY "ai_key_groups_combined_policy" ON public.ai_key_groups FOR ALL TO authenticated
USING (
    (get_user_role((select auth.uid())) = 'super_admin'::text) OR
    ((select auth.uid()) = user_id) OR
    (is_global = true)
)
WITH CHECK (
    (get_user_role((select auth.uid())) = 'super_admin'::text) OR
    ((select auth.uid()) = user_id)
);

-- Table: user_api_keys (Combine policies)
DROP POLICY IF EXISTS "Super Admins can manage all API keys" ON public.user_api_keys;
DROP POLICY IF EXISTS "Users can view their own API keys" ON public.user_api_keys;
DROP POLICY IF EXISTS "Users can insert their own API keys" ON public.user_api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON public.user_api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON public.user_api_keys;
CREATE POLICY "user_api_keys_combined_policy" ON public.user_api_keys FOR ALL TO authenticated
USING (
    (get_user_role((select auth.uid())) = 'super_admin'::text) OR
    ((select auth.uid()) = user_id) OR
    (is_global = true) OR
    (group_id IN ( SELECT g.id FROM public.ai_key_groups g WHERE g.user_id = (select auth.uid()) OR g.is_global = true ))
)
WITH CHECK (
    (get_user_role((select auth.uid())) = 'super_admin'::text) OR
    ((select auth.uid()) = user_id)
);

-- Table: allowed_commands (Remove redundant policy)
DROP POLICY IF EXISTS "Super admins can view allowed commands" ON public.allowed_commands;
-- The "Super admins can manage allowed commands" policy covers SELECT, so the view-only one is redundant.
-- Let's also optimize the remaining one.
DROP POLICY IF EXISTS "Super admins can manage allowed commands" ON public.allowed_commands;
CREATE POLICY "Super admins can manage allowed commands" ON public.allowed_commands FOR ALL TO authenticated
USING ((get_user_role((select auth.uid())) = 'super_admin'::text))
WITH CHECK ((get_user_role((select auth.uid())) = 'super_admin'::text));

-- Table: error_tickets (Optimize existing policies)
DROP POLICY IF EXISTS "Admins can view all error tickets" ON public.error_tickets;
CREATE POLICY "Admins can view all error tickets" ON public.error_tickets FOR SELECT TO authenticated USING ((get_user_role((select auth.uid())) = ANY (ARRAY['admin'::text, 'super_admin'::text])));
DROP POLICY IF EXISTS "Admins can update error tickets" ON public.error_tickets;
CREATE POLICY "Admins can update error tickets" ON public.error_tickets FOR UPDATE TO authenticated USING ((get_user_role((select auth.uid())) = ANY (ARRAY['admin'::text, 'super_admin'::text])));
DROP POLICY IF EXISTS "Admins can delete error tickets" ON public.error_tickets;
CREATE POLICY "Admins can delete error tickets" ON public.error_tickets FOR DELETE TO authenticated USING ((get_user_role((select auth.uid())) = ANY (ARRAY['admin'::text, 'super_admin'::text])));

-- Table: global_settings (Optimize existing policies)
DROP POLICY IF EXISTS "Super Admins can view global settings" ON public.global_settings;
CREATE POLICY "Super Admins can view global settings" ON public.global_settings FOR SELECT TO authenticated USING ((get_user_role((select auth.uid())) = 'super_admin'::text));
DROP POLICY IF EXISTS "Super Admins can update global settings" ON public.global_settings;
CREATE POLICY "Super Admins can update global settings" ON public.global_settings FOR UPDATE TO authenticated USING ((get_user_role((select auth.uid())) = 'super_admin'::text));

-- Table: moderation_logs (Optimize existing policies)
DROP POLICY IF EXISTS "Admins can view all moderation logs" ON public.moderation_logs;
CREATE POLICY "Admins can view all moderation logs" ON public.moderation_logs FOR SELECT TO authenticated USING (((get_user_role((select auth.uid())) = 'admin'::text) OR (get_user_role((select auth.uid())) = 'super_admin'::text)));

-- Table: database_config (Optimize existing policies)
DROP POLICY IF EXISTS "Super Admins can manage database config" ON public.database_config;
CREATE POLICY "Super Admins can manage database config" ON public.database_config FOR ALL TO authenticated
USING ((get_user_role((select auth.uid())) = 'super_admin'::text))
WITH CHECK ((get_user_role((select auth.uid())) = 'super_admin'::text));