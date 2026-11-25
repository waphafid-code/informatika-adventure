import crypto from 'node:crypto';
import { db } from './db.js';
import { hashPassword } from './auth.js';

const STUDENTS_XI_F8 = [
  'Aira Rahmadani',
  'Aisyah Dwimerfa Putri',
  'Alliqa Milanisti Yunasrun',
  'Amarullah',
  'Angel Mulyadita',
  'Atika Ratifa Nendra',
  'Aura Khairunisa',
  'Aurel Lathifah',
  'Aysyifa Dwi Zulfa',
  'Azzani Alifi Akmal',
  'Busainah Nursyifa',
  'Farrel Aditya',
  'Fellicia Dwi Permata',
  'Habib Alifa Sidiq',
  'Hafiz Septian Ramadhan',
  'Humayra Luthfiana Putri',
  'Hyunda Latifa Jafli',
  'Intan Permata Sari',
  'Jio Shansuke Rofi',
  'Keyla Naswa Sentosa',
  'Keyla Rahmadhani Wijaya',
  'Khayla Delvita Maqfirah',
  'M.farel Aditya',
  'Maidah Fauziah',
  'Muhammad Haikal Yuandi',
  'Mutiara Dasriza',
  'Nabila Aisyah Putri',
  'Najla Humaira Ramadhani',
  'Namia Zhufairah Hamda',
  'Nayra Ananda Putri',
  'Putri Ayudia Herman',
  'Raisa Puan Arisani',
  'Syahira Agna My Ladys',
  'Syarifa Aini',
  'Syifa Indra Aulia Fitri',
  'Tomy Oktaviandri',
  'Zamiko Yudit',
  'Zecky Elfathan',
  'Ziwanna Rhamadani',
  'Marcel Rehan Pratama Bago',
];

const STUDENTS_XI_F9 = [
  'ADITYA DAFA RIADI',
  'ADZRATUL KHAIRANI',
  'AINI CAHYATI ZAHARA',
  'AIRA SWANDI',
  'AKBAR HAKIM MAKARIM',
  'ALIF ZAIDAN ADZKY',
  'ALVA FEBRIANSYAH K',
  'ANANDA KURNIA RAMADHANI',
  'ANNISA KHAIRUL',
  'ANNISA NAELUR RAHMA',
  'ANNISYA LUNA PRATIWI',
  'ARYA TEGUH PANGESTU',
  'FADHIL AL KARIM',
  'FADHLAN DAMIAN FITRA',
  'FATHAN JUANDA PUTRA',
  'GIANINA FATIHA',
  'GUSTI AMELIA RAMADHAN',
  'HANIIFAH ZAHRA',
  'IBRAHIM ANELA',
  'ILHAM ABDUL GHANI',
  'IQBAL HIDAYATUL RAHMAT',
  'JAUZA ATHAYA ALINZI',
  'KRISHNA WICAKSANA',
  'LATHIFATUZ ZAHRA WIRMANEVA',
  'LUFITA NOFELITA',
  'MUHAMMAD FAIZ',
  'MUHAMMAD HAFIS',
  'MUHAMMAD ZIDAN ALFARIZI',
  'MUTIARA ALGHANI HIDAYAT',
  'NINDY ANISA',
  'RAFFA ANANTA PRATAMA',
  'RAISYA ZHAFIRA YENDRI',
  'RAVA SYAHRIZAN',
  'RESYA NISA FAKHIRA ANABEL',
  'RISWANDI',
  'RISYADIL AGMA ALGIFFARI',
  'YUDIREZ AL KENZO',
  'SYAKIRA ATHAYA',
  'RAFI KHAIRY AMRI',
  "Kesya qirratul'aini",
];

