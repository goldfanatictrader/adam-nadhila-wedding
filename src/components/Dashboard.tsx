import { useEffect, useRef, useState } from 'react';
import {
  Plus,
  ArrowUpRight,
  ArrowLeft,
  Mail,
  Users,
  Image,
  Wallet,
  Sparkles,
  Settings,
  Paintbrush,
  Check,
  Copy,
  Eye,
  Download,
  RefreshCw,
  X,
  CalendarDays,
} from 'lucide-react';
import AppShell from './AppShell';
import Modal from './ui/Modal';
export { default as Modal } from './ui/Modal';
import { Button, Skeleton, StatCard } from './ui';
import { useUnsavedChanges } from './ui/useUnsavedChanges';
import { api, parseCsv } from '../lib/client';
import { templates, plans, dateLabel } from '../lib/catalog';
import { blankContent, type Content } from '../lib/content';
import type { EventRow } from '../lib/types';
import EventEditor from './EventEditor';
import BillingPanel from './BillingPanel';
import SettingsPanel from './SettingsPanel';
type EventDetail = Omit<EventRow, 'draft' | 'published'> & {
  draft: Content;
  published: Content | null;
  owner: boolean;
  stats: { guests: number; attending: number; people: number; wishes: number; bytes: number };
  lifecycle: { expires: number | null };
};
export default function Dashboard({
  name,
  admin,
  eventId,
}: {
  name: string;
  admin: boolean;
  eventId?: string;
}) {
  const [events, setEvents] = useState<EventRow[]>([]),
    [event, setEvent] = useState<EventDetail | null>(null),
    [draft, setDraft] = useState<Content>(blankContent),
    [template, setTemplate] = useState('minimal-ivory'),
    [tab, setTab] = useState('editor');
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null),
    [creating, setCreating] = useState(false);
  const [guests, setGuests] = useState<any[]>([]),
    [media, setMedia] = useState<any[]>([]),
    [runs, setRuns] = useState<any[]>([]),
    [invoices, setInvoices] = useState<any[]>([]),
    [guestPage, setGuestPage] = useState(1),
    [query, setQuery] = useState(''),
    [share, setShare] = useState<any>(null),
    [editingGuest, setEditingGuest] = useState<any>(null),
    [guestForm, setGuestForm] = useState(false),
    [preview, setPreview] = useState(0);
  const [composeAfterCreate, setComposeAfterCreate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    text: string;
    success: string;
    run: () => Promise<void>;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function tell(text: string, error = false) {
    setNotice({ text, error });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 10000);
  }
  async function load(id = eventId, reset = true) {
    if (id) {
      const e = await api<EventDetail>(`/api/events/${id}`);
      setEvent(e);
      if (reset) {
        setDraft(e.draft);
        setTemplate(e.template_id);
      }
      const [m, g, r] = await Promise.all([
        api(`/api/events/${id}/media`),
        api(`/api/events/${id}/guests?page=${guestPage}&q=${encodeURIComponent(query)}`),
        api(`/api/events/${id}/compose`),
      ]);
      setMedia(m);
      setGuests(g);
      setRuns(r);
      if (e.owner) setInvoices(await api(`/api/events/${id}/invoices`));
    } else setEvents(await api('/api/events'));
  }
  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    if (requestedTab === 'compose' && eventId) setTab('compose');
    load()
      .catch((e) => tell(e.message, true))
      .finally(() => setLoading(false));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [eventId]);
  useEffect(() => {
    if (event)
      api(`/api/events/${event.id}/guests?page=${guestPage}&q=${encodeURIComponent(query)}`)
        .then(setGuests)
        .catch((e) => tell(e.message, true));
  }, [guestPage, query]);
  async function act(fn: () => Promise<unknown>, success?: string) {
    setBusy(true);
    try {
      await fn();
      if (success) tell(success);
    } catch (e) {
      tell(e instanceof Error ? e.message : 'Terjadi kesalahan.', true);
    } finally {
      setBusy(false);
    }
  }
  const endpoint = `/api/events/${event?.id}`;
  const dirty =
    event &&
    (JSON.stringify(draft) !== JSON.stringify(event.draft) || template !== event.template_id);
  useUnsavedChanges(!!dirty);
  async function save() {
    await api(endpoint, 'PUT', { version: event!.version, templateId: template, content: draft });
    await load();
    setPreview((v) => v + 1);
  }
  async function importGuests(file: File) {
    if (file.size > 256000) throw new Error('CSV maksimal 250 KB.');
    const rows = parseCsv((await file.text()).replace(/^\ufeff/, ''));
    const headers = rows.shift()?.map((x) => x.trim().toLowerCase()) || [];
    if (!headers.includes('name'))
      throw new Error('CSV memerlukan kolom name, phone, group, max_party.');
    if (rows.length > 100) throw new Error('Impor maksimal 100 baris per file.');
    const inputs = rows.map((row) => {
      const obj = Object.fromEntries(headers.map((h, i) => [h, row[i] || '']));
      return {
        name: obj.name,
        phone: obj.phone || '',
        group: obj.group || obj.group_name || '',
        maxParty: Number(obj.max_party) || 4,
      };
    });
    await api(endpoint + '/guests', 'POST', { guests: inputs });
    await load(undefined, false);
  }
  const stats = event
    ? [
        ['Tamu diundang', event.stats.guests],
        ['Konfirmasi hadir', event.stats.attending],
        ['Total orang hadir', event.stats.people],
        ['Ucapan diterima', event.stats.wishes],
      ]
    : [
        ['Undangan Anda', events.length],
        ['Sudah terbit', events.filter((x) => x.status === 'published').length],
        ['Dalam persiapan', events.filter((x) => x.status === 'draft').length],
        ['Paket aktif', events.filter((x) => x.plan).length],
      ];
  return (
    <AppShell name={name} admin={admin}>
      {loading ? (
        <Skeleton label="Menyiapkan ruang cerita Anda…" />
      ) : (
        <>
          {!event ? (
            <>
              <div className="page-intro between">
                <div>
                  <span className="eyebrow">SETIAP MOMEN PUNYA CERITA</span>
                  <h1 style={{ marginTop: 13 }}>Halo, {name.split(' ')[0]}.</h1>
                  <p className="muted" style={{ margin: 0 }}>
                    Mari siapkan sesuatu yang berarti untuk orang-orang terdekat.
                  </p>
                </div>
                <button
                  className="btn"
                  onClick={() => {
                    setComposeAfterCreate(false);
                    setCreating(true);
                  }}
                >
                  <Plus size={17} />
                  Buat undangan
                </button>
              </div>
              <div className="stats">
                {stats.map(([label, value]) => (
                  <StatCard key={label} label={String(label)} value={value} />
                ))}
              </div>
              <div className="banner">
                <img
                  className="banner-symbol"
                  src="/brand/symbol.svg"
                  alt=""
                  width="64"
                  height="64"
                />
                <div>
                  <h3>Ide Anda, dirangkai bersama.</h3>
                  <p>Compose membantu menulis pembuka, cerita, dan pesan untuk tamu.</p>
                </div>
                <Button
                  variant="secondary"
                  className="banner-actions"
                  onClick={() => {
                    setComposeAfterCreate(true);
                    setCreating(true);
                  }}
                >
                  <Sparkles size={17} />
                  Mulai dengan Compose
                </Button>
              </div>
              <div className="between" style={{ marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>Undangan saya</h3>
                <span className="note">Wedding collection</span>
              </div>
              {events.length ? (
                <div className="event-grid">
                  {events.map((e) => (
                    <a key={e.id} href={`/app/${e.id}`} className="event-card">
                      <div
                        className={`template-art ${e.template_id}`}
                        style={
                          {
                            '--tint': templates.find((t) => t.id === e.template_id)?.color,
                          } as React.CSSProperties
                        }
                      >
                        {JSON.parse(e.draft).hero && (
                          <img
                            className="event-cover"
                            src={`/api/media/${JSON.parse(e.draft).hero}`}
                            alt=""
                            loading="lazy"
                          />
                        )}
                        <div className="mini">
                          <small>THE WEDDING OF</small>
                          <div className="names">
                            {JSON.parse(e.draft).groom || 'Cerita'}
                            <br />
                            <i>&</i> {JSON.parse(e.draft).bride || 'Anda'}
                          </div>
                          <small>CREATE. INVITE. CELEBRATE.</small>
                        </div>
                      </div>
                      <div className="details">
                        <span className={`badge ${e.status === 'published' ? 'green' : ''}`}>
                          {e.status === 'published'
                            ? 'Sudah terbit'
                            : e.status === 'suspended'
                              ? 'Ditangguhkan'
                              : 'Draf'}
                        </span>
                        <h3>{e.title}</h3>
                        <p className="note row" style={{ gap: 6, margin: 0 }}>
                          <CalendarDays size={14} aria-hidden="true" />
                          {JSON.parse(e.draft).date || 'Tanggal belum ditentukan'}
                        </p>
                        <div className="between event-meta">
                          <span className="note">
                            {e.plan
                              ? plans[e.plan as keyof typeof plans]?.name
                              : 'Pratinjau gratis'}
                          </span>
                          <ArrowUpRight size={19} />
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <span className="icon-tile">
                    <Mail size={26} />
                  </span>
                  <h2>Di sini cerita Anda dimulai.</h2>
                  <p>
                    Pilih template yang Anda sukai, tambahkan detail acara, lalu jadikan undangan
                    yang begitu personal.
                  </p>
                  <button className="btn" onClick={() => setCreating(true)}>
                    Buat undangan pertama <ArrowUpRight size={17} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="page-intro">
                <a className="note row" href="/app">
                  <ArrowLeft size={14} />
                  Semua undangan
                </a>
                <div className="between" style={{ marginTop: 15 }}>
                  <div>
                    <div className="row">
                      <span className="badge">
                        {event.plan
                          ? plans[event.plan as keyof typeof plans]?.name
                          : 'Pratinjau gratis'}
                      </span>
                      <span className={`badge ${event.status === 'published' ? 'green' : ''}`}>
                        {event.status === 'published' ? 'Sudah terbit' : 'Draf'}
                      </span>
                    </div>
                    <h1 style={{ marginTop: 12 }}>{event.title}</h1>
                    <p className="note" style={{ margin: 0 }}>
                      {event.plan
                        ? `Masa aktif: ${dateLabel(event.lifecycle.expires)}`
                        : `Pratinjau sampai ${dateLabel(event.trial_expires_at)}`}{' '}
                      · {dirty ? 'Ada perubahan belum disimpan' : 'Draf tersimpan'}
                    </p>
                  </div>
                  <div className="row">
                    <a
                      className="btn secondary"
                      href={`/app/${event.id}/preview`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Eye size={17} />
                      Pratinjau
                    </a>
                    {event.owner && (
                      <button
                        className="btn"
                        disabled={busy || !!dirty}
                        onClick={() =>
                          act(async () => {
                            await api(endpoint + '/publish', 'POST', { version: event.version });
                            await load();
                          }, 'Undangan berhasil diterbitkan.')
                        }
                      >
                        <ArrowUpRight size={17} />
                        Publikasikan
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="tabs" role="group" aria-label="Bagian studio undangan">
                {[
                  ['editor', 'Editor', Paintbrush],
                  ['guests', 'Tamu & ucapan', Users],
                  ['media', 'Foto & musik', Image],
                  ['compose', 'Compose', Sparkles],
                  ...(event.owner
                    ? [
                        ['billing', 'Paket & pembayaran', Wallet],
                        ['settings', 'Pengaturan', Settings],
                      ]
                    : []),
                ].map(([key, label, Icon]: any) => (
                  <button
                    key={key}
                    className={tab === key ? 'active' : ''}
                    aria-pressed={tab === key}
                    onClick={() => setTab(key)}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>
              {tab === 'editor' && (
                <EventEditor
                  event={event}
                  draft={draft}
                  setDraft={setDraft}
                  template={template}
                  setTemplate={setTemplate}
                  media={media}
                  busy={busy}
                  save={() => act(save, 'Perubahan draf tersimpan.')}
                  preview={preview}
                  dirty={!!dirty}
                />
              )}
              {tab === 'guests' && (
                <>
                  <div className="stats">
                    {stats.map(([label, value]) => (
                      <StatCard key={label} label={String(label)} value={value} />
                    ))}
                  </div>
                  <div className="panel">
                    <div className="between">
                      <div>
                        <h3 style={{ marginBottom: 3 }}>Orang-orang terdekat</h3>
                        <span className="note">
                          {event.stats.guests} dari {event.guest_limit} undangan personal
                        </span>
                      </div>
                      <div className="row">
                        <a className="btn secondary small" href={endpoint + '/guests/export'}>
                          <Download size={15} />
                          Ekspor
                        </a>
                        <button
                          className="btn small"
                          onClick={() => {
                            setEditingGuest(null);
                            setGuestForm(true);
                          }}
                        >
                          <Plus size={15} />
                          Tambah tamu
                        </button>
                      </div>
                    </div>
                    <div className="form-grid" style={{ margin: '22px 0' }}>
                      <label>
                        Cari nama atau kelompok
                        <input
                          value={query}
                          onChange={(e) => {
                            setQuery(e.target.value);
                            setGuestPage(1);
                          }}
                          placeholder="Cari tamu…"
                        />
                      </label>
                      <label>
                        Impor CSV · maksimal 100 baris
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) act(() => importGuests(file), 'Tamu berhasil diimpor.');
                            e.target.value = '';
                          }}
                        />
                        <span className="note">Kolom: name, phone, group, max_party</span>
                      </label>
                    </div>
                    <div
                      className="table-wrap"
                      role="region"
                      aria-label="Daftar tamu dan respons"
                      tabIndex={0}
                    >
                      <table>
                        <thead>
                          <tr>
                            <th>TAMU</th>
                            <th>KEHADIRAN</th>
                            <th>UCAPAN</th>
                            <th>AKSI</th>
                          </tr>
                        </thead>
                        <tbody>
                          {guests.map((g) => (
                            <tr key={g.id}>
                              <td>
                                <strong>{g.name}</strong>
                                <div className="note">
                                  {g.group_name} {g.phone && `· ${g.phone}`}
                                </div>
                                <span className="note">
                                  {g.opened_at
                                    ? 'Dibuka'
                                    : g.sent_at
                                      ? 'Ditandai dikirim'
                                      : g.clicked_at
                                        ? 'WhatsApp dibuka'
                                        : 'Belum dibagikan'}{' '}
                                  · maks. {g.max_party}
                                </span>
                              </td>
                              <td>
                                {g.attending == null
                                  ? 'Belum menjawab'
                                  : g.attending
                                    ? `${g.party} orang hadir`
                                    : 'Tidak hadir'}
                              </td>
                              <td>
                                {g.message ? (
                                  <>
                                    <details>
                                      <summary>
                                        {g.hidden ? 'Disembunyikan' : 'Lihat ucapan'}
                                      </summary>
                                      <p>{g.message}</p>
                                    </details>
                                    <button
                                      className="quiet link"
                                      onClick={() =>
                                        act(async () => {
                                          await api(endpoint + `/guests/${g.id}/moderate`, 'POST', {
                                            hidden: !g.hidden,
                                          });
                                          await load(undefined, false);
                                        })
                                      }
                                    >
                                      {g.hidden ? 'Tampilkan' : 'Sembunyikan'}
                                    </button>
                                  </>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td>
                                <div className="actions">
                                  <button
                                    className="quiet small"
                                    onClick={() => {
                                      setEditingGuest(g);
                                      setGuestForm(true);
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="btn secondary small"
                                    disabled={!g.code_active}
                                    onClick={() =>
                                      act(async () =>
                                        setShare({
                                          ...(await api(endpoint + `/guests/${g.id}/link`)),
                                          id: g.id,
                                          name: g.name,
                                        }),
                                      )
                                    }
                                  >
                                    Bagikan
                                  </button>
                                  <button
                                    className="quiet small"
                                    aria-label={`Rotasi kode ${g.name}`}
                                    title="Ganti kode; tautan lama berhenti berlaku"
                                    onClick={() =>
                                      setConfirmation({
                                        title: 'Ganti kode tamu?',
                                        text: `Tautan dan sesi lama ${g.name} akan berhenti berlaku. Bagikan tautan baru setelah mengganti kode.`,
                                        success: 'Kode diperbarui. Bagikan kembali tautan baru.',
                                        run: async () => {
                                          await api(
                                            endpoint + `/guests/${g.id}/rotate`,
                                            'POST',
                                            {},
                                          );
                                          await load(undefined, false);
                                        },
                                      })
                                    }
                                  >
                                    <RefreshCw size={15} />
                                  </button>
                                  <button
                                    className="quiet small"
                                    onClick={() =>
                                      setConfirmation({
                                        title: 'Cabut kode tamu?',
                                        text: `Tautan dan sesi ${g.name} akan berhenti berlaku. Tamu tidak dapat mengirim RSVP atau ucapan sampai mendapat kode baru.`,
                                        success: 'Kode dan sesi tamu dicabut.',
                                        run: async () => {
                                          await api(
                                            endpoint + `/guests/${g.id}/revoke`,
                                            'POST',
                                            {},
                                          );
                                          await load(undefined, false);
                                        },
                                      })
                                    }
                                  >
                                    Cabut kode
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!guests.length && (
                      <p className="muted" style={{ padding: 25, textAlign: 'center' }}>
                        Belum ada tamu pada daftar ini.
                      </p>
                    )}
                    <div className="between" style={{ marginTop: 15 }}>
                      <button
                        className="btn secondary small"
                        disabled={guestPage === 1}
                        onClick={() => setGuestPage((p) => p - 1)}
                      >
                        Sebelumnya
                      </button>
                      <span className="note">Halaman {guestPage}</span>
                      <button
                        className="btn secondary small"
                        disabled={guests.length < 50}
                        onClick={() => setGuestPage((p) => p + 1)}
                      >
                        Berikutnya
                      </button>
                    </div>
                  </div>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={!!event.responses_open}
                      onChange={(e) =>
                        act(async () => {
                          await api(endpoint + '/responses', 'PUT', { open: e.target.checked });
                          await load(undefined, false);
                        })
                      }
                    />
                    Terima RSVP dan ucapan. Ucapan langsung tampil, lalu dapat Anda sembunyikan.
                  </label>
                </>
              )}
              {tab === 'media' && (
                <>
                  <div className="panel">
                    <div className="between">
                      <div>
                        <h3>Album untuk hari istimewa</h3>
                        <p className="note">
                          {(event.stats.bytes / 1000000).toFixed(1)} / {event.media_limit / 1000000}{' '}
                          MB · {media.filter((m) => m.kind === 'image').length} /{' '}
                          {event.photo_limit} foto
                        </p>
                      </div>
                      <label
                        className={`btn secondary file-picker ${busy || !event.media_limit ? 'is-disabled' : ''}`}
                      >
                        Tambah foto atau MP3
                        <input
                          className="sr-only"
                          aria-label="Tambah foto atau MP3"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,audio/mpeg"
                          disabled={busy || !event.media_limit}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f)
                              act(async () => {
                                if (f.size > 20 * 1024 * 1024)
                                  throw new Error('Foto maksimal 10 MiB dan MP3 maksimal 20 MiB.');
                                if (f.size + event.stats.bytes > event.media_limit)
                                  throw new Error(
                                    'Kapasitas penyimpanan tidak cukup. Hapus aset yang tidak terpakai atau tambah kapasitas paket.',
                                  );
                                if (
                                  f.type.startsWith('image/') &&
                                  media.filter((m) => m.kind === 'image').length >=
                                    event.photo_limit
                                )
                                  throw new Error(
                                    'Batas jumlah foto tercapai. Hapus foto yang tidak terpakai atau pilih paket dengan kuota lebih besar.',
                                  );
                                setUploading(true);
                                try {
                                  const response = await fetch(endpoint + '/media', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': f.type,
                                      'x-file-name': f.name.replace(/[^a-zA-Z0-9._ -]/g, '_'),
                                    },
                                    body: f,
                                  });
                                  const r = (await response.json()) as { error?: string };
                                  if (!response.ok) throw new Error(r.error || 'Unggah gagal.');
                                  await load(undefined, false);
                                } finally {
                                  setUploading(false);
                                }
                              }, 'Aset berhasil diunggah.');
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                    {!event.media_limit && (
                      <div className="message warning" role="status">
                        Kuota media pratinjau akun ini sudah digunakan. Aktifkan paket untuk
                        mengunggah foto dan musik.
                      </div>
                    )}
                    {uploading && (
                      <div className="upload-progress" role="status">
                        <span>Mengunggah aset… tunggu sampai selesai.</span>
                        <div className="progress" aria-hidden="true">
                          <span />
                        </div>
                      </div>
                    )}
                    <p className="note">
                      Unggah foto JPEG/PNG/WebP hingga 10 MiB atau musik MP3 hingga 20 MiB yang Anda
                      berhak gunakan. Pilih penempatan foto melalui Editor.
                    </p>
                  </div>
                  <div className="media-grid">
                    {media.map((m) => (
                      <article className="media-card" key={m.id}>
                        {m.kind === 'image' ? (
                          <img src={`/api/media/${m.id}`} alt={m.alt || m.filename} />
                        ) : (
                          <div className="template-art" style={{ height: 160 }}>
                            <span style={{ fontSize: 50 }}>♫</span>
                          </div>
                        )}
                        <div className="details">
                          <strong style={{ overflowWrap: 'anywhere' }}>{m.filename}</strong>
                          <p className="note">{(m.size / 1000000).toFixed(2)} MB</p>
                          <form
                            method="post"
                            className="stack"
                            onSubmit={(ev) => {
                              ev.preventDefault();
                              const d = new FormData(ev.currentTarget);
                              act(async () => {
                                await api(endpoint + `/media/${m.id}`, 'PUT', {
                                  alt: String(d.get('alt')),
                                  focalX: Number(d.get('focalX') ?? m.focal_x),
                                  focalY: Number(d.get('focalY') ?? m.focal_y),
                                });
                                await load(undefined, false);
                              }, 'Detail aset tersimpan.');
                            }}
                          >
                            <label>
                              Teks alternatif
                              <input name="alt" defaultValue={m.alt} maxLength={200} />
                            </label>
                            {m.kind === 'image' && (
                              <>
                                <label>
                                  Fokus horizontal
                                  <input
                                    name="focalX"
                                    type="range"
                                    min={0}
                                    max={100}
                                    defaultValue={m.focal_x}
                                  />
                                </label>
                                <label>
                                  Fokus vertikal
                                  <input
                                    name="focalY"
                                    type="range"
                                    min={0}
                                    max={100}
                                    defaultValue={m.focal_y}
                                  />
                                </label>
                              </>
                            )}
                            <button className="btn secondary small" disabled={busy}>
                              Simpan detail aset
                            </button>
                          </form>
                          <button
                            className="quiet link"
                            onClick={() =>
                              setConfirmation({
                                title: 'Hapus aset?',
                                text: `${m.filename} akan dihapus dari penyimpanan. File yang masih digunakan pada undangan harus dilepas dari editor terlebih dahulu.`,
                                success: 'Aset dihapus.',
                                run: async () => {
                                  await api(endpoint + `/media/${m.id}`, 'DELETE');
                                  await load(undefined, false);
                                },
                              })
                            }
                          >
                            Hapus aset
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!media.length && (
                    <div className="empty">
                      <h2>Kenangan punya tempat di sini.</h2>
                      <p>Tambahkan foto dan musik untuk melengkapi cerita Anda.</p>
                    </div>
                  )}
                </>
              )}
              {tab === 'compose' && (
                <div className="compose-layout">
                  <section className="panel">
                    <img
                      className="compose-logo"
                      src="/brand/symbol.svg"
                      width="52"
                      height="52"
                      alt=""
                    />
                    <span className="eyebrow">TEMAN MENYUSUN CERITA</span>
                    <h2 style={{ marginTop: 12 }}>
                      Bercerita saja.
                      <br />
                      Kita rangkai bersama.
                    </h2>
                    <p className="muted">
                      Ceritakan nuansa yang Anda inginkan. Compose akan mengusulkan perubahan untuk
                      Anda tinjau.
                    </p>
                    <span className="badge">
                      <Sparkles size={12} />
                      {Math.max(0, event.ai_credits - event.ai_used - event.ai_reserved)} bantuan
                      tersisa
                    </span>
                    {dirty && (
                      <p className="message error">
                        Simpan perubahan Editor sebelum memakai Compose.
                      </p>
                    )}
                    <form
                      method="post"
                      className="stack"
                      style={{ marginTop: 20 }}
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        const form = ev.currentTarget;
                        const message = String(new FormData(form).get('message'));
                        act(async () => {
                          await api(endpoint + '/compose', 'POST', {
                            message,
                            version: event.version,
                            requestKey: crypto.randomUUID(),
                          });
                          await load(undefined, false);
                          form.reset();
                        }, 'Usulan siap ditinjau.');
                      }}
                    >
                      <label>
                        Yang ingin Anda ceritakan
                        <textarea
                          name="message"
                          required
                          minLength={3}
                          maxLength={1500}
                          rows={6}
                          placeholder="Bantu tulis pembuka yang hangat dan sederhana. Kami ingin suasana perayaan keluarga yang akrab…"
                        />
                      </label>
                      <button className="btn" disabled={busy || !!dirty}>
                        <Sparkles size={17} />
                        {busy ? 'Compose sedang menulis…' : 'Bantu rangkai cerita'}
                      </button>
                    </form>
                    <p className="note" style={{ marginTop: 15 }}>
                      Usulan tidak langsung mengubah atau memublikasikan undangan. Periksa nama,
                      tanggal, dan alamat sebelum menerapkan.
                    </p>
                  </section>
                  <section>
                    {runs.map((r) => (
                      <article className="panel" key={r.id}>
                        <div className="chat user">{r.prompt}</div>
                        <div className="chat">
                          {r.reply ||
                            (r.status === 'failed'
                              ? 'Usulan belum berhasil. Kredit tidak terpakai.'
                              : 'Sedang memproses…')}
                        </div>
                        {r.proposal && (
                          <>
                            <dl className="diff">
                              {Object.entries(JSON.parse(r.proposal).patch).map(([k, v]) => (
                                <div key={k}>
                                  <dt>{k}</dt>
                                  <dd>{typeof v === 'string' ? v : JSON.stringify(v, null, 2)}</dd>
                                </div>
                              ))}
                            </dl>
                            <button
                              className="btn secondary"
                              disabled={
                                busy || r.status !== 'proposed' || r.draft_version !== event.version
                              }
                              onClick={() =>
                                act(async () => {
                                  await api(endpoint + `/compose/${r.id}`, 'POST', {});
                                  await load();
                                  setPreview((v) => v + 1);
                                }, 'Usulan diterapkan ke draf.')
                              }
                            >
                              <Check size={16} />
                              {r.status === 'applied' ? 'Sudah diterapkan' : 'Terapkan ke draf'}
                            </button>
                          </>
                        )}
                      </article>
                    ))}
                    {!runs.length && (
                      <div className="empty">
                        <Sparkles size={30} />
                        <h3 style={{ marginTop: 15 }}>Dari ide menjadi kata-kata.</h3>
                        <p>
                          Usulan Anda akan tampil di sini, lengkap dengan perubahan yang bisa
                          ditinjau.
                        </p>
                      </div>
                    )}
                  </section>
                </div>
              )}
              {tab === 'billing' && event.owner && (
                <BillingPanel
                  event={event}
                  invoices={invoices}
                  busy={busy}
                  act={act}
                  refresh={() => load(undefined, false)}
                />
              )}
              {tab === 'settings' && event.owner && (
                <SettingsPanel event={event} busy={busy} act={act} refresh={() => load()} />
              )}
            </>
          )}
        </>
      )}
      {confirmation && (
        <Modal
          title={confirmation.title}
          close={() => {
            if (!busy) setConfirmation(null);
          }}
        >
          <p>{confirmation.text}</p>
          <div className="row">
            <Button variant="secondary" disabled={busy} onClick={() => setConfirmation(null)}>
              Batalkan
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                act(async () => {
                  await confirmation.run();
                  setConfirmation(null);
                }, confirmation.success)
              }
            >
              Ya, lanjutkan
            </Button>
          </div>
        </Modal>
      )}
      {creating && (
        <Modal close={() => setCreating(false)} title="Awal cerita baru">
          <form
            method="post"
            className="stack"
            onSubmit={(ev) => {
              ev.preventDefault();
              const data = Object.fromEntries(new FormData(ev.currentTarget));
              act(async () => {
                const e = await api('/api/events', 'POST', data);
                window.location.href = `/app/${e.id}${composeAfterCreate ? '?tab=compose' : ''}`;
              });
            }}
          >
            <label>
              Judul undangan
              <input
                name="title"
                placeholder="Pernikahan Aruna & Bima"
                minLength={3}
                maxLength={100}
                required
              />
            </label>
            <label>
              Alamat undangan<div className="note">celeyo.com/i/</div>
              <input
                name="slug"
                placeholder="aruna-bima"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                minLength={3}
                maxLength={64}
                required
              />
            </label>
            <label>
              Template
              <select name="templateId">
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="note">
              Satu draf percobaan selama 7 hari. Publikasi memerlukan paket berbayar.
            </p>
            <button className="btn" disabled={busy}>
              Buat undangan ↗
            </button>
          </form>
        </Modal>
      )}
      {guestForm && event && (
        <Modal
          close={() => setGuestForm(false)}
          title={editingGuest ? 'Edit data tamu' : 'Undang orang terdekat'}
        >
          <form
            method="post"
            className="stack"
            onSubmit={(ev) => {
              ev.preventDefault();
              const d = Object.fromEntries(new FormData(ev.currentTarget));
              act(async () => {
                if (editingGuest)
                  await api(endpoint + '/guests/' + editingGuest.id, 'PUT', {
                    ...d,
                    maxParty: Number(d.maxParty),
                  });
                else
                  await api(endpoint + '/guests', 'POST', {
                    guests: [{ ...d, maxParty: Number(d.maxParty) }],
                  });
                setGuestForm(false);
                await load(undefined, false);
              }, 'Tamu berhasil ditambahkan.');
            }}
          >
            <label>
              Nama tamu
              <input name="name" required maxLength={80} defaultValue={editingGuest?.name || ''} />
            </label>
            <label>
              Nomor WhatsApp · opsional
              <input
                name="phone"
                type="tel"
                placeholder="62812…"
                defaultValue={editingGuest?.phone || ''}
              />
            </label>
            <div className="form-grid">
              <label>
                Kelompok
                <input
                  name="group"
                  placeholder="Keluarga"
                  maxLength={80}
                  defaultValue={editingGuest?.group_name || ''}
                />
              </label>
              <label>
                Maksimum orang
                <input
                  name="maxParty"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={editingGuest?.max_party || 4}
                />
              </label>
            </div>
            <button className="btn" disabled={busy}>
              {editingGuest ? 'Simpan data tamu' : 'Simpan & buat kode personal'}
            </button>
          </form>
        </Modal>
      )}
      {share && (
        <Modal close={() => setShare(null)} title={`Untuk ${share.name}`}>
          <p className="note">
            Tautan ini memberi hak RSVP dan ucapan kepada tamu tersebut. Bagikan secara pribadi.
          </p>
          <textarea readOnly rows={6} value={share.message} />
          <div className="row" style={{ marginTop: 20 }}>
            <button
              className="btn secondary"
              onClick={() =>
                act(() => navigator.clipboard.writeText(share.message), 'Pesan disalin.')
              }
            >
              <Copy size={16} />
              Salin pesan
            </button>
            {share.whatsapp && (
              <a
                className="btn"
                href={share.whatsapp}
                target="_blank"
                rel="noreferrer"
                onClick={() =>
                  void api(endpoint + `/guests/${share.id}/activity`, 'POST', {
                    type: 'clicked',
                  }).catch(() => {})
                }
              >
                Buka WhatsApp ↗
              </a>
            )}
          </div>
          <p className="note" style={{ marginTop: 20 }}>
            Setelah WhatsApp terbuka, Anda perlu menekan Kirim sendiri.
          </p>
          <button
            className="quiet link"
            onClick={() =>
              act(async () => {
                await api(endpoint + `/guests/${share.id}/activity`, 'POST', { type: 'sent' });
                await load(undefined, false);
                setShare(null);
              }, 'Ditandai telah dikirim secara manual.')
            }
          >
            Saya sudah mengirim undangan
          </button>
          <label style={{ marginTop: 15 }}>
            Tautan personal
            <input readOnly value={share.url} onFocus={(e) => e.target.select()} />
          </label>
        </Modal>
      )}
      {notice && (
        <div
          className={`toast message ${notice.error ? 'error' : ''}`}
          role={notice.error ? 'alert' : 'status'}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Tutup pemberitahuan"
            onClick={() => setNotice(null)}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </AppShell>
  );
}
