import { useState } from 'react';
import { ArrowUpRight, Heart, ImagePlus, Mail, Plus, Users, X } from 'lucide-react';
import BrandLogo from './ui/BrandLogo';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Skeleton,
  StatCard,
  Tabs,
  UsageMeter,
} from './ui';
import Modal from './ui/Modal';

export default function DesignSystem() {
  const [modal, setModal] = useState(false),
    [tab, setTab] = useState('content'),
    [page, setPage] = useState(1);
  return (
    <>
      <section aria-labelledby="logos">
        <span className="eyebrow">01 / Identitas</span>
        <h2 id="logos">Satu simbol, setiap momen.</h2>
        <div className="grid-3">
          <div className="brand-example">
            <BrandLogo variant="stacked" />
          </div>
          <div className="brand-example">
            <BrandLogo variant="horizontal" tone="mono" />
          </div>
          <div className="brand-example dark">
            <BrandLogo variant="horizontal" tone="inverse" />
          </div>
        </div>
        <p className="note">
          Clear space minimum ¼ lebar simbol. Simbol ≥24 px; lockup compact ≥132 px. Jangan
          meregangkan atau memberi efek pada master.
        </p>
      </section>
      <section aria-labelledby="colors">
        <span className="eyebrow">02 / Warna</span>
        <h2 id="colors">Hangat, dengan ruang untuk bernapas.</h2>
        <div className="swatch-grid">
          {[
            ['Forest', '#142C22'],
            ['Terracotta', '#BC5538'],
            ['Ivory', '#FAF1E6'],
            ['Sand', '#E7CEB7'],
            ['Sage', '#818361'],
          ].map(([name, hex]) => (
            <div className="swatch" key={name}>
              <div className="swatch-color" style={{ background: hex }} />
              <div>
                <strong>{name}</strong>
                <p className="note">{hex}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="note">
          Teks: forest/ivory 13,30:1; muted/ivory 5,89:1; putih/terracotta 4,67:1. Sage dan sand
          dipakai sebagai aksen.
        </p>
      </section>
      <section aria-labelledby="type">
        <span className="eyebrow">03 / Tipografi</span>
        <h2 id="type">Create. Invite. Celebrate.</h2>
        <p>
          Playfair Display untuk judul. Inter untuk isi, form, tabel, dan angka. Keduanya dimuat
          dari aset lokal.
        </p>
        <p className="serif" style={{ fontSize: 32 }}>
          Sebuah cerita, dirayakan bersama.
        </p>
        <p>Nama panjang tetap terbaca: Nadilla Tersayang 🤍 & Muhammad Alexander.</p>
        <p className="note">
          Caption 12–14 px · Body 16 px · Spacing 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 px.
        </p>
      </section>
      <section aria-labelledby="actions">
        <span className="eyebrow">04 / Aksi dan status</span>
        <h2 id="actions">Jelas pada setiap langkah.</h2>
        <Card>
          <div className="row">
            <Button>
              <Plus size={17} />
              Buat undangan
            </Button>
            <Button variant="secondary">Lihat template</Button>
            <Button variant="danger">Hapus aset</Button>
            <Button variant="quiet">Batalkan</Button>
            <Button disabled>Tidak tersedia</Button>
            <Button loading>Menyimpan…</Button>
            <IconButton label="Tutup contoh">
              <X size={18} />
            </IconButton>
            <a className="btn secondary" href="#forms">
              Lihat form <ArrowUpRight size={17} />
            </a>
          </div>
          <p className="note" style={{ marginTop: 20 }}>
            Coba Tab, hover, dan tekan tombol untuk memeriksa focus serta pressed state. Minimum
            target sentuh 44 px.
          </p>
        </Card>
        <div className="row">
          <Badge>Draf</Badge>
          <Badge tone="success">Terbit</Badge>
          <Badge tone="warning">Menunggu pembayaran</Badge>
          <Badge tone="danger">Kedaluwarsa</Badge>
          <Badge tone="info">Sedang ditinjau</Badge>
        </div>
        <Alert tone="success" title="Draf tersimpan">
          Preview dapat diperbarui. Undangan publik belum berubah.
        </Alert>
        <Alert tone="warning" title="Perlu aktivasi">
          Konfirmasi transfer melalui WhatsApp, lalu tunggu pemeriksaan pembayaran.
        </Alert>
        <Alert tone="danger" title="Versi draf berubah">
          Muat ulang versi terbaru sebelum menerapkan proposal Compose.
        </Alert>
        <Alert tone="info" title="Kuota Compose habis">
          Anda tetap dapat melanjutkan melalui editor manual.
        </Alert>
      </section>
      <section aria-labelledby="forms">
        <span className="eyebrow">05 / Form</span>
        <h2 id="forms">Label tetap terlihat.</h2>
        <Card>
          <div className="form-grid">
            <label>
              Judul undangan
              <input defaultValue="Pernikahan Aruna & Bima" />
            </label>
            <label>
              Email
              <input
                type="email"
                defaultValue="email-belum-valid"
                aria-invalid="true"
                aria-describedby="example-error"
              />
              <span className="field-error" id="example-error">
                Gunakan alamat email yang valid.
              </span>
            </label>
            <label>
              Nuansa
              <select defaultValue="ivory">
                <option value="ivory">Ivory</option>
                <option value="sage">Sage</option>
              </select>
            </label>
            <label>
              Paket aktif
              <input value="Starter · Rp49.000" disabled readOnly />
            </label>
            <label className="span-2">
              Cerita Anda
              <textarea
                defaultValue="Berawal dari pertemuan sederhana, menjadi cerita untuk selamanya."
                rows={3}
              />
            </label>
          </div>
          <div className="row" style={{ marginTop: 24 }}>
            <label className="check">
              <input type="checkbox" defaultChecked />
              Tampilkan galeri
            </label>
            <label className="check">
              <input type="radio" name="demo-attend" defaultChecked />
              Hadir
            </label>
            <label className="check">
              <input type="radio" name="demo-attend" />
              Tidak hadir
            </label>
            <label className="check">
              <input type="checkbox" role="switch" defaultChecked />
              Terima ucapan
            </label>
          </div>
        </Card>
        <Tabs
          label="Contoh pilihan editor"
          value={tab}
          onChange={setTab}
          items={[
            { id: 'content', label: 'Isi' },
            { id: 'design', label: 'Desain' },
            { id: 'preview', label: 'Preview' },
          ]}
        />
        <p className="note">
          Mode terpilih: {tab}. Pilihan ditandai dengan teks, garis, dan aria-pressed.
        </p>
      </section>
      <section aria-labelledby="data">
        <span className="eyebrow">06 / Data dan kapasitas</span>
        <h2 id="data">Angka yang berarti.</h2>
        <p className="note">Seluruh nama dan angka pada panduan ini merupakan contoh komponen.</p>
        <div className="stats">
          <StatCard label="Tamu diundang" value={120} icon={<Users size={17} />} />
          <StatCard label="Konfirmasi hadir" value={80} />
          <StatCard label="Ucapan diterima" value={24} icon={<Heart size={17} />} />
          <StatCard label="Undangan terbit" value={1} icon={<Mail size={17} />} />
        </div>
        <Card>
          <UsageMeter label="Foto tersimpan" value={3} max={5} />
          <UsageMeter label="Kuota Compose" value={10} max={10} />
          <div
            className="table-wrap"
            role="region"
            aria-label="Contoh daftar tamu, dapat digeser"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Kehadiran</th>
                  <th>Rombongan</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Nadilla Tersayang 🤍</td>
                  <td>
                    <Badge tone="success">Hadir</Badge>
                  </td>
                  <td>2 orang</td>
                  <td>
                    <Button variant="quiet">Salin tautan contoh</Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="between" style={{ marginTop: 16 }}>
            <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Sebelumnya
            </Button>
            <span className="note" aria-live="polite">
              Halaman {page}
            </span>
            <Button variant="secondary" disabled={page === 2} onClick={() => setPage(page + 1)}>
              Berikutnya
            </Button>
          </div>
        </Card>
      </section>
      <section aria-labelledby="feedback">
        <span className="eyebrow">07 / Feedback dan dialog</span>
        <h2 id="feedback">Selalu ada langkah berikutnya.</h2>
        <div className="form-grid">
          <EmptyState
            title="Album masih kosong"
            icon={<ImagePlus />}
            action={<Button variant="secondary">Pilih foto</Button>}
          >
            Unggah foto pertama untuk melengkapi cerita Anda.
          </EmptyState>
          <Card>
            <Skeleton />
            <div className="upload-progress" role="status">
              Mengunggah aset…
              <div className="progress" aria-hidden="true">
                <span />
              </div>
            </div>
            <p className="note">Indikator tidak menampilkan persentase yang belum dapat diukur.</p>
          </Card>
        </div>
        <Button onClick={() => setModal(true)}>Buka contoh dialog</Button>
        {modal && (
          <Modal title="Bagikan momen istimewa" close={() => setModal(false)}>
            <p>
              Contoh dialog lokal. Tab tetap di dalam dialog, Escape menutup, dan fokus kembali ke
              tombol pembuka.
            </p>
            <label>
              Nama tamu
              <input defaultValue="Nadilla Tersayang 🤍" />
            </label>
            <div className="row" style={{ marginTop: 24 }}>
              <Button variant="secondary" onClick={() => setModal(false)}>
                Tutup contoh
              </Button>
            </div>
          </Modal>
        )}
      </section>
      <section aria-labelledby="workflows">
        <span className="eyebrow">08 / Pola produk</span>
        <h2 id="workflows">Periksa, simpan, lalu bagikan.</h2>
        <div className="form-grid">
          <Card>
            <h3>Ringkasan invoice</h3>
            <p className="serif" style={{ fontSize: 30 }}>
              Rp49.000
            </p>
            <p>Starter · 3 bulan · 150 tamu · 5 foto</p>
            <Badge tone="warning">Menunggu transfer</Badge>
            <p className="note" style={{ marginTop: 16 }}>
              Klik WhatsApp tidak mengaktifkan paket. Operator harus memeriksa chat dan mutasi bank.
            </p>
          </Card>
          <Card>
            <h3>Proposal Compose</h3>
            <p className="chat user">Bantu tulis pembuka yang hangat.</p>
            <dl className="diff">
              <dt>Pembuka</dt>
              <dd>
                Dengan penuh syukur, kami mengundang Anda untuk merayakan awal perjalanan kami.
              </dd>
            </dl>
            <div className="row">
              <Button>Terapkan contoh</Button>
              <Button variant="secondary">Batalkan</Button>
            </div>
          </Card>
        </div>
        <p className="note">
          Kontrol pada panduan ini tidak memanggil API atau mengubah data. Template card, media
          card, invoice dan panel berbagi di produk menggunakan pola serta token yang sama.
        </p>
      </section>
    </>
  );
}