const QUESTIONS = [
  // Bagian A: Pilihan Ganda (Nomor 1 - 20)
  {
    id: 'pra-01',
    topic: 'Perancangan Perangkat Keras',
    difficulty: 'Sedang',
    question_text:
      '1. Kamu dan tim kelompokmu mendapat proyek membuat video dokumenter beresolusi 4K lengkap dengan efek visual serta animasi 3D. Agar proses rendering berjalan paralel dan pratinjau video tidak patah-patah, komponen utama yang paling wajib diprioritaskan saat memilih perangkat adalah ....',
    options: {
      A: 'Kapasitas hard disk eksternal berukuran 4 TB',
      B: 'Dedicated GPU dengan kapasitas memori video (VRAM) besar',
      C: 'Layar sentuh dengan lapisan pelindung anti-silau',
      D: 'Papan ketik mekanikal dengan pencahayaan RGB',
      E: 'Kartu jaringan nirkabel untuk koneksi jarak jauh',
    },
    correct_option: 'B',
    xp_reward: 25,
    explanation: 'Kunci: B. Dedicated GPU dengan VRAM besar mempercepat rendering video 4K dan animasi 3D secara paralel.',
  },
  {
    id: 'pra-02',
    topic: 'Perancangan Perangkat Keras',
    difficulty: 'Mudah',
    question_text:
      '2. Laptop milik teman sekelasmu sudah dibekali prosesor bertenaga tinggi dan penyimpanan SSD NVMe super cepat, tetapi kapasitas RAM-nya hanya 4 GB. Ketika ia membuka banyak tab peramban sekaligus menjalankan aplikasi penyuntingan gambar, kinerja laptopnya mendadak melambat drastis. Kondisi ketidakseimbangan komponen ini disebut ....',
    options: {
      A: 'Overclocking prosesor',
      B: 'Packet sniffing',
      C: 'Bottleneck memori',
      D: 'Kalibrasi warna panel',
      E: 'Credential stuffing',
    },
    correct_option: 'C',
    xp_reward: 20,
    explanation: 'Kunci: C. RAM 4 GB membatasi kinerja prosesor dan SSD sehingga terjadi bottleneck memori.',
  },
  {
    id: 'pra-03',
    topic: 'Perancangan Perangkat Keras',
    difficulty: 'Sedang',
    question_text:
      '3. Sebagai anggota seksi publikasi acara pensi sekolah yang bertugas mendesain poster digital dan ilustrasi untuk dicetak menjadi spanduk besar, spesifikasi layar monitor yang paling krusial agar warna di layar tetap konsisten dan akurat saat dicetak adalah ....',
    options: {
      A: 'Panel layar beresolusi rendah agar hemat konsumsi daya',
      B: 'Ukuran layar melengkung di atas 32 inci tanpa kalibrasi',
      C: 'Tingkat akurasi warna tinggi dengan standar 100% sRGB atau DCI-P3',
      D: 'Fitur kecerahan layar otomatis yang berubah mengikuti cahaya ruang',
      E: 'Layar mengilap dengan tingkat kontras rendah',
    },
    correct_option: 'C',
    xp_reward: 25,
    explanation: 'Kunci: C. Standar 100% sRGB atau DCI-P3 memastikan akurasi warna layar konsisten dengan hasil cetak.',
  },
  {
    id: 'pra-04',
    topic: 'Perancangan Perangkat Keras',
    difficulty: 'Mudah',
    question_text:
      '4. Tim jurnalistik sekolah sering meliput perlombaan di lapangan terbuka yang jauh dari stopkontak listrik dan harus segera mengetik berita di lokasi. Spesifikasi perangkat yang paling sesuai dengan lingkungan kerja mereka adalah ....',
    options: {
      A: 'Komputer meja (PC tower) berdaya besar dengan sistem pendingin cair',
      B: 'Perangkat ringan dengan daya tahan baterai awet untuk mobilitas tinggi',
      C: 'Komputer workstation khusus animasi 3D berbobot berat',
      D: 'Monitor eksternal ganda yang bergantung penuh pada listrik PLN',
      E: 'Perangkat rakitan tanpa baterai internal dengan kipas berkecepatan tinggi',
    },
    correct_option: 'B',
    xp_reward: 20,
    explanation: 'Kunci: B. Mobilitas lapangan membutuhkan perangkat ringan dan baterai awet.',
  },
  {
    id: 'pra-05',
    topic: 'Keamanan Jaringan',
    difficulty: 'Sedang',
    question_text:
      '5. Saat mengirimkan berkas tugas akhir Informatika melalui jaringan lokal sekolah, kamu memastikan bahwa isi dokumen tidak diubah atau dimanipulasi oleh siapa pun selama proses pengiriman berlangsung. Dalam konsep keamanan informasi CIA Triad, prinsip yang sedang kamu terapkan adalah ....',
    options: {
      A: 'Confidentiality (Kerahasiaan)',
      B: 'Availability (Ketersediaan)',
      C: 'Integrity (Keutuhan Data)',
      D: 'Portability (Portabilitas)',
      E: 'Restorative (Pemulihan)',
    },
    correct_option: 'C',
    xp_reward: 25,
    explanation: 'Kunci: C. Integrity menjamin data tetap utuh dan tidak dimanipulasi selama transmisi.',
  },
  {
    id: 'pra-06',
    topic: 'Keamanan Jaringan',
    difficulty: 'Sedang',
    question_text:
      '6. Ketika mengerjakan tugas kelompok di kafe menggunakan jaringan Wi-Fi gratis tanpa kata sandi, kamu sangat dilarang membuka layanan perbankan bergerak (mobile banking). Ancaman utama pada jaringan Wi-Fi publik terbuka yang tidak mengenkripsi lalu lintas data adalah penyadapan informasi sensitif melalui teknik ....',
    options: {
      A: 'Brute force',
      B: 'Packet sniffing',
      C: 'SIM swap attack',
      D: 'Doxxing',
      E: 'Escrow system',
    },
    correct_option: 'B',
    xp_reward: 25,
    explanation: 'Kunci: B. Packet sniffing menyadap paket data yang lewat di jaringan publik tidak terenkripsi.',
  },
  {
    id: 'pra-07',
    topic: 'Keamanan Jaringan',
    difficulty: 'Mudah',
    question_text:
      '7. Sebelum masuk ke akun digital melalui peramban web, kamu mengecek adanya ikon gembok pada bilah alamat yang menandakan situs memakai protokol HTTPS. Protokol enkripsi SSL/TLS pada HTTPS melindungi pertukaran data dengan cara ....',
    options: {
      A: 'Menghapus seluruh riwayat penjelajahan setiap sepuluh detik',
      B: 'Mengubah teks polos (plaintext) menjadi kode sandi acak (ciphertext)',
      C: 'Memblokir semua gambar beresolusi tinggi agar halaman ringan',
      D: 'Menyimpan kata sandi pengguna secara terbuka di peladen publik',
      E: 'Memutus koneksi internet secara otomatis saat mengunduh dokumen',
    },
    correct_option: 'B',
    xp_reward: 20,
    explanation: 'Kunci: B. SSL/TLS mengenkripsi plaintext menjadi ciphertext selama komunikasi.',
  },
  {
    id: 'pra-08',
    topic: 'Keamanan Jaringan',
    difficulty: 'Mudah',
    question_text:
      '8. Dalam kondisi mendesak, kamu terpaksa terhubung ke jaringan internet publik untuk mengakses data penting sekolah. Fitur keamanan jaringan paling tepat yang membentuk terowongan komunikasi terenkripsi guna membungkus seluruh lalu lintas data perangkatmu adalah ....',
    options: {
      A: 'Mematikan kata sandi layar kunci ponsel',
      B: 'Mengaktifkan Virtual Private Network (VPN) tepercaya',
      C: 'Membuka akses berbagi berkas ke semua pengguna jaringan',
      D: 'Menggunakan situs web berprotokol HTTP tanpa enkripsi',
      E: 'Menonaktifkan perlindungan firewall pada laptop',
    },
    correct_option: 'B',
    xp_reward: 20,
    explanation: 'Kunci: B. VPN membentuk terowongan terenkripsi untuk melindungi lalu lintas data di jaringan publik.',
  },
  {
    id: 'pra-09',
    topic: 'Hukum & Etika Digital',
    difficulty: 'Mudah',
    question_text:
      '9. Karena kesal setelah kalah bermain gim daring, seorang remaja menyebarkan foto kartu pelajar, nomor telepon pribadi, dan alamat rumah lawannya ke media sosial tanpa izin untuk mempermalukan korban. Tindakan pelanggaran privasi yang dapat dijerat sanksi UU ITE ini disebut ....',
    options: {
      A: 'Flaming',
      B: 'Doxxing',
      C: 'Packet sniffing',
      D: 'Rendering',
      E: 'Escrow',
    },
    correct_option: 'B',
    xp_reward: 20,
    explanation: 'Kunci: B. Doxxing adalah penyebaran data pribadi seseorang tanpa izin untuk mempermalukan/mengintimidasi.',
  },
  {
    id: 'pra-10',
    topic: 'Hukum & Etika Digital',
    difficulty: 'Sedang',
    question_text:
      '10. Apabila seorang pelajar kelas XI yang masih berusia 16 tahun (di bawah 18 tahun) tersandung perkara hukum akibat pelanggaran di ruang digital, proses penanganannya berpedoman pada Undang-Undang Sistem Peradilan Pidana Anak (UU SPPA) yang mengutamakan ....',
    options: {
      A: 'Hukuman kurungan maksimal setara pelaku dewasa',
      B: 'Publikasi identitas lengkap pelajar di seluruh media sosial',
      C: 'Pendekatan diversi dan keadilan restoratif yang berfokus pada musyawarah serta pembinaan anak',
      D: 'Penghapusan seluruh catatan akademik pelajar di sekolah',
      E: 'Penyitaan seluruh perangkat elektronik milik keluarga besar',
    },
    correct_option: 'C',
    xp_reward: 25,
    explanation: 'Kunci: C. UU SPPA mengutamakan diversi dan keadilan restoratif bagi anak di bawah 18 tahun.',
  },
  {
    id: 'pra-11',
    topic: 'Hukum & Etika Digital',
    difficulty: 'Mudah',
    question_text:
      '11. Grup percakapan kelasmu mendadak ramai oleh pesan berantai berisi berita sensasional tanpa sumber resmi yang jelas. Langkah etis pertama yang wajib kamu lakukan sesuai prinsip saring sebelum sharing adalah ....',
    options: {
      A: 'Segera meneruskan pesan ke grup angkatan agar teman lain ikut panik',
      B: 'Mengunggah tangkapan layar pesan tersebut ke cerita media sosial',
      C: 'Memeriksa kebenaran fakta (cek fakta) terlebih dahulu sebelum membagikannya',
      D: 'Menambahkan judul provokatif agar pesan makin menarik dibaca',
      E: 'Mengirim ulang pesan yang sama berkali-kali ke kontak pribadi guru',
    },
    correct_option: 'C',
    xp_reward: 20,
    explanation: 'Kunci: C. Prinsip saring sebelum sharing mewajibkan cek fakta sebelum menyebarkan informasi.',
  },
  {
    id: 'pra-12',
    topic: 'Hukum & Etika Digital',
    difficulty: 'Mudah',
    question_text:
      '12. Di kolom komentar sebuah unggahan publik, beberapa pengguna sengaja melontarkan kata-kata kasar, penghinaan, dan komentar bernada marah untuk memancing emosi pengguna lain agar terjadi pertengkaran. Perilaku provokatif di ruang digital ini dikenal dengan istilah ....',
    options: {
      A: 'Flaming',
      B: 'Diversi',
      C: 'Enkripsi',
      D: 'Bottleneck',
      E: 'Verifikasi',
    },
    correct_option: 'A',
    xp_reward: 20,
    explanation: 'Kunci: A. Flaming adalah komentar kasar/provokatif yang memancing emosi di ruang digital.',
  },
  {
    id: 'pra-13',
    topic: 'Manajemen Kredensial',
    difficulty: 'Mudah',
    question_text:
      '13. Agar akun surel dan media sosialmu tangguh menghadapi serangan tebakan otomatis (brute force), kriteria kata sandi kuat yang paling direkomendasikan adalah ....',
    options: {
      A: 'Nama panggilan diikuti tanggal lahir agar tidak mudah lupa',
      B: 'Deretan angka berurutan seperti 1234567890',
      C: 'Panjang minimal 12 hingga 16 karakter acak yang memadukan huruf kapital, huruf kecil, angka, dan simbol',
      D: 'Kata sandi pendek maksimal 8 karakter yang dipakai untuk semua akun',
      E: 'Nama kelas dan nama sekolah tanpa tambahan angka maupun simbol',
    },
    correct_option: 'C',
    xp_reward: 20,
    explanation: 'Kunci: C. Sandi kuat minimal 12–16 karakter acak kombinasi huruf besar, kecil, angka, dan simbol.',
  },
  {
    id: 'pra-14',
    topic: 'Manajemen Kredensial',
    difficulty: 'Sedang',
    question_text:
      '14. Penggunaan Aplikasi Authenticator dinilai jauh lebih aman dibandingkan SMS OTP untuk autentikasi dua langkah. Alasan utama Aplikasi Authenticator kebal terhadap pembajakan kartu SIM (SIM swap attack) adalah ....',
    options: {
      A: 'Kode OTP dikirim melalui pesan langsung di media sosial',
      B: 'Kode verifikasi dibuat secara lokal di dalam perangkat berbasis waktu tanpa bergantung pada jaringan operator seluler',
      C: 'Kode verifikasi tidak pernah berubah selama akun masih aktif',
      D: 'Aplikasi tidak memerlukan koneksi internet maupun sinkronisasi waktu',
      E: 'Kode verifikasi dikirimkan ke nomor telepon anggota keluarga',
    },
    correct_option: 'B',
    xp_reward: 25,
    explanation: 'Kunci: B. Aplikasi Authenticator membuat kode TOTP secara lokal tanpa jaringan operator seluler.',
  },
  {
    id: 'pra-15',
    topic: 'Manajemen Kredensial',
    difficulty: 'Mudah',
    question_text:
      '15. Memakai satu kata sandi yang sama di banyak situs web membuat seluruh akunmu terancam apabila satu situs mengalami kebocoran data. Solusi paling aman untuk membuat kata sandi unik yang rumit bagi tiap layanan sekaligus menyimpannya secara terenkripsi adalah memakai ....',
    options: {
      A: 'Aplikasi catatan terbuka tanpa kata sandi utama',
      B: 'Aplikasi Password Manager dengan brankas digital terenkripsi',
      C: 'Pesan tersimpan pada aplikasi obrolan daring',
      D: 'Sandi pendek yang mudah ditebak oleh kamus kata',
      E: 'Foto catatan sandi yang disimpan di galeri ponsel',
    },
    correct_option: 'B',
    xp_reward: 20,
    explanation: 'Kunci: B. Password Manager menyimpan kata sandi unik di brankas digital terenkripsi.',
  },
  {
    id: 'pra-16',
    topic: 'Manajemen Kredensial',
    difficulty: 'Sedang',
    question_text:
      '16. Kamu mendadak menerima peringatan keamanan bahwa ada aktivitas masuk (login) mencurigakan dari kota lain pada akun surel utamamu. Langkah tanggap darurat pertama yang wajib segera kamu lakukan adalah ....',
    options: {
      A: 'Membiarkan pemberitahuan tersebut selama beberapa hari',
      B: 'Mengunggah informasi kata sandi lama ke forum diskusi daring',
      C: 'Segera mengganti kata sandi, memutus seluruh sesi perangkat aktif (logout all devices), dan memastikan 2FA aktif',
      D: 'Menghapus aplikasi surel dari ponsel tanpa mengganti kata sandi',
      E: 'Menonaktifkan seluruh fitur keamanan dua langkah agar mudah masuk',
    },
    correct_option: 'C',
    xp_reward: 25,
    explanation: 'Kunci: C. Ganti sandi, logout semua sesi perangkat aktif, dan aktifkan 2FA.',
  },
  {
    id: 'pra-17',
    topic: 'Transaksi Daring',
    difficulty: 'Mudah',
    question_text:
      '17. Saat berbelanja kebutuhan sekolah melalui loka pasar (marketplace), uang yang kamu transfer tidak langsung diterima penjual, melainkan ditahan sementara oleh sistem hingga paket tiba dan kamu pastikan sesuai pesanan. Mekanisme pengamanan transaksi ini disebut ....',
    options: {
      A: 'Packet sniffing',
      B: 'Sistem Rekening Bersama (Escrow System)',
      C: 'Access Control List',
      D: 'Man-in-the-Middle',
      E: 'Credential stuffing',
    },
    correct_option: 'B',
    xp_reward: 20,
    explanation: 'Kunci: B. Sistem Rekening Bersama (Escrow) menahan dana hingga barang diterima sesuai pesanan.',
  },
  {
    id: 'pra-18',
    topic: 'Transaksi Daring',
    difficulty: 'Sedang',
    question_text:
      '18. Kamu menerima pesan singkat dari nomor tidak dikenal yang mengaku sebagai kurir paket dan memintamu mengunduh berkas bernama Cek_Foto_Paket.APK. Bahaya utama di balik berkas aplikasi tidak resmi berakhiran .APK tersebut adalah ....',
    options: {
      A: 'Merupakan perangkat lunak berbahaya (malware) yang dirancang untuk mencuri data pribadi dan menyadap SMS berisi kode OTP perbankan',
      B: 'Membuat baterai ponsel terisi penuh secara otomatis tanpa pengisi daya',
      C: 'Mengubah resolusi layar monitor menjadi standar 100% sRGB',
      D: 'Meningkatkan kapasitas memori RAM ponsel secara permanen',
      E: 'Mengaktifkan terowongan enkripsi VPN secara otomatis',
    },
    correct_option: 'A',
    xp_reward: 25,
    explanation: 'Kunci: A. Berkas .APK palsu adalah malware pencuri data pribadi dan penyadap SMS OTP perbankan.',
  },
  {
    id: 'pra-19',
    topic: 'Transaksi Daring',
    difficulty: 'Mudah',
    question_text:
      '19. Sebuah akun media sosial menawarkan ponsel pintar baru dengan diskon hingga 70% tanpa alasan jelas, tetapi penjual memaksa pembeli mentransfer dana langsung ke rekening pribadi di luar aplikasi resmi. Hal ini merupakan tanda bahaya (red flag) penipuan karena ....',
    options: {
      A: 'Pembeli akan menerima dua unit barang sekaligus',
      B: 'Transaksi langsung ke rekening pribadi menghilangkan perlindungan sistem rekening bersama (escrow)',
      C: 'Rekening pribadi penjual selalu diawasi otomatis oleh aplikasi loka pasar',
      D: 'Diskon besar selalu menandakan barang berasal dari distributor resmi',
      E: 'Pengiriman di luar aplikasi tidak membutuhkan alamat tujuan pembeli',
    },
    correct_option: 'B',
    xp_reward: 20,
    explanation: 'Kunci: B. Transfer langsung ke rekening pribadi menghilangkan perlindungan rekening bersama (escrow).',
  },
  {
    id: 'pra-20',
    topic: 'Transaksi Daring',
    difficulty: 'Mudah',
    question_text:
      '20. Sebelum mentransfer uang ke nomor rekening penjual yang mencurigakan, maupun ketika ingin melaporkan rekening yang terindikasi melakukan penipuan daring, layanan resmi pemerintah Indonesia yang dapat kamu akses adalah situs ....',
    options: {
      A: 'CekRekening.id',
      B: 'CekPaketKurir.id',
      C: 'SandiKuat.go.id',
      D: 'LayarWarna.id',
      E: 'BebasHoaksKelas.id',
    },
    correct_option: 'A',
    xp_reward: 20,
    explanation: 'Kunci: A. CekRekening.id adalah layanan resmi untuk mengecek dan melaporkan rekening penipuan.',
  },

  // Bagian B: Benar atau Salah (Nomor 21 - 30)
  {
    id: 'pra-21',
    topic: 'Benar/Salah • Perangkat Keras',
    difficulty: 'Mudah',
    question_text:
      '21. (Benar/Salah) Sistem pendingin (cooling system) pada perangkat komputer editor video 4K dan animator 3D berfungsi mencegah panas berlebih saat proses rendering berlangsung.',
    options: { A: 'Benar', B: 'Salah' },
    correct_option: 'A',
    xp_reward: 15,
    explanation: 'Kunci: Benar. Cooling system menjaga suhu komponen tetap stabil saat rendering berat.',
  },
  {
    id: 'pra-22',
    topic: 'Benar/Salah • Perangkat Keras',
    difficulty: 'Mudah',
    question_text:
      '22. (Benar/Salah) Penggunaan penyimpanan SSD NVMe super cepat sudah cukup untuk menghindari bottleneck memori meskipun kapasitas RAM komputer hanya 4 GB saat membuka banyak aplikasi berat sekaligus.',
    options: { A: 'Benar', B: 'Salah' },
    correct_option: 'B',
    xp_reward: 15,
    explanation: 'Kunci: Salah. SSD NVMe tidak menggantikan kapasitas RAM; RAM 4 GB tetap menyebabkan bottleneck memori.',
  },
  {
    id: 'pra-23',
    topic: 'Benar/Salah • Keamanan Jaringan',
    difficulty: 'Mudah',
    question_text:
      '23. (Benar/Salah) Serangan Man-in-the-Middle terjadi ketika pelaku menyusup di antara komunikasi pengguna dan server untuk mengubah isi pesan yang sedang dikirim.',
    options: { A: 'Benar', B: 'Salah' },
    correct_option: 'A',
    xp_reward: 15,
    explanation: 'Kunci: Benar. Man-in-the-Middle menyusup di tengah komunikasi untuk menyadap/mengubah pesan.',
  },
  {
    id: 'pra-24',
    topic: 'Benar/Salah • Keamanan Jaringan',
    difficulty: 'Mudah',
    question_text:
      '24. (Benar/Salah) Aturan penyaringan paket pada Firewall (Access Control List) digunakan untuk menjaga akurasi warna layar monitor pada komputer desainer grafis.',
    options: { A: 'Benar', B: 'Salah' },
    correct_option: 'B',
    xp_reward: 15,
    explanation: 'Kunci: Salah. Firewall (ACL) menyaring lalu lintas jaringan, bukan akurasi warna layar.',
  },
  {
    id: 'pra-25',
    topic: 'Benar/Salah • Hukum Digital',
    difficulty: 'Mudah',
    question_text:
      '25. (Benar/Salah) Menyebarkan foto kartu identitas, nomor telepon, dan alamat rumah teman ke media sosial tanpa izin untuk mempermalukannya termasuk pelanggaran privasi yang dapat dijerat sanksi UU ITE.',
    options: { A: 'Benar', B: 'Salah' },
    correct_option: 'A',
    xp_reward: 15,
    explanation: 'Kunci: Benar. Tindakan doxxing melanggar privasi dan dapat dijerat sanksi UU ITE.',
  },
  {
    id: 'pra-26',
    topic: 'Benar/Salah • Hukum Digital',
    difficulty: 'Mudah',
    question_text:
      '26. (Benar/Salah) Pendekatan diversi dan keadilan restoratif dalam UU SPPA bertujuan menangani perkara hukum anak di bawah usia 18 tahun melalui musyawarah serta pembinaan.',
    options: { A: 'Benar', B: 'Salah' },
    correct_option: 'A',
    xp_reward: 15,
    explanation: 'Kunci: Benar. UU SPPA berfokus pada diversi, musyawarah, dan pembinaan anak.',
  },
  {
    id: 'pra-27',
    topic: 'Benar/Salah • Manajemen Kredensial',
    difficulty: 'Mudah',
    question_text:
      '27. (Benar/Salah) Kata sandi tunggal pendek (≤ 8 karakter) yang dipakai berulang di berbagai layanan memiliki tingkat keamanan rendah karena mudah ditembus serangan kamus dan credential stuffing.',
    options: { A: 'Benar', B: 'Salah' },
    correct_option: 'A',
    xp_reward: 15,
    explanation: 'Kunci: Benar. Sandi pendek dan berulang rentan serangan kamus serta credential stuffing.',
  },
  {
    id: 'pra-28',
    topic: 'Benar/Salah • Manajemen Kredensial',
    difficulty: 'Mudah',
    question_text:
      '28. (Benar/Salah) SMS OTP memiliki tingkat keamanan lebih tinggi dibanding Aplikasi Authenticator karena kode dikirim lewat operator seluler sehingga kebal terhadap SIM swap attack.',
    options: { A: 'Benar', B: 'Salah' },
    correct_option: 'B',
    xp_reward: 15,
    explanation: 'Kunci: Salah. SMS OTP justru rentan terhadap SIM swap attack, sedangkan Aplikasi Authenticator kebal.',
  },
  {
    id: 'pra-29',
    topic: 'Benar/Salah • Transaksi Daring',
    difficulty: 'Mudah',
    question_text:
      '29. (Benar/Salah) Dalam sistem rekening bersama (escrow) di loka pasar, dana pembayaran pembeli langsung diteruskan ke penjual saat itu juga sebelum barang dikirim.',
    options: { A: 'Benar', B: 'Salah' },
    correct_option: 'B',
    xp_reward: 15,
    explanation: 'Kunci: Salah. Dana ditahan sementara oleh sistem escrow hingga barang diterima sesuai pesanan.',
  },
  {
    id: 'pra-30',
    topic: 'Benar/Salah • Transaksi Daring',
    difficulty: 'Mudah',
    question_text:
      '30. (Benar/Salah) Pelaporan nomor rekening terindikasi penipuan daring melalui situs CekRekening.id perlu dilengkapi dengan bukti transaksi yang sah.',
    options: { A: 'Benar', B: 'Salah' },
    correct_option: 'A',
    xp_reward: 15,
    explanation: 'Kunci: Benar. Pelaporan di CekRekening.id memerlukan bukti transaksi yang sah.',
  },
];

