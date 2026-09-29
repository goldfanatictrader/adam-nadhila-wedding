import { useState } from 'react';
import {
  Save,
  Plus,
  Trash2,
  ArrowUp,
  Monitor,
  Smartphone,
  Paintbrush,
  PencilLine,
  Eye,
} from 'lucide-react';
import { Button } from './ui';
import { templates } from '../lib/catalog';
import type { Content } from '../lib/content';
type Props = {
  event: any;
  draft: Content;
  setDraft: (c: Content) => void;
  template: string;
  setTemplate: (t: string) => void;
  media: any[];
  busy: boolean;
  save: () => void;
  preview: number;
  dirty: boolean;
};
export default function EventEditor({
  event,
  draft: c,
  setDraft: set,
  template,
  setTemplate,
  media,
  busy,
  save,
  preview,
  dirty,
}: Props) {
  const [mobile, setMobile] = useState(true);
  const [mode, setMode] = useState<'content' | 'design' | 'preview'>('content');
  const field = (key: keyof Content, label: string, type = 'text', maxLength = 150) => (
    <label key={key}>
      {label}
      <input
        type={type}
        value={String(c[key])}
        maxLength={maxLength}
        onChange={(e) => set({ ...c, [key]: e.target.value })}
      />
    </label>
  );
  const area = (key: keyof Content, label: string, maxLength = 1500) => (
    <label className="span-2" key={key}>
      {label}
      <textarea
        value={String(c[key])}
        maxLength={maxLength}
        rows={3}
        onChange={(e) => set({ ...c, [key]: e.target.value })}
      />
    </label>
  );
  const image = (key: 'hero' | 'introPhoto' | 'eventPhoto' | 'closingPhoto', label: string) => (
    <label key={key}>
      {label}
      <select value={c[key]} onChange={(e) => set({ ...c, [key]: e.target.value })}>
        <option value="">Tanpa foto</option>
        {media
          .filter((m) => m.kind === 'image')
          .map((m) => (
            <option key={m.id} value={m.id}>
              {m.filename}
            </option>
          ))}
      </select>
    </label>
  );
  return (
    <>
      <div className="editor-modebar">
        <div className="segment-control" role="group" aria-label="Mode editor">
          <button
            type="button"
            aria-pressed={mode === 'content'}
            onClick={() => setMode('content')}
          >
            <PencilLine size={16} />
            Isi
          </button>
          <button type="button" aria-pressed={mode === 'design'} onClick={() => setMode('design')}>
            <Paintbrush size={16} />
            Desain
          </button>
          <button
            type="button"
            aria-pressed={mode === 'preview'}
            onClick={() => setMode('preview')}
          >
            <Eye size={16} />
            Preview
          </button>
        </div>
        <span className="note">
          {dirty ? 'Ada perubahan belum disimpan' : 'Perubahan draf tersimpan'}
        </span>
      </div>
      <div className={`editor-layout ${mode === 'preview' ? 'preview-only' : ''}`} data-mode={mode}>
        <fieldset className="editor-form editor-fields" disabled={busy}>
          <legend className="sr-only">Edit undangan</legend>
          <section className="panel" data-editor-pane="design">
            <h3>Nuansa undangan</h3>
            <div className="form-grid">
              <label>
                Template
                <select value={template} onChange={(e) => setTemplate(e.target.value)}>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Palet warna
                <select
                  value={c.palette}
                  onChange={(e) => set({ ...c, palette: e.target.value as Content['palette'] })}
                >
                  <option value="ivory">Ivory hangat</option>
                  <option value="sage">Sage lembut</option>
                  <option value="terracotta">Terracotta</option>
                </select>
              </label>
              <label>
                Tipografi
                <select
                  value={c.font}
                  onChange={(e) => set({ ...c, font: e.target.value as Content['font'] })}
                >
                  <option value="serif">Serif klasik</option>
                  <option value="modern">Modern</option>
                </select>
              </label>
              <label className="check" style={{ alignSelf: 'end', paddingBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={c.hideBrand}
                  disabled={event.plan === 'starter'}
                  onChange={(e) => set({ ...c, hideBrand: e.target.checked })}
                />
                Sembunyikan branding · Premium
              </label>
            </div>
            <p className="note" style={{ margin: '16px 0 0' }}>
              Pergantian template mempertahankan data. Minimal Ivory menampilkan cerita dalam
              susunan ringkas; Editorial Journey menampilkan bab lengkap.
            </p>
          </section>
          <section className="panel" data-editor-pane="content">
            <h3>Dua nama, satu cerita</h3>
            <div className="form-grid">
              {field('groom', 'Nama panggilan mempelai pria')}
              {field('bride', 'Nama panggilan mempelai wanita')}
              {field('groomFull', 'Nama lengkap mempelai pria')}
              {field('brideFull', 'Nama lengkap mempelai wanita')}
              {area('groomParents', 'Nama orang tua mempelai pria', 300)}
              {area('brideParents', 'Nama orang tua mempelai wanita', 300)}
              {field('groomInstagram', 'Instagram pria · tanpa @', 'text', 50)}
              {field('brideInstagram', 'Instagram wanita · tanpa @', 'text', 50)}
              {area('opening', 'Kalimat pembuka')}
              {area('closing', 'Kalimat penutup')}
            </div>
          </section>
          <section className="panel" data-editor-pane="content">
            <h3>Hari yang dinanti</h3>
            <div className="form-grid">
              {field('eventName', 'Nama acara')}
              {field('date', 'Tanggal acara', 'date')}
              {field('time', 'Waktu mulai', 'time')}
              <label>
                Zona waktu
                <select
                  value={c.timezone}
                  onChange={(e) => set({ ...c, timezone: e.target.value as Content['timezone'] })}
                >
                  <option value="Asia/Jakarta">WIB · Jakarta</option>
                  <option value="Asia/Makassar">WITA · Makassar</option>
                  <option value="Asia/Jayapura">WIT · Jayapura</option>
                </select>
              </label>
              {field('venue', 'Nama tempat')}
              {field('maps', 'Tautan Google Maps', 'url', 1000)}
              {area('address', 'Alamat lengkap', 1000)}
            </div>
          </section>
          <section className="panel" data-editor-pane="content">
            <h3>Foto yang bercerita</h3>
            <p className="note">
              Unggah foto melalui tab Foto & musik, lalu pilih tempatnya di sini.
            </p>
            <div className="form-grid">
              {image('hero', 'Sampul undangan')}
              {image('introPhoto', 'Foto pembuka')}
              {image('eventPhoto', 'Foto pada bagian acara')}
              {image('closingPhoto', 'Foto penutup')}
            </div>
            <div className="separator" />
            <h3>Galeri</h3>
            {c.gallery.map((item, index) => (
              <div key={index} className="row" style={{ marginBottom: 12, alignItems: 'end' }}>
                <label style={{ flex: 1 }}>
                  Foto {index + 1}
                  <select
                    value={item.id}
                    onChange={(e) =>
                      set({
                        ...c,
                        gallery: c.gallery.map((v, i) =>
                          i === index ? { ...v, id: e.target.value } : v,
                        ),
                      })
                    }
                  >
                    <option value="">Pilih foto</option>
                    {media
                      .filter((m) => m.kind === 'image')
                      .map((m) => (
                        <option value={m.id} key={m.id}>
                          {m.filename}
                        </option>
                      ))}
                  </select>
                  <input
                    aria-label={`Deskripsi foto ${index + 1}`}
                    value={item.alt}
                    placeholder="Deskripsi foto"
                    maxLength={200}
                    onChange={(e) =>
                      set({
                        ...c,
                        gallery: c.gallery.map((v, i) =>
                          i === index ? { ...v, alt: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  className="quiet"
                  aria-label="Geser foto ke atas"
                  disabled={index === 0}
                  onClick={() => {
                    const list = [...c.gallery];
                    [list[index - 1], list[index]] = [list[index], list[index - 1]];
                    set({ ...c, gallery: list });
                  }}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="quiet"
                  aria-label="Hapus dari galeri"
                  onClick={() => set({ ...c, gallery: c.gallery.filter((_, i) => i !== index) })}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              className="btn secondary small"
              disabled={c.gallery.length >= 40}
              onClick={() => set({ ...c, gallery: [...c.gallery, { id: '', alt: '' }] })}
            >
              <Plus size={15} />
              Tambah foto galeri
            </button>
          </section>
          <section className="panel" data-editor-pane="content">
            <h3>Bab cerita Anda</h3>
            {c.story.map((story, index) => (
              <div
                className="stack"
                key={index}
                style={{
                  paddingBottom: 20,
                  marginBottom: 20,
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <label>
                  Judul bab {index + 1}
                  <input
                    value={story.title}
                    maxLength={120}
                    onChange={(e) =>
                      set({
                        ...c,
                        story: c.story.map((v, i) =>
                          i === index ? { ...v, title: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Cerita
                  <textarea
                    rows={4}
                    value={story.body}
                    maxLength={1500}
                    onChange={(e) =>
                      set({
                        ...c,
                        story: c.story.map((v, i) =>
                          i === index ? { ...v, body: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Foto bab
                  <select
                    value={story.photo}
                    onChange={(e) =>
                      set({
                        ...c,
                        story: c.story.map((v, i) =>
                          i === index ? { ...v, photo: e.target.value } : v,
                        ),
                      })
                    }
                  >
                    <option value="">Tanpa foto</option>
                    {media
                      .filter((m) => m.kind === 'image')
                      .map((m) => (
                        <option value={m.id} key={m.id}>
                          {m.filename}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  className="quiet link"
                  onClick={() => set({ ...c, story: c.story.filter((_, i) => i !== index) })}
                >
                  Hapus bab
                </button>
              </div>
            ))}
            <button
              className="btn secondary small"
              disabled={c.story.length >= 5}
              onClick={() => set({ ...c, story: [...c.story, { title: '', body: '', photo: '' }] })}
            >
              <Plus size={15} />
              Tambah bab
            </button>
          </section>
          <section className="panel" data-editor-pane="content">
            <h3>Musik pilihan</h3>
            <div className="stack">
              <label>
                Sumber musik
                <select
                  value={c.music.type}
                  onChange={(e) =>
                    set({
                      ...c,
                      music: { ...c.music, type: e.target.value as Content['music']['type'] },
                    })
                  }
                >
                  <option value="none">Tanpa musik</option>
                  <option value="audio">Audio dari library</option>
                  <option value="youtube">YouTube · pemutar terlihat</option>
                </select>
              </label>
              {c.music.type === 'audio' && (
                <label>
                  Pilih MP3
                  <select
                    value={c.music.asset}
                    onChange={(e) => set({ ...c, music: { ...c.music, asset: e.target.value } })}
                  >
                    <option value="">Pilih file musik</option>
                    {media
                      .filter((m) => m.kind === 'audio')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.filename}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {c.music.type === 'youtube' && (
                <label>
                  ID atau tautan video YouTube
                  <input
                    defaultValue={c.music.youtubeId}
                    key={c.music.type}
                    placeholder="https://www.youtube.com/watch?v=…"
                    onBlur={(e) => {
                      let id = e.target.value.trim();
                      try {
                        const u = new URL(id);
                        if (
                          [
                            'www.youtube.com',
                            'youtube.com',
                            'youtu.be',
                            'www.youtube-nocookie.com',
                          ].includes(u.hostname)
                        )
                          id =
                            u.hostname === 'youtu.be'
                              ? u.pathname.slice(1)
                              : u.searchParams.get('v') || u.pathname.split('/').at(-1) || '';
                      } catch {}
                      set({ ...c, music: { ...c.music, youtubeId: id } });
                    }}
                  />
                  <span className="note">
                    Video tampil dan diputar secara manual. Untuk musik latar, pilih file audio.
                  </span>
                </label>
              )}
            </div>
          </section>
          <section className="panel" data-editor-pane="content">
            <h3>Hadiah · opsional</h3>
            {c.gifts.map((gift, index) => (
              <div className="form-grid" key={index} style={{ marginBottom: 20 }}>
                {(['bank', 'number', 'holder'] as const).map((key) => (
                  <label key={key}>
                    {key === 'bank' ? 'Bank' : key === 'number' ? 'Nomor rekening' : 'Nama pemilik'}
                    <input
                      value={gift[key]}
                      onChange={(e) =>
                        set({
                          ...c,
                          gifts: c.gifts.map((v, i) =>
                            i === index ? { ...v, [key]: e.target.value } : v,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
                <button
                  className="quiet link"
                  onClick={() => set({ ...c, gifts: c.gifts.filter((_, i) => i !== index) })}
                >
                  Hapus rekening
                </button>
              </div>
            ))}
            <button
              className="btn secondary small"
              disabled={c.gifts.length >= 4}
              onClick={() =>
                set({ ...c, gifts: [...c.gifts, { bank: '', number: '', holder: '' }] })
              }
            >
              <Plus size={15} />
              Tambah rekening hadiah
            </button>
            <p className="note" style={{ marginTop: 15 }}>
              Rekening hadiah tampil kepada tamu. Pembayaran paket CELEYO memakai rekening bisnis
              pada invoice.
            </p>
          </section>
          <section className="panel" data-editor-pane="content">
            <h3>Susunan modul & pesan tamu</h3>
            <div className="row">
              {(['story', 'gallery', 'gifts'] as const).map((s) => (
                <label className="check" key={s}>
                  <input
                    type="checkbox"
                    checked={c.sections.includes(s)}
                    onChange={(e) =>
                      set({
                        ...c,
                        sections: e.target.checked
                          ? [...c.sections, s]
                          : c.sections.filter((v) => v !== s),
                      })
                    }
                  />
                  {s === 'story' ? 'Cerita' : s === 'gallery' ? 'Galeri' : 'Hadiah'}
                </label>
              ))}
            </div>
            <div style={{ marginTop: 20 }}>
              {area('whatsappMessage', 'Template pesan WhatsApp')}
            </div>
            <p className="note">
              Gunakan {'{nama}'} dan {'{link}'} untuk personalisasi.
            </p>
          </section>
        </fieldset>
        <aside className={`preview-frame ${mobile ? 'mobile' : ''}`}>
          <div className="preview-head">
            <span>PRATINJAU DRAF TERSIMPAN</span>
            <div>
              <button
                className="quiet"
                aria-label="Pratinjau mobile"
                aria-pressed={mobile}
                onClick={() => setMobile(true)}
              >
                <Smartphone size={15} />
              </button>
              <button
                className="quiet"
                aria-label="Pratinjau desktop"
                aria-pressed={!mobile}
                onClick={() => setMobile(false)}
              >
                <Monitor size={15} />
              </button>
            </div>
          </div>
          <iframe
            title="Pratinjau undangan"
            key={preview}
            src={`/app/${event.id}/preview?embed=1`}
            loading="lazy"
          />
          <p className="preview-caption">
            {dirty
              ? 'Preview masih menampilkan draf tersimpan. Simpan perubahan untuk memperbaruinya.'
              : 'Ini pratinjau draf. Publikasi tetap dilakukan melalui tombol Publikasikan.'}
          </p>
        </aside>
      </div>
      <div className="editor-savebar">
        <span>
          {dirty ? 'Belum disimpan' : 'Draf tersimpan'} · perubahan belum mengubah undangan publik.
        </span>
        <Button loading={busy} onClick={save}>
          <Save size={17} />
          {busy ? 'Menyimpan…' : 'Simpan perubahan draf'}
        </Button>
      </div>
    </>
  );
}
