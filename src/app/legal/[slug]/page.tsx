import { createClient } from '@supabase/supabase-js';
import { LegalPageLayout } from '@/components/legal-page-layout';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { notFound } from 'next/navigation';

// This is a server component that fetches data directly
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getLegalDocument(slug: string) {
  const { data, error } = await supabaseAdmin
    .from('legal_documents')
    .select('title, content')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    return null;
  }
  return data;
}

export default async function LegalDocumentPage({ params }: { params: { slug: string } }) {
  const doc = await getLegalDocument(params.slug);

  if (!doc) {
    notFound();
  }

  return (
    <LegalPageLayout title={doc.title}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {doc.content || ''}
      </ReactMarkdown>
    </LegalPageLayout>
  );
}