export function seedDatabase() {
  // 1. Default teacher account
  const existingTeacher = db.prepare('SELECT id FROM teacher_accounts WHERE username = ?').get('guru');
  if (!existingTeacher) {
    db.prepare(
      'INSERT INTO teacher_accounts (id, username, password_hash, display_name) VALUES (?, ?, ?, ?)'
    ).run('teacher-dewi', 'guru', hashPassword('informatika2026'), 'Pipit Khofifah');
  } else {
    db.prepare('UPDATE teacher_accounts SET display_name = ? WHERE username = ?').run(
      'Pipit Khofifah',
      'guru'
    );
  }

  // 2. Classes
  const classes = [
    { id: 'cls-xi-f8', name: 'XI F-8', grade: 'XI' },
    { id: 'cls-xi-f9', name: 'XI F-9', grade: 'XI' },
  ];
  const insertClass = db.prepare('INSERT OR IGNORE INTO classes (id, name, grade) VALUES (?, ?, ?)');
  for (const c of classes) {
    insertClass.run(c.id, c.name, c.grade);
  }

  // 3. Students (upsert exact names from official PDF)
  const insertStudent = db.prepare(`
    INSERT INTO students (id, class_id, full_name, nisn)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET full_name = excluded.full_name
  `);
  STUDENTS_XI_F8.forEach((name, idx) => {
    const id = `stu-f8-${String(idx + 1).padStart(2, '0')}`;
    const nisn = `202608${String(idx + 1).padStart(3, '0')}`;
    insertStudent.run(id, 'cls-xi-f8', name, nisn);
  });
  STUDENTS_XI_F9.forEach((name, idx) => {
    const id = `stu-f9-${String(idx + 1).padStart(2, '0')}`;
    const nisn = `202609${String(idx + 1).padStart(3, '0')}`;
    insertStudent.run(id, 'cls-xi-f9', name, nisn);
  });

  // 4. Question bank (remove unused legacy sample questions if any, then upsert official Pra-ASAS questions)
  db.prepare(`
    DELETE FROM question_bank
    WHERE id LIKE 'q-%'
      AND id NOT IN (SELECT question_id FROM game_turns WHERE question_id IS NOT NULL)
      AND id NOT IN (SELECT current_question_id FROM game_state WHERE current_question_id IS NOT NULL)
  `).run();

  const insertQuestion = db.prepare(`
    INSERT INTO question_bank
    (id, topic, difficulty, question_text, options_json, correct_option, xp_reward, explanation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      topic = excluded.topic,
      difficulty = excluded.difficulty,
      question_text = excluded.question_text,
      options_json = excluded.options_json,
      correct_option = excluded.correct_option,
      xp_reward = excluded.xp_reward,
      explanation = excluded.explanation
  `);
  for (const q of QUESTIONS) {
    insertQuestion.run(
      q.id,
      q.topic,
      q.difficulty,
      q.question_text,
      JSON.stringify(q.options),
      q.correct_option,
      q.xp_reward,
      q.explanation
    );
  }
}

export function generateSessionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
}
