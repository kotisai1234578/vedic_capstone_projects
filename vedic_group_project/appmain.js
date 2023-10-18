const express = require('express');
const app = express();
const admin = require('firebase-admin');
const serviceAccount = require("./key1.json");
const bcrypt = require('bcrypt');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const session = require('express-session');
const crypto = require('crypto');

// It's better to use an environment variable for production.
const SESSION_SECRET = process.env.SESSION_SECRET || 'development_secret_change_this';

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));

app.use(express.static('public'));
app.set('view engine', 'ejs');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "gs://foundify-54796.appspot.com",
    ignoreUndefinedProperties: true
});

const bucket = admin.storage().bucket();
app.use(express.urlencoded({ extended: true }));

async function userExists(email) {
    const usersRef = admin.firestore().collection("appusers");
    const snapshot = await usersRef.where("Email", "==", email).get();
    return !snapshot.empty;
}

app.get('/signup_page', (req, res) => res.render('signup_page', { message: null }));

app.post('/submit_signup', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const exists = await userExists(email);

        if (exists) {
            return res.render('signup_page', { message: "User already exists. Please login." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const userData = {
            FullName: name,
            Email: email,
            Password: hashedPassword,
        };

        // Remove undefined properties
        Object.keys(userData).forEach(key => userData[key] === undefined && delete userData[key]);

        await admin.firestore().collection("appusers").add(userData);

        return res.redirect('/login_page');
    } catch (error) {
        return res.send("Error: " + error.message);
    }
});

app.get('/login_page', (req, res) => res.render('login_page', { message: null }));

app.post('/submit_login', async (req, res) => {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
        return res.render('login_page', { message: "Please provide both email and password." });
    }


    try {
        const snapshot = await admin.firestore().collection("appusers")
            .where("Email", "==", email)
            .get();

        if (snapshot.size === 0) {
            return res.render('login_page', { message: "Invalid credentials." });
        } else {
            const user = snapshot.docs[0].data();
            const passwordMatch = await bcrypt.compare(password, user.Password);

            if (passwordMatch) {
                req.session.userId = snapshot.docs[0].id;
                return res.redirect('/dashboard');
            } else {
                return res.render('login_page', { message: "Invalid credentials." });
            }
        }
    } catch (error) {
        return res.send("Error: " + error.message);
    }
});

app.get('/', (req, res) => res.render('home'));

app.post('/api/posts', upload.single('image'), async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) return res.status(401).send('User not authenticated');

        const postData = {
            content: req.body.content,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            userId: userId
        };

        // Check if an image file was uploaded
        if (req.file) {
            const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${req.file.originalname.split('.').pop()}`;
            const file = bucket.file(filename);
            const stream = file.createWriteStream({
                metadata: {
                    contentType: req.file.mimetype
                }
            });

            stream.end(req.file.buffer);

            await new Promise((resolve, reject) => {
                stream.on('error', reject);
                stream.on('finish', resolve);
            });

            // This is the new line you're adding to make the uploaded image public
            await file.makePublic();

            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
            postData.imageUrl = publicUrl;

        }

        await admin.firestore().collection('posts').add(postData); // Add this to actually save the post.

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false });
    }
});


app.get('/dashboard', async (req, res) => {
    try {
        const postsRef = admin.firestore().collection('posts');

        // Fetch the latest 10 posts
        const postsSnapshot = await postsRef.orderBy('timestamp', 'desc').limit(10).get();

        let posts = [];
        let userIds = new Set();

        postsSnapshot.forEach(doc => {
            const postData = doc.data();
            posts.push(postData);
            if (postData.userId) {
                userIds.add(postData.userId);
            }
        });

        userIds = [...userIds].filter(id => id); // Filter out any undefined or null values

        let userMap = {};
        if (userIds.length) {
            const usersRef = admin.firestore().collection('appusers');
            const usersSnapshot = await usersRef.where(admin.firestore.FieldPath.documentId(), 'in', userIds).get();
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                userMap[doc.id] = userData;
            });
        }

        posts = posts.map(post => {
            const user = userMap[post.userId] || {};
            return {
                ...post,
                username: user.FullName,
                postImageURL: post.imageUrl,
                userImageURL: user.ImageURL // adjust this based on your user schema
            };
        });

        // Fetch the latest single post
        let latestPost = null;
        if (!postsSnapshot.empty) {
            latestPost = postsSnapshot.docs[0].data();
        }

        res.render('dashboard', { message: null, post: latestPost, posts: posts });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to retrieve posts.');
    }
});

app.post('/updateProfileImage', upload.single('image'), async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) return res.status(401).send('User not authenticated');

        if (req.file) {
            const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${req.file.originalname.split('.').pop()}`;
            const file = bucket.file(filename);
            const stream = file.createWriteStream({
                metadata: {
                    contentType: req.file.mimetype
                }
            });

            stream.end(req.file.buffer);

            await new Promise((resolve, reject) => {
                stream.on('error', reject);
                stream.on('finish', resolve);
            });

            await file.makePublic();

            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

            await admin.firestore().collection('appusers').doc(userId).update({
                ImageURL: publicUrl
            });
        }

        res.redirect('/profile');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false });
    }
});

app.get('/removePhoto', async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) return res.status(401).send('User not authenticated');

        // Set ImageURL to null or default image URL
        await admin.firestore().collection('appusers').doc(userId).update({
            ImageURL: null
        });

        res.redirect('/profile');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false });
    }
});



app.get('/post', (req, res) => res.render('post'));

app.get('/profile', async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).send('User not authenticated');

    const userRef = admin.firestore().collection('appusers').doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    res.render('profile', { user: userData });
});

app.get('/logout', (req, res) => {
    req.session.destroy(); // destroy the session
    res.redirect('/');     // redirect to the home route which will render home.ejs
});



const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));