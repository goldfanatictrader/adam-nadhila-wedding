# Panduan Berbagi Undangan Adam & Nadhila

Nama penerima dapat diatur melalui tautan undangan. Setiap tamu cukup mendapat tautan dengan nama masing-masing; tidak perlu mengedit atau menerbitkan ulang situs.

## Membuat tautan dengan nama tamu

1. Gunakan alamat dasar `https://adam-nadhila-wedding.pages.dev/`.
2. Tambahkan `?to=` di akhir alamat, diikuti sapaan dan nama lengkap penerima.
3. Encode nama agar karakter seperti spasi, `&`, `+`, `#`, dan emoji tetap terbaca dengan benar. Untuk nama sederhana, ganti spasi dengan `%20`; gunakan contoh di bawah sebagai acuan.
4. Buka tautan untuk memeriksa nama di bawah **Kepada Yth.**, lalu salin tautan tersebut ke pesan WhatsApp.

| Nama yang tampil | Tautan siap salin |
| --- | --- |
| Bapak Budi | `https://adam-nadhila-wedding.pages.dev/?to=Bapak%20Budi` |
| Bapak Budi & Ibu Sari | `https://adam-nadhila-wedding.pages.dev/?to=Bapak%20Budi%20%26%20Ibu%20Sari` |
| Nadilla Tersayang🤍 | `https://adam-nadhila-wedding.pages.dev/?to=Nadilla%20Tersayang%F0%9F%A4%8D` |

Sapaan ikut ditulis dalam nilai `to`, misalnya `Bapak Budi`, `Ibu Sari`, atau `Keluarga Bapak Budi`. Karakter `&` di dalam nama harus menjadi `%26`, tanda `+` menjadi `%2B`, dan `#` menjadi `%23`. Emoji dapat digunakan dengan encoding seperti contoh.

Untuk pembuat tautan yang memakai JavaScript, cara berikut menangani semua karakter secara otomatis. Cukup ganti nilai `namaTamu`:

```js
const namaTamu = "Bapak Budi & Ibu Sari";
const tautan = "https://adam-nadhila-wedding.pages.dev/?to=" + encodeURIComponent(namaTamu);
console.log(tautan);
```

Tautan lama dengan `?guest=` juga didukung. Gunakan satu parameter nama pada setiap tautan. Tanpa nama, situs menampilkan `Bapak/Ibu/Saudara/i`. Nama dibatasi sampai 80 karakter; periksa tampilannya sebelum dibagikan.

## Template pesan WhatsApp

Ganti `[Sapaan dan Nama Tamu]` dan `[Tautan Undangan Personal]`. Nama di pesan harus sama dengan penerima pada tautan. Salin isi blok berikut ke WhatsApp setelah kedua isian diganti.

```text
Assalamualaikum Warahmatullahi Wabarakatuh

Kepada Yth.
[Sapaan dan Nama Tamu]

Dengan memohon ridho dan rahmat Allah SWT, tanpa mengurangi rasa hormat, izinkan kami mengundang Bapak/Ibu/Saudara/i untuk menghadiri acara akad dan syukuran pernikahan kami:

Adam Alfiansyah S.H
&
Nadhila Rachmawati, S.Psi.

Insya Allah akan dilaksanakan pada:
Sabtu, 26 Desember 2026
Pukul 09.00 WIB
Kediaman Mempelai Wanita

Informasi lengkap acara dapat dilihat melalui tautan undangan berikut:
[Tautan Undangan Personal]

Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.

Mohon maaf atas keterbatasan jarak dan waktu. Undangan elektronik ini bersifat resmi dan bernilai sama dengan undangan fisik.

Terima kasih atas perhatian dan doa restu Bapak/Ibu/Saudara/i.

Wassalamualaikum Warahmatullahi Wabarakatuh
```

## Contoh pesan lengkap

```text
Assalamualaikum Warahmatullahi Wabarakatuh

Kepada Yth.
Bapak Budi & Ibu Sari

Dengan memohon ridho dan rahmat Allah SWT, tanpa mengurangi rasa hormat, izinkan kami mengundang Bapak/Ibu/Saudara/i untuk menghadiri acara akad dan syukuran pernikahan kami:

Adam Alfiansyah S.H
&
Nadhila Rachmawati, S.Psi.

Insya Allah akan dilaksanakan pada:
Sabtu, 26 Desember 2026
Pukul 09.00 WIB
Kediaman Mempelai Wanita

Informasi lengkap acara dapat dilihat melalui tautan undangan berikut:
https://adam-nadhila-wedding.pages.dev/?to=Bapak%20Budi%20%26%20Ibu%20Sari

Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.

Mohon maaf atas keterbatasan jarak dan waktu. Undangan elektronik ini bersifat resmi dan bernilai sama dengan undangan fisik.

Terima kasih atas perhatian dan doa restu Bapak/Ibu/Saudara/i.

Wassalamualaikum Warahmatullahi Wabarakatuh
```
