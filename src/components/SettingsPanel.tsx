import { useEffect, useState } from 'react';
import { api } from '../lib/client';
export default function SettingsPanel({
  event: e,
  busy,
  act,
  refresh,
}: {
  event: any;
  busy: boolean;
  act: (fn: () => Promise<unknown>, message?: string) => void;
  refresh: () => Promise<unknown>;
}) {
  const [editors, setEditors] = useState<any[]>([]),
    [versions, setVersions] = useState<any[]>([]),
    [tickets, setTickets] = useState<any[]>([]),
    [deleteName, setDeleteName] = useState('');
  const root = `/api/events/${e.id}`;
  async function load() {
    const [m, v, t] = await Promise.all([
      api(root + '/editors'),
      api(root + '/versions'),
      api(root + '/tickets'),
    ]);
    setEditors(m);
    setVersions(v);
    setTickets(t);
  }
  useEffect(() => {
    load().catch(() => {});
  }, [e.id]);
  return (
    <>
      <section className="panel">
        <h3>Kolaborator</h3>
        <p className="note">
          Signature menyediakan satu editor untuk undangan ini. Editor tidak memiliki akses
          pembayaran atau publikasi.
        </p>
        {editors.map((m) => (
          <div key={m.id} className="between">
            <span>
              {m.name} · {m.email}
            </span>
            <button
              className="btn secondary small"
              onClick={() =>
                act(async () => {
                  await api(root + `/editors/${m.id}`, 'DELETE');
                  await load();
                })
              }
            >
              Cabut akses
            </button>
          </div>
        ))}
        <form
          method="post"
          className="row"
          onSubmit={(ev) => {
            ev.preventDefault();
            const email = String(new FormData(ev.currentTarget).get('email'));
            act(async () => {
              await api(root + '/editors', 'POST', { email });
              await load();
            }, 'Editor ditambahkan.');
          }}
        >
          <label style={{ flex: 1 }}>
            Email akun yang sudah terverifikasi
            <input name="email" type="email" required />
          </label>
          <button
            className="btn secondary"
            style={{ alignSelf: 'end' }}
            disabled={busy || e.plan !== 'signature' || editors.length > 0}
          >
            Tambahkan editor
          </button>
        </form>
      </section>
      <section className="panel">
        <h3>Riwayat draf</h3>
        <p className="note">
          Pemulihan membuat versi draf baru; versi publik tetap sama sampai Anda memublikasikan
          lagi.
        </p>
        <form
          method="post"
          className="row"
          onSubmit={(ev) => {
            ev.preventDefault();
            const version = Number(new FormData(ev.currentTarget).get('version'));
            act(async () => {
              await api(root + '/undo', 'POST', { version, currentVersion: e.version });
              await refresh();
              await load();
            }, 'Draf dipulihkan.');
          }}
        >
          <select name="version" aria-label="Pilih versi draf" style={{ flex: 1 }}>
            {versions.map((v) => (
              <option key={v.version} value={v.version}>
                Versi {v.version} · {new Date(v.created_at).toLocaleString('id-ID')}
              </option>
            ))}
          </select>
          <button className="btn secondary" disabled={busy}>
            Pulihkan draf
          </button>
        </form>
      </section>
      {tickets.map((t) => (
        <section className="panel" key={t.id}>
          <h3>Jasa setup · {t.status}</h3>
          <p className="note">
            {t.revisions} dari 2 putaran revisi. Izin akses tim berlaku maksimum 7 hari dan dapat
            dicabut kapan saja.
          </p>
          <form
            method="post"
            className="stack"
            onSubmit={(ev) => {
              ev.preventDefault();
              const data = new FormData(ev.currentTarget);
              act(async () => {
                await api(root + `/tickets/${t.id}`, 'PUT', {
                  brief: String(data.get('brief')),
                  allowSupport: data.get('allow') === 'on',
                });
                await load();
              }, 'Brief dan izin tersimpan.');
            }}
          >
            <label>
              Brief pengerjaan
              <textarea name="brief" defaultValue={t.brief} maxLength={5000} />
            </label>
            <label className="check">
              <input
                name="allow"
                type="checkbox"
                defaultChecked={!!t.access_until && t.access_until > Date.now()}
              />
              Izinkan tim CELEYO mengedit draf undangan ini untuk jasa setup.
            </label>
            <button className="btn secondary" disabled={busy || t.status === 'completed'}>
              Simpan brief & izin
            </button>
          </form>
        </section>
      ))}
      <section className="panel">
        <h3>Data & publikasi</h3>
        <div className="row">
          <a className="btn secondary" href={root + '/export'} download="undangan-celeyo.json">
            Ekspor data undangan
          </a>
          <button
            className="btn secondary"
            disabled={busy || e.status !== 'published'}
            onClick={() =>
              act(async () => {
                await api(root + '/unpublish', 'POST', {});
                await refresh();
              }, 'Undangan kembali menjadi draf.')
            }
          >
            Hentikan publikasi
          </button>
        </div>
        <div className="separator" />
        <p className="note">
          Penghapusan menonaktifkan tautan saat ini dan menjadwalkan pembersihan data 30 hari
          kemudian. Pembayaran atau jasa yang belum selesai perlu diselesaikan dahulu.
        </p>
        <label>
          Ketik judul undangan untuk meminta penghapusan
          <input
            value={deleteName}
            onChange={(ev) => setDeleteName(ev.target.value)}
            placeholder={e.title}
          />
        </label>
        <button
          style={{ marginTop: 15 }}
          className="btn danger"
          disabled={busy || deleteName !== e.title}
          onClick={() =>
            act(async () => {
              await api(root, 'DELETE');
              window.location.href = '/app';
            })
          }
        >
          Hapus undangan
        </button>
      </section>
    </>
  );
}
