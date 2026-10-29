-- ========================================================
-- EventLens (NovusGrid Event Photos) - Supabase Setup Script
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/galhrlewrwrqriathktr/sql/new
-- ========================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Photographers Table
CREATE TABLE IF NOT EXISTS public.photographers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supabase_user_id UUID UNIQUE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    google_oauth_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_photographers_email ON public.photographers (email);
CREATE INDEX IF NOT EXISTS ix_photographers_supabase_user_id ON public.photographers (supabase_user_id);

-- 3. Events Table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photographer_id UUID NOT NULL REFERENCES public.photographers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    drive_folder_id VARCHAR(255),
    source_type VARCHAR(50) NOT NULL DEFAULT 'direct',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_events_photographer_id ON public.events (photographer_id);
CREATE INDEX IF NOT EXISTS ix_events_slug ON public.events (slug);

-- 4. Photos Table
CREATE TABLE IF NOT EXISTS public.photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    drive_file_id VARCHAR(255) UNIQUE,
    drive_url TEXT,
    thumbnail_url TEXT,
    storage_provider VARCHAR(50) NOT NULL DEFAULT 'local',
    storage_key VARCHAR(512),
    thumbnail_key VARCHAR(512),
    filename VARCHAR(512) NOT NULL,
    file_size_bytes BIGINT,
    scene_description TEXT,
    ai_tags JSONB,
    quality_flags JSONB,
    processed_at TIMESTAMPTZ,
    processing_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_photos_event_id ON public.photos (event_id);
CREATE INDEX IF NOT EXISTS ix_photos_drive_file_id ON public.photos (drive_file_id);

-- 5. Face Embeddings Table (pgvector 512-dim cosine distance)
CREATE TABLE IF NOT EXISTS public.face_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photo_id UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
    embedding VECTOR(512) NOT NULL,
    face_box JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_face_embeddings_photo_id ON public.face_embeddings (photo_id);

-- Fast HNSW Cosine Index for Sub-second Face Match Queries
CREATE INDEX IF NOT EXISTS ix_face_embeddings_vector_hnsw 
ON public.face_embeddings 
USING hnsw (embedding vector_cosine_ops);

-- 6. Search Sessions Table (Guest audit log & consent tracking)
CREATE TABLE IF NOT EXISTS public.search_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    guest_name VARCHAR(255),
    guest_phone VARCHAR(50),
    guest_email VARCHAR(255),
    consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    match_count INT NOT NULL DEFAULT 0,
    searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_search_sessions_event_id ON public.search_sessions (event_id);

-- 7. Mark Alembic Migration Version as fully applied
CREATE TABLE IF NOT EXISTS public.alembic_version (
    version_num VARCHAR(32) NOT NULL PRIMARY KEY
);
DELETE FROM public.alembic_version;
INSERT INTO public.alembic_version (version_num) VALUES ('005');

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.photographers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_sessions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active event info for guests
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public can view active events" ON public.events;
    CREATE POLICY "Public can view active events" ON public.events
        FOR SELECT USING (status = 'active');

    DROP POLICY IF EXISTS "Service role full access on photographers" ON public.photographers;
    CREATE POLICY "Service role full access on photographers" ON public.photographers
        FOR ALL TO service_role USING (true);

    DROP POLICY IF EXISTS "Service role full access on events" ON public.events;
    CREATE POLICY "Service role full access on events" ON public.events
        FOR ALL TO service_role USING (true);

    DROP POLICY IF EXISTS "Service role full access on photos" ON public.photos;
    CREATE POLICY "Service role full access on photos" ON public.photos
        FOR ALL TO service_role USING (true);

    DROP POLICY IF EXISTS "Service role full access on face_embeddings" ON public.face_embeddings;
    CREATE POLICY "Service role full access on face_embeddings" ON public.face_embeddings
        FOR ALL TO service_role USING (true);

    DROP POLICY IF EXISTS "Service role full access on search_sessions" ON public.search_sessions;
    CREATE POLICY "Service role full access on search_sessions" ON public.search_sessions
        FOR ALL TO service_role USING (true);
END $$;
