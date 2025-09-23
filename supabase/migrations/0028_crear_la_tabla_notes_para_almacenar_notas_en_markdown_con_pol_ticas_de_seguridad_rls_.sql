-- Create the notes table
CREATE TABLE public.notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Nueva nota',
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Create policies for notes
CREATE POLICY "Users can view their own notes"
  ON public.notes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes"
  ON public.notes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON public.notes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON public.notes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Create a trigger to update the updated_at column
CREATE OR REPLACE FUNCTION handle_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_notes_updated
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION handle_notes_updated_at();