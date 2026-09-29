import { useEffect, useState } from 'react';
import AppShell from './AppShell';
import { Modal } from './Dashboard';
import { api } from '../lib/client';
import { rupiah, dateLabel } from '../lib/catalog';
export default function Admin({ name }: { name: string }) {
  const [grantEvent, setGrantEvent] = useState<any>(null);
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState('payments'),
    [selected, setSelected] = useState<any>(null),
    [page, setPage] = useState(1),
    [elevated, setElevated] = useState(false);
  async function load() {
    const r = await api(`/api/admin?page=${page}`);
    setData(r);
    setElevated(true);
  }
  useEffect(() => {
    load().catch(() => {});
  }, [page]);
  async function act(fn: () => Promise<unknown>, success = 'Perubahan tersimpan.') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      await load();
      setMessage(success);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Permintaan gagal.';
      setError(msg);
      if (msg.includes('Verifikasi ulang')) setElevated(false);
    } finally {
      setBusy(false);
    }
  }
  function elevate(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.currentTarget));
    act(async () => {
      await api('/api/admin/elevate', 'POST', d);
    }, 'Verifikasi berhasil. Akses sensitif berlaku 5 menit.');
  }
  return (
    <AppShell name={name} admin active="admin">
      <div className="page-intro">
        <span className="eyebrow">PLATFORM WORKSPACE</span>
        <h1 style={{ marginTop: 15 }}>CELEYO, dari balik layar.</h1>
        <p className="muted">Kelola pelanggan, pembayaran, dan kualitas setiap perayaan.</p>
      </div>
      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="message" role="status">
          {message}
        </p>
      )}
      {!elevated ? (
        <section className="panel" style={{ maxWidth: 520 }}>
          <h2>Verifikasi akses superadmin</h2>
          <p className="note">
            Aktifkan authenticator melalui{' '}
            <a className="link" href="/account">
              Akun & keamanan
            </a>
            , lalu masukkan password dan kode terkini.
          </p>
          <form method="post" className="stack" onSubmit={elevate}>
            <label>
              Password
              <input name="password" type="password" required autoComplete="current-password" />
            </label>
            <label>
              Kode authenticator
              <input
                name="code"
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
              />
            </label>
            <button className="btn" disabled={busy}>
              Verifikasi akses
            </button>
          </form>
        </section>
      ) : (
        data && (
          <>
            <div className="stats">
              {[
                ['Pembayaran diterima', rupiah(data.metrics.revenue)],
                ['Perlu diperiksa', data.metrics.reviews],
                ['Event aktif', data.metrics.active],
                ['Workspace klien', data.metrics.tenants],
              ].map(([label, value]) => (
                <div className="stat" key={label}>
                  <p>{label}</p>
                  <p className="value">{value}</p>
                </div>
              ))}
            </div>
            <div className="tabs" role="group" aria-label="Bagian administrasi">
              {[
                ['payments', 'Pembayaran'],
                ['events', 'Klien & event'],
                ['catalog', 'Katalog & harga'],
                ['settings', 'Rekening & operasional'],
                ['support', 'Jasa setup'],
                ['audit', 'Audit'],
              ].map(([key, label]) => (
                <button
                  className={tab === key ? 'active' : ''}
                  aria-pressed={tab === key}
                  key={key}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === 'payments' && (
              <section className="panel">
                <div className="between">
                  <h3>Rekonsiliasi pembayaran</h3>
                  <span className="note">Pendapatan hanya menghitung invoice paid.</span>
                </div>
                <div
                  className="table-wrap"
                  role="region"
                  aria-label="Daftar administrasi"
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>INVOICE / ACARA</th>
                        <th>TOTAL</th>
                        <th>STATUS</th>
                        <th>TINDAKAN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.invoices.map((i: any) => (
                        <tr key={i.id}>
                          <td>
                            <strong>{i.number}</strong>
                            <div className="note">
                              {i.title} · {i.kind}
                            </div>
                          </td>
                          <td>{rupiah(i.total)}</td>
                          <td>
                            <span className="badge">{i.status}</span>
                            {i.claim_at && (
                              <div className="note">
                                Diklaim {new Date(i.claim_at).toLocaleString('id-ID')}
                              </div>
                            )}
                          </td>
                          <td>
                            <button className="btn secondary small" onClick={() => setSelected(i)}>
                              Periksa
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager page={page} setPage={setPage} />
              </section>
            )}
            {tab === 'events' && (
              <section className="panel">
                <h3>Undangan & status akun</h3>
                {data.events.map((e: any) => (
                  <form
                    method="post"
                    className="form-grid"
                    key={e.id}
                    style={{ padding: '20px 0', borderBottom: '1px solid var(--line)' }}
                    onSubmit={(ev) => {
                      ev.preventDefault();
                      const d = Object.fromEntries(new FormData(ev.currentTarget));
                      act(() => api(`/api/admin/events/${e.id}`, 'POST', d));
                    }}
                  >
                    <div>
                      <strong>{e.title}</strong>
                      <p className="note">
                        {e.slug} · {e.plan || 'trial'} · {e.status}
                        <br />
                        Workspace: {e.tenant_status}
                      </p>
                    </div>
                    <label>
                      Status event
                      <select
                        name="status"
                        defaultValue={e.status === 'suspended' ? 'suspended' : 'draft'}
                      >
                        <option value="draft">Draf · publikasi tetap oleh klien</option>
                        <option value="suspended">Ditangguhkan</option>
                      </select>
                    </label>
                    <label>
                      Alasan tercatat
                      <input name="reason" required minLength={10} maxLength={500} />
                    </label>
                    <button className="btn secondary" style={{ alignSelf: 'end' }} disabled={busy}>
                      Simpan status event
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ alignSelf: 'end' }}
                      onClick={() => setGrantEvent(e)}
                    >
                      {e.plan ? 'Kompensasi layanan' : 'Grant pilot'}
                    </button>
                  </form>
                ))}
                <Pager page={page} setPage={setPage} />
              </section>
            )}
            {tab === 'catalog' && (
              <>
                <section className="panel">
                  <h3>Katalog template</h3>
                  <p className="note">
                    Perubahan metadata tidak mengubah renderer atau versi undangan yang telah
                    dipakai.
                  </p>
                  {data.templates.map((t: any) => (
                    <form
                      method="post"
                      className="form-grid"
                      key={t.id}
                      style={{ marginBottom: 25 }}
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        const d = new FormData(ev.currentTarget);
                        act(() =>
                          api('/api/admin/templates', 'PUT', {
                            id: t.id,
                            name: String(d.get('name')),
                            description: String(d.get('description')),
                            available: d.get('available') === 'on',
                          }),
                        );
                      }}
                    >
                      <label>
                        Nama template
                        <input name="name" defaultValue={t.name} maxLength={80} required />
                      </label>
                      <label>
                        Deskripsi
                        <input name="description" defaultValue={t.description} maxLength={500} />
                      </label>
                      <label className="check">
                        <input name="available" type="checkbox" defaultChecked={!!t.available} />
                        Tersedia untuk publikasi baru
                      </label>
                      <button className="btn secondary" disabled={busy}>
                        Simpan {t.id}
                      </button>
                    </form>
                  ))}
                </section>
                <section className="panel">
                  <h3>Versi harga baru</h3>
                  <p className="note">
                    Snapshot kontrak lama tetap berlaku. Edit harga/kuota dan terbitkan untuk
                    pembelian baru.
                  </p>
                  <form
                    method="post"
                    className="stack"
                    onSubmit={(ev) => {
                      ev.preventDefault();
                      const d = new FormData(ev.currentTarget);
                      const update = Object.fromEntries(
                        ['starter', 'premium', 'signature'].map((k) => [
                          k,
                          Object.fromEntries(
                            ['price', 'guests', 'photos', 'media', 'ai'].map((f) => [
                              f,
                              Number(d.get(`${k}.${f}`)),
                            ]),
                          ),
                        ]),
                      );
                      act(
                        () => api('/api/admin/prices', 'PUT', update),
                        'Versi harga diterbitkan untuk pembelian baru.',
                      );
                    }}
                  >
                    {Object.entries(data.prices.plans).map(([key, p]: any) => (
                      <fieldset
                        key={key}
                        style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 18 }}
                      >
                        <legend>{p.name}</legend>
                        <div className="form-grid">
                          {[
                            ['price', 'Harga rupiah'],
                            ['guests', 'Kuota tamu'],
                            ['photos', 'Kuota foto'],
                            ['media', 'Storage byte'],
                            ['ai', 'Bantuan AI'],
                          ].map(([field, label]) => (
                            <label key={field}>
                              {label}
                              <input
                                type="number"
                                name={`${key}.${field}`}
                                defaultValue={p[field]}
                                required
                                min={0}
                              />
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                    <button className="btn" disabled={busy}>
                      Terbitkan versi harga
                    </button>
                  </form>
                </section>
              </>
            )}
            {tab === 'settings' && (
              <>
                <section className="panel">
                  <h3>Rekening bisnis & WhatsApp billing</h3>
                  <p className="note">
                    Checkout ditutup sampai data ini valid. Rekening hadiah klien tidak digunakan
                    untuk pembayaran platform.
                  </p>
                  <form
                    method="post"
                    className="form-grid"
                    onSubmit={(ev) => {
                      ev.preventDefault();
                      const d = Object.fromEntries(new FormData(ev.currentTarget));
                      act(() => api('/api/admin/billing', 'PUT', d));
                    }}
                  >
                    {[
                      ['bank', 'Nama bank'],
                      ['number', 'Nomor rekening'],
                      ['holder', 'Pemilik rekening bisnis'],
                      ['whatsapp', 'WhatsApp billing · 628…'],
                      ['version', 'Versi instruksi'],
                    ].map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input name={key} defaultValue={data.business?.[key] || ''} required />
                      </label>
                    ))}
                    <label className="span-2">
                      Kebijakan refund yang berlaku
                      <textarea
                        name="refundPolicy"
                        defaultValue={data.business?.refundPolicy || ''}
                        minLength={20}
                        maxLength={3000}
                        required
                      />
                    </label>
                    <button className="btn" disabled={busy}>
                      Simpan instruksi pembayaran
                    </button>
                  </form>
                </section>
                <section className="panel">
                  <h3>Retensi billing & audit</h3>
                  <p className="note">
                    Tetapkan periode sesuai kebijakan bisnis sebelum peluncuran. Invoice yang masih
                    bermasalah tetap ditahan. Penghapusan billing hanya dilakukan setelah data acara
                    dihapus.
                  </p>
                  <form
                    method="post"
                    className="row"
                    onSubmit={(ev) => {
                      ev.preventDefault();
                      const days = Number(new FormData(ev.currentTarget).get('days'));
                      act(() => api('/api/admin/retention', 'PUT', { days }));
                    }}
                  >
                    <label style={{ flex: 1 }}>
                      Hari retensi
                      <input
                        name="days"
                        type="number"
                        min={30}
                        max={3650}
                        required
                        defaultValue={data.retentionDays || ''}
                      />
                    </label>
                    <button className="btn secondary" style={{ alignSelf: 'end' }} disabled={busy}>
                      Simpan retensi
                    </button>
                  </form>
                  <div className="separator" />
                  <h3>Operasional Compose</h3>
                  <p className="note">
                    Estimasi biaya 30 hari: US${(data.metrics.aiCost / 1000000).toFixed(4)}.
                    Kegagalan model tetap dihitung dalam biaya provider.
                  </p>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={data.aiDisabled}
                      onChange={(ev) =>
                        act(() => api('/api/admin/ai', 'PUT', { disabled: ev.target.checked }))
                      }
                    />
                    Matikan Compose sementara. Editor manual dan undangan tetap tersedia.
                  </label>
                </section>
              </>
            )}
            {tab === 'support' && (
              <section className="panel">
                <h3>Jasa setup</h3>
                {data.tickets.map((t: any) => (
                  <article
                    key={t.id}
                    style={{ padding: 20, borderBottom: '1px solid var(--line)' }}
                  >
                    <h3>{t.title}</h3>
                    <p className="note">
                      {t.status} · {t.revisions}/2 revisi · Izin sampai {dateLabel(t.access_until)}
                    </p>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{t.brief || 'Menunggu brief klien.'}</p>
                    <form
                      method="post"
                      className="stack"
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        const d = new FormData(ev.currentTarget);
                        act(async () => {
                          const result = await api(`/api/admin/tickets/${t.id}`, 'POST', {
                            action: String(d.get('action')),
                            reason: String(d.get('reason')),
                          });
                          if (d.get('action') === 'open')
                            window.location.href = `/app/${result.eventId}`;
                        });
                      }}
                    >
                      <label>
                        Alasan tindakan
                        <input name="reason" minLength={10} maxLength={500} required />
                      </label>
                      <div className="row">
                        <select name="action" aria-label="Tindakan dukungan" style={{ flex: 1 }}>
                          <option value="open">Buka draf · memerlukan izin klien</option>
                          <option value="revision">Catat satu putaran revisi</option>
                          <option value="complete">Selesaikan & cabut akses tim</option>
                        </select>
                        <button
                          className="btn secondary"
                          disabled={busy || t.status === 'completed'}
                        >
                          Jalankan
                        </button>
                      </div>
                    </form>
                  </article>
                ))}
              </section>
            )}
            {tab === 'audit' && (
              <section className="panel">
                <h3>Aktivitas terbaru</h3>
                <div
                  className="table-wrap"
                  role="region"
                  aria-label="Daftar administrasi"
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>WAKTU</th>
                        <th>TINDAKAN</th>
                        <th>AKTOR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.audit.map((r: any, i: number) => (
                        <tr key={i}>
                          <td>{new Date(r.created_at).toLocaleString('id-ID')}</td>
                          <td>{r.action}</td>
                          <td className="inline-code">{r.actor_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )
      )}
      {grantEvent && (
        <Modal
          title={grantEvent.plan ? 'Kompensasi layanan' : 'Grant pilot'}
          close={() => setGrantEvent(null)}
        >
          <p className="note">
            Grant untuk {grantEvent.title} dicatat pada audit dan tidak dihitung sebagai pendapatan.
            Publikasi tetap dilakukan klien. Selesaikan invoice terbuka terlebih dahulu.
          </p>
          <form
            method="post"
            className="stack"
            onSubmit={(ev) => {
              ev.preventDefault();
              const d = new FormData(ev.currentTarget);
              act(async () => {
                await api(`/api/admin/events/${grantEvent.id}/grant`, 'POST', {
                  ...(grantEvent.plan
                    ? { ai: Number(d.get('ai')), months: Number(d.get('months')) }
                    : { plan: String(d.get('plan')) }),
                  reason: String(d.get('reason')),
                });
                setGrantEvent(null);
              }, 'Grant tersimpan pada audit.');
            }}
          >
            {grantEvent.plan ? (
              <>
                <label>
                  Tambahan bantuan AI
                  <input name="ai" type="number" min={0} max={500} defaultValue={0} required />
                </label>
                <label>
                  Tambahan masa aktif (bulan)
                  <input name="months" type="number" min={0} max={12} defaultValue={0} required />
                </label>
              </>
            ) : (
              <label>
                Paket pilot
                <select name="plan">
                  <option value="starter">Starter</option>
                  <option value="premium">Premium</option>
                  <option value="signature">Signature</option>
                </select>
              </label>
            )}
            <label>
              Alasan grant
              <textarea name="reason" minLength={10} maxLength={1000} required />
            </label>
            <button className="btn" disabled={busy}>
              Simpan grant
            </button>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal title={selected.number} close={() => setSelected(null)}>
          <p>
            <strong>{rupiah(selected.total)}</strong> · {selected.status}
          </p>
          <p className="note">
            Pengirim: {selected.claim_name || 'Belum ada klaim'}
            <br />
            Waktu transfer diklaim:{' '}
            {selected.transfer_at ? new Date(selected.transfer_at).toLocaleString('id-ID') : '—'}
          </p>
          {!['paid', 'refunded'].includes(selected.status) ? (
            <>
              <form
                method="post"
                className="stack"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  const d = new FormData(ev.currentTarget);
                  act(async () => {
                    await api(`/api/admin/invoices/${selected.id}/approve`, 'POST', {
                      bankReference: String(d.get('reference')),
                      amount: Number(d.get('amount')),
                      transferredAt: new Date(String(d.get('time'))).getTime(),
                      whatsappReceived: d.get('whatsapp') === 'on',
                      expiredException: d.get('exception') === 'on',
                      note: String(d.get('note')),
                    });
                    setSelected(null);
                  }, 'Pembayaran diverifikasi dan hak paket diterapkan satu kali.');
                }}
              >
                <label>
                  Referensi unik mutasi bank
                  <input name="reference" required minLength={5} maxLength={200} />
                </label>
                <label>
                  Nominal dana benar-benar diterima
                  <input name="amount" type="number" required min={1} />
                </label>
                <label>
                  Waktu pada mutasi bank
                  <input name="time" type="datetime-local" required />
                </label>
                <label>
                  Catatan pemeriksaan
                  <textarea name="note" required minLength={10} maxLength={1000} />
                </label>
                <label className="check">
                  <input type="checkbox" name="whatsapp" required />
                  Saya sudah membaca konfirmasi WhatsApp dan mencocokkan dana pada mutasi bank.
                </label>
                <label className="check">
                  <input type="checkbox" name="exception" />
                  Pengecualian invoice expired/cancelled; alasan ada pada catatan.
                </label>
                <button className="btn" disabled={busy}>
                  Setujui pembayaran & aktifkan hak
                </button>
              </form>
              <div className="separator" />
              <form
                method="post"
                className="stack"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  const d = Object.fromEntries(new FormData(ev.currentTarget));
                  act(async () => {
                    await api(`/api/admin/invoices/${selected.id}/review`, 'POST', d);
                    setSelected(null);
                  });
                }}
              >
                <label>
                  Status pemeriksaan
                  <select name="status">
                    <option value="needs_clarification">Perlu klarifikasi</option>
                    <option value="pending_review">Menunggu pemeriksaan</option>
                    <option value="cancelled">Dibatalkan</option>
                  </select>
                </label>
                <label>
                  Penjelasan untuk klien
                  <textarea name="note" minLength={10} maxLength={500} required />
                </label>
                <button className="btn secondary" disabled={busy}>
                  Simpan hasil pemeriksaan
                </button>
              </form>
            </>
          ) : selected.status === 'paid' ? (
            <form
              method="post"
              className="stack"
              onSubmit={(ev) => {
                ev.preventDefault();
                const d = new FormData(ev.currentTarget);
                act(async () => {
                  await api(`/api/admin/invoices/${selected.id}/refund`, 'POST', {
                    amount: Number(d.get('amount')),
                    bankReference: String(d.get('reference')),
                    reason: String(d.get('reason')),
                  });
                  setSelected(null);
                }, 'Refund dicatat; event ditangguhkan untuk review hak.');
              }}
            >
              <p className="message">
                Catat hanya setelah pengembalian dana dilakukan dan diverifikasi di bank. Aplikasi
                tidak mentransfer dana. Event akan ditangguhkan untuk peninjauan hak.
              </p>
              <label>
                Nominal refund penuh
                <input name="amount" type="number" required />
              </label>
              <label>
                Referensi transfer pengembalian
                <input name="reference" minLength={5} required />
              </label>
              <label>
                Alasan & verifikasi
                <textarea name="reason" minLength={10} required />
              </label>
              <button className="btn danger" disabled={busy}>
                Catat refund terverifikasi
              </button>
            </form>
          ) : (
            <p>Pengembalian sudah dicatat.</p>
          )}
        </Modal>
      )}
    </AppShell>
  );
}
function Pager({ page, setPage }: { page: number; setPage: (p: number) => void }) {
  return (
    <div className="between" style={{ marginTop: 20 }}>
      <button
        className="btn secondary small"
        disabled={page === 1}
        onClick={() => setPage(page - 1)}
      >
        Sebelumnya
      </button>
      <span className="note">Halaman {page}</span>
      <button className="btn secondary small" onClick={() => setPage(page + 1)}>
        Berikutnya
      </button>
    </div>
  );
}
