import { useEffect, useState } from 'react';
import { Copy, ArrowUpRight } from 'lucide-react';
import { api } from '../lib/client';
import { plans, addons, rupiah, dateLabel, addMonths } from '../lib/catalog';
import { whatsappUrl } from '../lib/content';
export default function BillingPanel({
  event: e,
  invoices,
  busy,
  act,
  refresh,
}: {
  event: any;
  invoices: any[];
  busy: boolean;
  act: (fn: () => Promise<unknown>, message?: string) => void;
  refresh: () => Promise<unknown>;
}) {
  const [terms, setTerms] = useState(false),
    [activation, setActivation] = useState(new Date().toISOString().slice(0, 10)),
    [selected, setSelected] = useState<string | null>(null),
    [prices, setPrices] = useState<any>({ plans, addons });
  useEffect(() => {
    api('/api/catalog')
      .then((r) => setPrices(r.prices))
      .catch(() => {});
  }, []);
  const contract = e.plan_snapshot ? JSON.parse(e.plan_snapshot).book : prices;
  const invoice = invoices.find((i) => i.id === selected) || invoices[0];
  const snap = invoice ? JSON.parse(invoice.snapshot) : null;
  const statuses: Record<string, string> = {
    pending_transfer: 'Menunggu transfer',
    pending_review: 'Menunggu pemeriksaan',
    needs_clarification: 'Perlu klarifikasi',
    paid: 'Pembayaran diterima',
    expired: 'Invoice berakhir',
    cancelled: 'Dibatalkan',
    refunded: 'Dikembalikan',
  };
  function buy(kind: string, plan?: string) {
    act(async () => {
      const i = await api(`/api/events/${e.id}/invoices`, 'POST', {
        kind,
        plan,
        activationDate: activation,
        acceptTerms: terms,
      });
      await refresh();
      setSelected(i.id);
    }, 'Invoice dibuat. Ikuti petunjuk transfer dan konfirmasi WhatsApp.');
  }
  return (
    <>
      <div className="panel">
        <h2>Pilih ruang untuk perayaan Anda.</h2>
        <p className="muted">
          Paket sekali bayar untuk satu acara. Pembayaran diperiksa manual setelah konfirmasi
          WhatsApp.
        </p>
        <div className="form-grid">
          <label>
            Rencana publikasi pertama
            <input
              type="date"
              value={activation}
              onChange={(ev) => setActivation(ev.target.value)}
            />
          </label>
          <div>
            <p className="note">
              Aktivasi paling lambat 90 hari setelah approval. Perpanjang bila tanggal acara berada
              setelah akhir masa aktif.
            </p>
          </div>
        </div>
        <label className="check" style={{ marginTop: 20 }}>
          <input type="checkbox" checked={terms} onChange={(ev) => setTerms(ev.target.checked)} />
          Saya memahami masa aktif, kuota, pemeriksaan transfer manual, dan bahwa jasa setup dibeli
          terpisah. Kebijakan refund serta instruksi pembayaran akan ditampilkan di invoice sebelum
          transfer.
        </label>
      </div>
      <div className="grid-3">
        {Object.values(contract.plans as typeof plans).map((p) => (
          <article className={`price-card ${p.id === 'premium' ? 'featured' : ''}`} key={p.id}>
            <span className="eyebrow">{p.name}</span>
            <p className="price" style={{ fontSize: 32 }}>
              {rupiah(
                e.plan && p.price > contract.plans[e.plan].price
                  ? p.price - contract.plans[e.plan].price
                  : p.price,
              )}
            </p>
            <p className="note">
              {e.plan ? 'selisih upgrade' : `sekali bayar · ${p.months} bulan`}
            </p>
            <ul>
              <li>{p.guests} tamu</li>
              <li>
                {p.photos} foto · {p.media / 1000000} MB
              </li>
              <li>{p.ai} bantuan Compose</li>
              <li>{p.months} bulan masa aktif</li>
            </ul>
            {!e.plan && (
              <p className="note">
                Perkiraan akhir:{' '}
                {dateLabel(
                  Number.isFinite(Date.parse(activation))
                    ? addMonths(Date.parse(activation + 'T00:00:00+07:00'), p.months)
                    : null,
                )}
              </p>
            )}
            <button
              className="btn"
              disabled={busy || !terms || (!!e.plan && p.price <= contract.plans[e.plan].price)}
              onClick={() => buy(e.plan ? 'upgrade' : 'package', p.id)}
            >
              {e.plan === p.id ? 'Paket Anda' : e.plan ? 'Upgrade' : 'Pilih paket'}
            </button>
          </article>
        ))}
      </div>
      {e.plan && (
        <section className="panel" style={{ marginTop: 24 }}>
          <h3>Lengkapi sesuai kebutuhan</h3>
          <div className="row">
            {Object.entries(prices.addons).map(([kind, item]: any) => (
              <button
                className="btn secondary"
                key={kind}
                disabled={busy || !terms}
                onClick={() => buy(kind)}
              >
                {item.name} · {rupiah(item.price)}
              </button>
            ))}
          </div>
          <p className="note" style={{ marginTop: 18 }}>
            Jasa setup mencakup satu acara, template tersedia, dan dua putaran revisi. Pemilik tetap
            memublikasikan hasilnya.
          </p>
        </section>
      )}
      <section className="panel" style={{ marginTop: 25 }}>
        <h3>Invoice & pembayaran</h3>
        {!invoices.length ? (
          <p className="muted">Invoice Anda akan tampil setelah memilih paket.</p>
        ) : (
          <>
            <label>
              Pilih invoice
              <select value={invoice?.id} onChange={(ev) => setSelected(ev.target.value)}>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.number} · {rupiah(i.total)} · {statuses[i.status]}
                  </option>
                ))}
              </select>
            </label>
            {invoice && snap && (
              <div style={{ marginTop: 25 }}>
                <div className="between">
                  <div>
                    <span className="eyebrow">{invoice.number}</span>
                    <h2 style={{ margin: '10px 0' }}>{rupiah(invoice.total)}</h2>
                    <span className={`badge ${invoice.status === 'paid' ? 'green' : ''}`}>
                      {statuses[invoice.status]}
                    </span>
                  </div>
                  <p className="note">
                    Batas transfer
                    <br />
                    {new Date(invoice.expires_at).toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="separator" />
                <div className="form-grid">
                  <div>
                    <h3>{snap.business.bank}</h3>
                    <p className="serif" style={{ fontSize: 27, marginBottom: 8 }}>
                      {snap.business.number}
                    </p>
                    <p>a.n. {snap.business.holder}</p>
                    <button
                      className="btn secondary small"
                      onClick={() =>
                        act(
                          () => navigator.clipboard.writeText(snap.business.number),
                          'Nomor rekening disalin.',
                        )
                      }
                    >
                      <Copy size={15} />
                      Salin rekening
                    </button>
                  </div>
                  <div>
                    <strong>Perlu diketahui</strong>
                    <p className="note">{snap.terms}</p>
                    {snap.estimatedExpiry && (
                      <p className="note">
                        Perkiraan akhir: {dateLabel(snap.estimatedExpiry)}.{' '}
                        {snap.eventCovered === false
                          ? 'Tanggal acara berada di luar masa aktif ini.'
                          : ''}
                      </p>
                    )}
                    <details>
                      <summary style={{ fontSize: 13 }}>Kebijakan refund</summary>
                      <p className="note">{snap.business.refundPolicy}</p>
                    </details>
                  </div>
                </div>
                {invoice.review_note && <p className="message">{invoice.review_note}</p>}
                {!['paid', 'refunded', 'cancelled', 'expired'].includes(invoice.status) && (
                  <form
                    method="post"
                    className="stack"
                    style={{ marginTop: 30 }}
                    onSubmit={(ev) => {
                      ev.preventDefault();
                      const data = Object.fromEntries(new FormData(ev.currentTarget));
                      act(async () => {
                        await api(`/api/events/${e.id}/invoices/${invoice.id}/claim`, 'POST', {
                          name: String(data.name),
                          transferredAt: new Date(String(data.time)).getTime(),
                          confirmedWhatsApp: data.confirm === 'on',
                        });
                        await refresh();
                      }, 'Konfirmasi dicatat. Tunggu pemeriksaan WhatsApp dan mutasi bank.');
                    }}
                  >
                    <h3 style={{ marginBottom: 0 }}>Setelah transfer</h3>
                    <p className="note">
                      Kirim nomor invoice dan bukti transfer ke WhatsApp billing. Lampirkan bukti
                      sendiri di WhatsApp, lalu catat konfirmasi di bawah.
                    </p>
                    <a
                      className="btn"
                      href={whatsappUrl(
                        snap.business.whatsapp,
                        `Halo CELEYO, saya ingin mengonfirmasi pembayaran.\nInvoice: ${invoice.number}\nAcara: ${e.title}\nPesanan: ${invoice.kind}${invoice.target_plan ? ' ' + invoice.target_plan : ''}\nTotal: ${rupiah(invoice.total)}\nNama pengirim: [isi nama Anda]\nWaktu transfer: [isi waktu transfer]\nSaya akan melampirkan bukti transfer di chat ini.`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Konfirmasi lewat WhatsApp <ArrowUpRight size={16} />
                    </a>
                    <details>
                      <summary style={{ fontSize: 12 }}>WhatsApp tidak terbuka?</summary>
                      <p className="note">
                        Nomor: {snap.business.whatsapp}. Kirim invoice {invoice.number}, acara{' '}
                        {e.title}, total {rupiah(invoice.total)}, nama pengirim, waktu, dan bukti
                        transfer.
                      </p>
                    </details>
                    <div className="form-grid">
                      <label>
                        Nama pengirim transfer
                        <input name="name" minLength={2} required maxLength={100} />
                      </label>
                      <label>
                        Waktu transfer
                        <input name="time" type="datetime-local" required />
                      </label>
                    </div>
                    <label className="check">
                      <input type="checkbox" name="confirm" required />
                      Saya sudah transfer dan mengirim konfirmasi WhatsApp.
                    </label>
                    <button className="btn secondary" disabled={busy}>
                      Catat konfirmasi pembayaran
                    </button>
                    <p className="note">
                      Klaim ini belum mengaktifkan paket. Status menjadi paid setelah dana dan chat
                      diperiksa.
                    </p>
                  </form>
                )}
                {['expired', 'cancelled'].includes(invoice.status) && (
                  <p className="message">
                    Jika dana sudah terlanjur ditransfer, hubungi WhatsApp billing{' '}
                    {snap.business.whatsapp} dengan nomor {invoice.number} untuk rekonsiliasi.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
