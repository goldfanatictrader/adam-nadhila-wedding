PRAGMA foreign_keys = ON;
CREATE TABLE operators (user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE);
CREATE TABLE tenants (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL UNIQUE REFERENCES user(id), trial_used INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')), created_at INTEGER NOT NULL);
CREATE TABLE events (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), owner_id TEXT NOT NULL REFERENCES user(id),
 slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, event_type TEXT NOT NULL DEFAULT 'wedding' CHECK(event_type='wedding'),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','suspended','deleted')),
 template_id TEXT NOT NULL, template_version INTEGER NOT NULL DEFAULT 1,
 draft TEXT NOT NULL CHECK(json_valid(draft)), published TEXT, version INTEGER NOT NULL DEFAULT 1, published_version INTEGER,
 plan TEXT, plan_snapshot TEXT, paid_at INTEGER, activated_at INTEGER, expires_at INTEGER, duration_months INTEGER NOT NULL DEFAULT 0,
 ai_used INTEGER NOT NULL DEFAULT 0 CHECK(ai_used>=0), ai_reserved INTEGER NOT NULL DEFAULT 0 CHECK(ai_reserved>=0), ai_credits INTEGER NOT NULL DEFAULT 3,
 media_limit INTEGER NOT NULL DEFAULT 25000000, photo_limit INTEGER NOT NULL DEFAULT 3, guest_limit INTEGER NOT NULL DEFAULT 0,
 trial_expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, responses_open INTEGER NOT NULL DEFAULT 1, deleted_at INTEGER,
 UNIQUE(tenant_id,id)
);
CREATE INDEX events_tenant ON events(tenant_id,created_at);
CREATE TABLE event_members (tenant_id TEXT NOT NULL, event_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES user(id), PRIMARY KEY(event_id,user_id), FOREIGN KEY(tenant_id,event_id) REFERENCES events(tenant_id,id) ON DELETE CASCADE);
CREATE TABLE content_versions (tenant_id TEXT NOT NULL, event_id TEXT NOT NULL, version INTEGER NOT NULL, content TEXT NOT NULL, actor_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(event_id,version), FOREIGN KEY(tenant_id,event_id) REFERENCES events(tenant_id,id) ON DELETE CASCADE);
CREATE TABLE media_assets (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, event_id TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE,
 filename TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL CHECK(size>0), kind TEXT NOT NULL CHECK(kind IN ('image','audio')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','deleting')), alt TEXT NOT NULL DEFAULT '', focal_x INTEGER NOT NULL DEFAULT 50, focal_y INTEGER NOT NULL DEFAULT 50,
 created_at INTEGER NOT NULL, UNIQUE(tenant_id,event_id,id), FOREIGN KEY(tenant_id,event_id) REFERENCES events(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX media_event ON media_assets(tenant_id,event_id);
CREATE TABLE media_refs (tenant_id TEXT NOT NULL,event_id TEXT NOT NULL,asset_id TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('draft','published')), PRIMARY KEY(event_id,asset_id,state), FOREIGN KEY(tenant_id,event_id,asset_id) REFERENCES media_assets(tenant_id,event_id,id));
CREATE TABLE guests (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, event_id TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', group_name TEXT NOT NULL DEFAULT '', max_party INTEGER NOT NULL DEFAULT 4 CHECK(max_party BETWEEN 1 AND 20),
 token_hash TEXT UNIQUE, token_cipher TEXT, token_version INTEGER NOT NULL DEFAULT 1, sent_at INTEGER, clicked_at INTEGER, opened_at INTEGER, created_at INTEGER NOT NULL,
 UNIQUE(tenant_id,event_id,id), FOREIGN KEY(tenant_id,event_id) REFERENCES events(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX guests_event ON guests(tenant_id,event_id,created_at);
CREATE TABLE guest_sessions (digest TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,event_id TEXT NOT NULL,guest_id TEXT NOT NULL,token_version INTEGER NOT NULL,expires_at INTEGER NOT NULL, FOREIGN KEY(tenant_id,event_id,guest_id) REFERENCES guests(tenant_id,event_id,id) ON DELETE CASCADE);
CREATE INDEX guest_sessions_event ON guest_sessions(event_id,expires_at);
CREATE TABLE responses (tenant_id TEXT NOT NULL,event_id TEXT NOT NULL,guest_id TEXT NOT NULL, attending INTEGER NOT NULL CHECK(attending IN (0,1)), party INTEGER NOT NULL CHECK(party BETWEEN 0 AND 20), message TEXT NOT NULL DEFAULT '', hidden INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1,updated_at INTEGER NOT NULL, PRIMARY KEY(event_id,guest_id), FOREIGN KEY(tenant_id,event_id,guest_id) REFERENCES guests(tenant_id,event_id,id) ON DELETE CASCADE);
CREATE TABLE invoices (
 id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, tenant_id TEXT NOT NULL,event_id TEXT NOT NULL,owner_id TEXT NOT NULL REFERENCES user(id),
 kind TEXT NOT NULL CHECK(kind IN ('package','upgrade','ai','extension','setup')), target_plan TEXT, from_plan TEXT,
 total INTEGER NOT NULL CHECK(total>0), snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),
 status TEXT NOT NULL DEFAULT 'pending_transfer' CHECK(status IN ('pending_transfer','pending_review','needs_clarification','paid','expired','cancelled','refunded')),
 claim_name TEXT, transfer_at INTEGER, claim_at INTEGER, review_note TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, paid_at INTEGER,
 FOREIGN KEY(tenant_id,event_id) REFERENCES events(tenant_id,id)
);
CREATE INDEX invoices_tenant ON invoices(tenant_id,event_id,created_at);
CREATE UNIQUE INDEX one_pending_purchase ON invoices(event_id,kind) WHERE status IN ('pending_transfer','pending_review','needs_clarification') AND kind IN ('package','upgrade');
CREATE TABLE payments (id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL UNIQUE REFERENCES invoices(id), bank_reference TEXT NOT NULL UNIQUE, received_amount INTEGER NOT NULL, whatsapp_received INTEGER NOT NULL CHECK(whatsapp_received=1), transferred_at INTEGER NOT NULL, reviewer_id TEXT NOT NULL REFERENCES user(id), note TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE grants (invoice_id TEXT PRIMARY KEY REFERENCES invoices(id), event_id TEXT NOT NULL REFERENCES events(id), kind TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE refunds (invoice_id TEXT PRIMARY KEY REFERENCES invoices(id), amount INTEGER NOT NULL,bank_reference TEXT NOT NULL UNIQUE,actor_id TEXT NOT NULL REFERENCES user(id),reason TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE setup_tickets (id TEXT PRIMARY KEY, invoice_id TEXT UNIQUE REFERENCES invoices(id),tenant_id TEXT NOT NULL,event_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'awaiting_brief',brief TEXT NOT NULL DEFAULT '', revisions INTEGER NOT NULL DEFAULT 0 CHECK(revisions BETWEEN 0 AND 2), access_until INTEGER, created_at INTEGER NOT NULL, FOREIGN KEY(tenant_id,event_id) REFERENCES events(tenant_id,id));
CREATE TABLE support_access (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,event_id TEXT NOT NULL,operator_id TEXT NOT NULL REFERENCES user(id),reason TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL, FOREIGN KEY(tenant_id,event_id) REFERENCES events(tenant_id,id));
CREATE TABLE ai_runs (id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,event_id TEXT NOT NULL,request_key TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('running','proposed','applied','failed')),draft_version INTEGER NOT NULL,prompt TEXT NOT NULL,proposal TEXT,reply TEXT,model TEXT NOT NULL,input_tokens INTEGER NOT NULL DEFAULT 0,output_tokens INTEGER NOT NULL DEFAULT 0,cost_micro_usd INTEGER NOT NULL DEFAULT 743,reserved_micro_usd INTEGER NOT NULL DEFAULT 743,created_at INTEGER NOT NULL, UNIQUE(event_id,request_key), FOREIGN KEY(tenant_id,event_id) REFERENCES events(tenant_id,id) ON DELETE CASCADE);
CREATE UNIQUE INDEX one_ai_run ON ai_runs(event_id) WHERE status='running';
CREATE TABLE settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE catalog_templates (id TEXT PRIMARY KEY,version INTEGER NOT NULL DEFAULT 1,available INTEGER NOT NULL DEFAULT 1,name TEXT NOT NULL,description TEXT NOT NULL);
INSERT INTO catalog_templates(id,name,description) VALUES ('minimal-ivory','Minimal Ivory','Sederhana, penuh makna.'),('botanical-bloom','Botanical Bloom','Biarkan cinta bertumbuh.'),('editorial-journey','Editorial Journey','Setiap bab, tentang kita.');
CREATE TABLE price_versions (id TEXT PRIMARY KEY,data TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL);
CREATE TABLE audit_events (id TEXT PRIMARY KEY,actor_id TEXT,tenant_id TEXT,event_id TEXT,action TEXT NOT NULL,detail TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX audit_created ON audit_events(created_at);
CREATE TABLE outbox (id TEXT PRIMARY KEY,recipient TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL,lease_until INTEGER,sent_at INTEGER);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE transaction_guards (id TEXT PRIMARY KEY,ok INTEGER NOT NULL CHECK(ok=1));
CREATE TABLE admin_elevations (session_id TEXT PRIMARY KEY REFERENCES session(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
ALTER TABLE events ADD COLUMN published_template_id TEXT;
ALTER TABLE media_assets ADD COLUMN checksum TEXT;
