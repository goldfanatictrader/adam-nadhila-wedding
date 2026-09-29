ALTER TABLE events ADD COLUMN purge_started_at INTEGER;
CREATE INDEX invoices_status ON invoices(status,created_at);
CREATE INDEX events_owner ON events(owner_id,created_at);
CREATE INDEX ai_budget ON ai_runs(created_at,status);
CREATE INDEX media_cleanup ON media_assets(status,created_at);
CREATE INDEX outbox_due ON outbox(status,next_at);
CREATE INDEX responses_feed ON responses(tenant_id,event_id,hidden,updated_at);
CREATE INDEX support_scope ON support_access(tenant_id,event_id,operator_id,expires_at);
CREATE INDEX event_versions ON content_versions(tenant_id,event_id,version);
