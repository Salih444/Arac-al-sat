const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(cors());

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'alim_satim_db',
    password: '1234',
    port: 5432,
});

// --- KAYIT & GİRİŞ ---
app.post('/api/auth/register', async(req, res) => {
    const { name, email, password, phone } = req.body;
    try {
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) return res.status(400).json({ message: 'Bu e-posta zaten kayıtlı.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await pool.query(
            'INSERT INTO users (name, email, password, phone, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, phone, role, profile_image', [name, email, hashedPassword, phone, 'user']
        );
        res.status(201).json({ message: 'Kayıt başarılı', user: newUser.rows[0] });
    } catch (err) {
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

app.post('/api/auth/login', async(req, res) => {
    const { email, password } = req.body;
    try {
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) return res.status(400).json({ message: 'Kullanıcı bulunamadı!' });

        const isPasswordValid = await bcrypt.compare(password, user.rows[0].password);
        if (!isPasswordValid) return res.status(400).json({ message: 'Hatalı şifre!' });

        res.json({
            message: 'Giriş başarılı!',
            user: {
                id: user.rows[0].id,
                name: user.rows[0].name,
                email: user.rows[0].email,
                phone: user.rows[0].phone,
                role: user.rows[0].role,
                profile_image: user.rows[0].profile_image
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Sunucu hatası!' });
    }
});

// --- KULLANICI BİLGİSİNİ GETİR ---
app.get('/api/users/:id', async(req, res) => {
    try {
        const user = await pool.query('SELECT id, name, email, phone, role, profile_image FROM users WHERE id = $1', [req.params.id]);
        if (user.rows.length === 0) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
        res.json(user.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

// --- KULLANICI ARAMA (İsimle) ---
app.get('/api/users/search/:query', async(req, res) => {
    try {
        const { query } = req.params;
        const result = await pool.query(
            'SELECT id, name, email, profile_image FROM users WHERE LOWER(name) LIKE LOWER($1) LIMIT 10', [`%${query}%`]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

// --- KULLANICI PROFİLİ VE İLANLARI ---
app.get('/api/users/profile/:id', async(req, res) => {
    try {
        const userId = req.params.id;
        const userResult = await pool.query('SELECT id, name, email, phone, role, profile_image FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

        const listingsResult = await pool.query('SELECT * FROM listings WHERE user_id = $1 AND status = \'Aktif\' ORDER BY created_at DESC', [userId]);

        res.json({
            user: userResult.rows[0],
            listings: listingsResult.rows
        });
    } catch (err) {
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

// --- PROFİL GÜNCELLEME ---
app.put('/api/users/:id', async(req, res) => {
    const { id } = req.params;
    const { name, email, phone, profile_image } = req.body;
    try {
        const updated = await pool.query(
            'UPDATE users SET name = $1, email = $2, phone = $3, profile_image = $4 WHERE id = $5 RETURNING id, name, email, phone, role, profile_image', [name, email, phone, profile_image, id]
        );
        res.json({ message: 'Profil güncellendi', user: updated.rows[0] });
    } catch (err) {
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

// --- ARKADAŞLIK SİSTEMİ ---
app.get('/api/friends/:user_id', async(req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.name, u.email, u.profile_image, u.phone 
             FROM friendships f 
             JOIN users u ON (f.friend_id = u.id OR f.user_id = u.id) 
             WHERE (f.user_id = $1 OR f.friend_id = $1) AND u.id != $1`, [req.params.user_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.json([]);
    }
});

app.post('/api/friends', async(req, res) => {
    const { user_id, friend_id } = req.body;
    if (user_id === friend_id) return res.status(400).json({ message: 'Kendinizi ekleyemezsiniz.' });
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS friendships (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                friend_id INT REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const check = await pool.query(
            'SELECT * FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)', [user_id, friend_id]
        );
        if (check.rows.length > 0) return res.status(400).json({ message: 'Zaten arkadaşsınız.' });

        await pool.query('INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2)', [user_id, friend_id]);
        res.status(201).json({ message: 'Arkadaş eklendi' });
    } catch (err) {
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

app.delete('/api/friends/:user_id/:friend_id', async(req, res) => {
    const { user_id, friend_id } = req.params;
    try {
        await pool.query(
            'DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)', [user_id, friend_id]
        );
        res.json({ message: 'Arkadaşlıktan çıkarıldı' });
    } catch (err) {
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

// --- İLANLAR ---
app.get('/api/listings', async(req, res) => {
    try {
        const { brand, model, city, user_id } = req.query;
        let query = `SELECT l.*, u.name as owner_name, u.phone as owner_phone, u.profile_image as owner_avatar 
                     FROM listings l JOIN users u ON l.user_id = u.id WHERE 1=1`;
        let values = [];
        let index = 1;

        if (user_id) {
            query += ` AND l.user_id = $${index++}`;
            values.push(user_id);
        } else {
            query += ` AND l.status = 'Aktif'`;
        }

        if (brand) {
            query += ` AND LOWER(l.brand) = LOWER($${index++})`;
            values.push(brand);
        }
        if (model) {
            query += ` AND LOWER(l.model) LIKE LOWER($${index++})`;
            values.push(`%${model}%`);
        }
        if (city) {
            query += ` AND LOWER(l.city) = LOWER($${index++})`;
            values.push(city);
        }

        query += ' ORDER BY l.is_featured DESC, l.created_at DESC';

        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

app.post('/api/listings', async(req, res) => {
    const data = req.body;
    try {
        const photosArray = Array.isArray(data.photos) ? data.photos : [];
        const newListing = await pool.query(
            `INSERT INTO listings (
                user_id, title, brand, model, year, fuel_type, gear_type,
                condition_type, kilometer, body_type, engine_power, engine_capacity,
                drive_type, color, damage_record, seller_type, exchangeable,
                price, city, district, description, photos, show_phone, status, is_featured
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, 'Aktif', FALSE) 
            RETURNING *`, [
                data.user_id, data.title || '', data.brand || '', data.model || '', data.year || 2024,
                data.fuel_type || 'Benzin', data.gear_type || 'Otomatik', data.condition_type || 'İkinci El',
                data.kilometer || 0, data.body_type || 'Sedan', data.engine_power || '150 HP',
                data.engine_capacity || '1600 cc', data.drive_type || 'Önden Çekiş', data.color || 'Beyaz',
                data.damage_record || 'Boyasız', data.seller_type || 'Sahibinden', data.exchangeable || false,
                data.price || 0, data.city || 'İstanbul', data.district || 'Kadıköy', data.description || '',
                photosArray, data.show_phone !== undefined ? data.show_phone : true
            ]
        );
        res.status(201).json({ message: 'İlan oluşturuldu', listing: newListing.rows[0] });
    } catch (err) {
        res.status(500).json({ message: 'Sunucu Hatası', error: err.message });
    }
});

app.put('/api/listings/:id', async(req, res) => {
    const { id } = req.params;
    const data = req.body;
    try {
        const updated = await pool.query(
            `UPDATE listings SET title=$1, brand=$2, model=$3, year=$4, fuel_type=$5, gear_type=$6,
             condition_type=$7, kilometer=$8, body_type=$9, engine_power=$10, engine_capacity=$11,
             drive_type=$12, color=$13, damage_record=$14, seller_type=$15, exchangeable=$16,
             price=$17, city=$18, district=$19, description=$20, photos=$21, show_phone=$22, status=$23, is_featured=$24 WHERE id=$25 RETURNING *`, [
                data.title, data.brand, data.model, data.year, data.fuel_type, data.gear_type,
                data.condition_type, data.kilometer, data.body_type, data.engine_power, data.engine_capacity,
                data.drive_type, data.color, data.damage_record, data.seller_type, data.exchangeable,
                data.price, data.city, data.district, data.description, data.photos, data.show_phone, data.status, data.is_featured || false, id
            ]
        );
        res.json({ message: 'İlan güncellendi', listing: updated.rows[0] });
    } catch (err) {
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

app.delete('/api/listings/:id', async(req, res) => {
    try {
        await pool.query('DELETE FROM listings WHERE id = $1', [req.params.id]);
        res.json({ message: 'İlan silindi' });
    } catch (err) {
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

// --- YORUMLAR & YANITLAR ---
app.get('/api/comments/:listing_id', async(req, res) => {
    try {
        const comments = await pool.query(
            `SELECT c.*, u.name as commenter_name, u.profile_image as commenter_avatar 
             FROM listing_comments c JOIN users u ON c.user_id = u.id WHERE c.listing_id = $1 ORDER BY c.created_at DESC`, [req.params.listing_id]
        );

        for (let comm of comments.rows) {
            const replies = await pool.query(
                `SELECT r.*, u.name as replier_name, u.profile_image as replier_avatar 
                 FROM comment_replies r JOIN users u ON r.user_id = u.id WHERE r.comment_id = $1 ORDER BY r.created_at ASC`, [comm.id]
            );
            comm.replies = replies.rows;
        }

        res.json(comments.rows);
    } catch (err) {
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

app.post('/api/comments', async(req, res) => {
    const { listing_id, user_id, comment } = req.body;
    try {
        const newComment = await pool.query(
            `INSERT INTO listing_comments (listing_id, user_id, comment) VALUES ($1, $2, $3) RETURNING *`, [listing_id, user_id, comment]
        );
        res.status(201).json({ message: 'Yorum eklendi', comment: newComment.rows[0] });
    } catch (err) {
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

app.post('/api/comment-replies', async(req, res) => {
    const { comment_id, user_id, reply } = req.body;
    try {
        const newReply = await pool.query(
            `INSERT INTO comment_replies (comment_id, user_id, reply) VALUES ($1, $2, $3) RETURNING *`, [comment_id, user_id, reply]
        );
        res.status(201).json({ message: 'Yanıt eklendi', reply: newReply.rows[0] });
    } catch (err) {
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

// --- FAVORİLER & MESAJLAR ---
app.get('/api/favorites/:user_id', async(req, res) => {
    try {
        const result = await pool.query(
            `SELECT l.*, u.name as owner_name FROM favorites f JOIN listings l ON f.listing_id = l.id JOIN users u ON l.user_id = u.id WHERE f.user_id = $1`, [req.params.user_id]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ message: 'Sunucu Hatası' }); }
});

app.post('/api/favorites', async(req, res) => {
    const { user_id, listing_id } = req.body;
    try {
        const check = await pool.query('SELECT * FROM favorites WHERE user_id = $1 AND listing_id = $2', [user_id, listing_id]);
        if (check.rows.length > 0) {
            await pool.query('DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2', [user_id, listing_id]);
            return res.json({ status: 'removed' });
        }
        await pool.query('INSERT INTO favorites (user_id, listing_id) VALUES ($1, $2)', [user_id, listing_id]);
        res.json({ status: 'added' });
    } catch (err) { res.status(500).json({ message: 'Sunucu Hatası' }); }
});

app.get('/api/messages/:user_id', async(req, res) => {
    try {
        const result = await pool.query(
            `SELECT m.*, s.name as sender_name, s.profile_image as sender_avatar, 
                    r.name as receiver_name, r.profile_image as receiver_avatar, 
                    l.title as listing_title
             FROM messages m 
             JOIN users s ON m.sender_id = s.id 
             JOIN users r ON m.receiver_id = r.id 
             LEFT JOIN listings l ON m.listing_id = l.id
             WHERE m.sender_id = $1 OR m.receiver_id = $1 ORDER BY m.created_at DESC`, [req.params.user_id]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ message: 'Sunucu Hatası' }); }
});

app.post('/api/messages', async(req, res) => {
    const { sender_id, receiver_id, listing_id, message } = req.body;
    try {
        const newMsg = await pool.query(
            `INSERT INTO messages (sender_id, receiver_id, listing_id, message) VALUES ($1, $2, $3, $4) RETURNING *`, [sender_id, receiver_id, listing_id || null, message]
        );
        res.status(201).json({ message: 'Gönderildi', data: newMsg.rows[0] });
    } catch (err) { res.status(500).json({ message: 'Sunucu Hatası' }); }
});

app.listen(3000, () => {
    console.log('Backend sunucusu 3000 portunda ayakta!');
});
