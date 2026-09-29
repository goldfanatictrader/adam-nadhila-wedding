CREATE TABLE manual_grants (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, event_id TEXT NOT NULL, operator_id TEXT NOT NULL REFERENCES user(id),
 kind TEXT NOT NULL CHECK(kind IN ('pilot','compensation')), snapshot TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL,
 FOREIGN KEY(tenant_id,event_id) REFERENCES events(tenant_id,id)
);
CREATE INDEX manual_grants_event ON manual_grants(tenant_id,event_id,created_at);
