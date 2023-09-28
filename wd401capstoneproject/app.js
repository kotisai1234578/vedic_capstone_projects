const express = require('express');
const axios = require('axios');
const ejs = require('ejs');
const app = express();
const admin = require('firebase-admin');
const serviceAccount = require("./keys.json");
const bcrypt = require('bcrypt');

app.use(express.static('public'));

app.set('view engine', 'ejs');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

app.use(express.urlencoded({ extended: true }));

async function userExists(email) {
    const usersRef = admin.firestore().collection("appusers");
    const snapshot = await usersRef.where("Email", "==", email).get();
    return !snapshot.empty;
}

app.get('/signup', function (req, res) {
    res.render('signup', { message: null });
});

app.post('/submitsignup', async function (req, res) {
    const { name, email, password } = req.body;

    try {
        const exists = await userExists(email);

        if (exists) {
            return res.render('signup', { message: "User already exists. Please login." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await admin.firestore().collection("appusers").add({
            FullName: name,
            Email: email,
            Password: hashedPassword,
        });

        return res.redirect('/login');
    } catch (error) {
        return res.send("Error: " + error.message);
    }
});

app.get('/login', function (req, res) {
    res.render('login', { message: null });
});

app.post('/submitlogin', async function (req, res) {
    const { email, password } = req.body;

    try {
        const snapshot = await admin.firestore().collection("appusers")
            .where("Email", "==", email)
            .get();

        if (snapshot.size === 0) {
            return res.render('login', { message: "Invalid credentials." });
        } else {
            const user = snapshot.docs[0].data();
            const passwordMatch = await bcrypt.compare(password, user.Password);

            if (passwordMatch) {
                return res.redirect('/dashboard');
            } else {
                return res.render('login', { message: "Invalid credentials." });
            }
        }
    } catch (error) {
        return res.send("Error: " + error.message);
    }
});

app.get('/dashboard', async (req, res) => {
    const response = await axios.get('https://newsapi.org/v2/top-headlines?country=us&apiKey=926eb595867d421395a6661cb90f0107');
    const articles = response.data.articles;
  
    res.render('dashboard', { articles });
});

app.get('/home', function (req, res) {
    res.render('home');
});

const port = process.env.PORT || 3000;
app.listen(port, function () {
    console.log('App listening on port ' + port + '!');
});

app.use((req, res, next) => {
    res.locals.message = req.query.message;
    next();
});
