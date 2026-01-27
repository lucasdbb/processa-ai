-- Migration: Create calendar tables for Office API
-- Run this migration in Supabase SQL Editor

-- Create schema
CREATE SCHEMA IF NOT EXISTS office_api;

-- Google OAuth connections
CREATE TABLE office_api.google_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_google_connections_user_email UNIQUE (user_id, email)
);

-- Synced calendars
CREATE TABLE office_api.calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    google_connection_id UUID REFERENCES office_api.google_connections(id) ON DELETE CASCADE,
    google_calendar_id TEXT,
    name TEXT NOT NULL,
    color TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_synced BOOLEAN NOT NULL DEFAULT TRUE,
    sync_token TEXT,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_calendars_user_google UNIQUE (user_id, google_calendar_id)
);

-- Events (local + synced from Google)
CREATE TABLE office_api.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    calendar_id UUID REFERENCES office_api.calendars(id) ON DELETE SET NULL,
    google_event_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN NOT NULL DEFAULT FALSE,
    event_type TEXT NOT NULL DEFAULT 'other' CHECK (event_type IN ('audiencia', 'prazo', 'reuniao', 'other')),
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
    processo_id UUID,
    cliente_id UUID,
    color TEXT,
    reminder_minutes INTEGER[] DEFAULT ARRAY[15, 60],
    google_etag TEXT,
    source TEXT NOT NULL DEFAULT 'local' CHECK (source IN ('local', 'google')),
    sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending_sync', 'conflict')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Google webhook channels
CREATE TABLE office_api.webhook_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    calendar_id UUID NOT NULL REFERENCES office_api.calendars(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL UNIQUE,
    resource_id TEXT NOT NULL,
    expiration_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event reminders
CREATE TABLE office_api.event_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES office_api.events(id) ON DELETE CASCADE,
    remind_at TIMESTAMPTZ NOT NULL,
    channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'push', 'both')),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User notification preferences
CREATE TABLE office_api.user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    default_reminder_minutes INTEGER[] DEFAULT ARRAY[15, 60, 1440],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_events_user_start ON office_api.events(user_id, start_at);
CREATE INDEX idx_events_calendar ON office_api.events(calendar_id);
CREATE INDEX idx_events_google_id ON office_api.events(google_event_id) WHERE google_event_id IS NOT NULL;
CREATE INDEX idx_events_processo ON office_api.events(processo_id) WHERE processo_id IS NOT NULL;
CREATE INDEX idx_events_cliente ON office_api.events(cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX idx_events_sync_status ON office_api.events(sync_status) WHERE sync_status = 'pending_sync';
CREATE INDEX idx_calendars_user ON office_api.calendars(user_id);
CREATE INDEX idx_webhook_channels_expiration ON office_api.webhook_channels(expiration_at);
CREATE INDEX idx_event_reminders_remind_at ON office_api.event_reminders(remind_at) WHERE sent_at IS NULL;
CREATE INDEX idx_google_connections_user ON office_api.google_connections(user_id);

-- Row Level Security
ALTER TABLE office_api.google_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_api.calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_api.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_api.webhook_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_api.event_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_api.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
CREATE POLICY "Users can manage own connections" ON office_api.google_connections
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own calendars" ON office_api.calendars
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own events" ON office_api.events
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own webhook channels" ON office_api.webhook_channels
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own reminders" ON office_api.event_reminders
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own notification preferences" ON office_api.user_notification_preferences
    FOR ALL USING (auth.uid() = user_id);

-- Service role bypass (for backend operations)
CREATE POLICY "Service role can manage all connections" ON office_api.google_connections
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage all calendars" ON office_api.calendars
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage all events" ON office_api.events
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage all webhook channels" ON office_api.webhook_channels
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage all reminders" ON office_api.event_reminders
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage all notification preferences" ON office_api.user_notification_preferences
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION office_api.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_google_connections_updated_at
    BEFORE UPDATE ON office_api.google_connections
    FOR EACH ROW EXECUTE FUNCTION office_api.update_updated_at_column();

CREATE TRIGGER update_calendars_updated_at
    BEFORE UPDATE ON office_api.calendars
    FOR EACH ROW EXECUTE FUNCTION office_api.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON office_api.events
    FOR EACH ROW EXECUTE FUNCTION office_api.update_updated_at_column();

CREATE TRIGGER update_user_notification_preferences_updated_at
    BEFORE UPDATE ON office_api.user_notification_preferences
    FOR EACH ROW EXECUTE FUNCTION office_api.update_updated_at_column();
