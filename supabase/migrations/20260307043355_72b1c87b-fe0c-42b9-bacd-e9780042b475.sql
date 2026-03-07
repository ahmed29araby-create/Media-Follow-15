
-- The handle_new_user trigger runs as SECURITY DEFINER, but RLS INSERT policy requires auth.uid() = user_id
-- which won't work during the trigger context. We need to allow the trigger function to bypass RLS.
-- Drop the restrictive insert policy and create one that also allows the trigger function
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;

-- Allow authenticated users to insert their own profile (for manual cases)
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Also, the trigger function is SECURITY DEFINER which means it runs as the function owner (postgres)
-- and bypasses RLS by default for superuser. But to be safe, let's also allow anon role insert 
-- since during signup the trigger fires before the user is fully authenticated.
-- Actually, SECURITY DEFINER functions run as the owner which is typically a superuser that bypasses RLS.
-- So the trigger should work. Let's verify triggers exist.

-- Recreate triggers to make sure they exist (they may have been dropped during migration)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_files_updated_at ON public.files;
DROP TRIGGER IF EXISTS update_change_requests_updated_at ON public.change_requests;
DROP TRIGGER IF EXISTS update_admin_settings_updated_at ON public.admin_settings;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_change_requests_updated_at BEFORE UPDATE ON public.change_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_admin_settings_updated_at BEFORE UPDATE ON public.admin_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
