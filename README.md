# INFORMATIKA ADVENTURE — Multi-Device Classroom Game

Platform pembelajaran Informatika berbasis permainan Ular Tangga (*Snakes & Ladders*) secara **realtime multi-device**:
- **Guru (Laptop & Proyektor)**: `/teacher` — membuat sesi, menampilkan kode 6 karakter & QR Code, memantau lobby & Gacha, mengendalikan dadu, giliran, papan permainan, dan statistik.
- **Siswa (HP / Smartphone)**: `/join` — scan QR Code atau masukkan kode sesi, pilih kelas (`XI F-8` / `XI F-9`) & nama resmi dari database, jalankan Gacha kelompok atomik, berdiskusi, dan menjawab pertanyaan bersama tim.

## Menjalankan Aplikasi Secara Lokal

1. Install dependensi:
   ```bash
   npm install
   ```
2. Build frontend & jalankan server (Express + Socket.IO + SQLite):
   ```bash
   npm run build
   npm start
   ```
   Atau untuk mode development:
   ```bash
   npm run dev:server
   npm run dev:client
   ```
3. Buka di browser:
   - **Guru**: `http://localhost:3001/teacher` (Login default: `guru` / `informatika2026`)
   - **Siswa (HP di jaringan Wi-Fi yang sama)**: `http://<IP-LAPTOP>:3001/join` atau scan QR Code di dashboard guru.

## Arsitektur & Keamanan
- **Backend Authoritative**: Seluruh penempatan Gacha (`assignTeamGachaAtomic`), pergerakan pion, validasi giliran, dan penilaian jawaban diproses secara atomik di server (`BEGIN IMMEDIATE` pada SQLite).
- **Role-Based Access**: Siswa hanya menerima token peserta yang terikat pada `session_id` dan `student_id` tertentu, sehingga tidak dapat mengakses sesi lain, mengirim jawaban di luar giliran, atau mengirim jawaban ganda.
- **Supabase Blueprint**: Skema PostgreSQL lengkap beserta Row Level Security (RLS) dan fungsi RPC atomik tersedia di [supabase/schema.sql](supabase/schema.sql).

## Pengujian Multi-Device (Playwright)
```bash
npx playwright test
```
Suite pengujian di `tests/multi-device.spec.ts` mensimulasikan 1 dashboard guru dan 6 HP siswa secara bersamaan untuk menguji login & Gacha konkuren, pencegahan duplikasi identitas, refresh HP, isolasi sesi, penguncian giliran & jawaban ganda, disconnect/reconnect, serta konsistensi hasil akhir.
