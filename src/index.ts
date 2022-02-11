import { PrismaClient } from '@prisma/client'
import express from 'express'
const cors = require('cors');
const prisma = new PrismaClient()
// const app = express()
const request = require('request');
const cheerio = require('cheerio');
const bodyParser = require('body-parser'),
    jwt = require('jsonwebtoken'),
    config = require('./configs/config'),
    app = express();

app.set('key', config.llave);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// app.use(cors({ origin: true, credentials: true  }));
app.use(cors())

app.use(express.json())

const rutasProtegidas = express.Router();
rutasProtegidas.use((req, res, next) => {
    const token = req.headers['access-token'];

    if (token) {
        jwt.verify(token, app.get('key'), (err: any, decoded: any) => {
            if (err) {
                return res.json({ mensaje: 'Invalid Token' });
            } else {
                req.body.decoded = decoded;
                next();
            }
        });
    } else {
        res.send({
            mensaje: 'Token not provided.'
        });
    }
});

app.post('/api/login', async (req, res) => {
    const count = await prisma.user.count({
        where: { email: req.body.username, password: req.body.password },
    })

    // req.body.username === "erodriguez" && req.body.password === "123"
    if (count > 0) {
        const payload = {
            check: true
        };
        const token = jwt.sign(payload, app.get('key'), {
            expiresIn: 86400 //24 Horas
        });
        res.json({
            email: req.body.username,
            message: 'Successful authentication',
            token: token
        });
    } else {
        res.json({ message: "Incorrect username or password" })
    }
})


app.get('/api/users', rutasProtegidas, async (req, res) => {
    const users = await prisma.user.findMany()
    res.json(users)
})

app.get(`/api/users/:id`, rutasProtegidas, async (req, res) => {
    const { id } = req.params
    const post = await prisma.user.findUnique({
        where: { id: Number(id) },
    })
    res.json(post)
})

app.put('/api/user/:id', rutasProtegidas, async (req, res) => {
    const { id } = req.params
    const { name, email, password } = req.body
    const post = await prisma.user.update({
        where: { id: Number(id) },
        data: {
            name,
            email,
            password
        },
    })
    res.json(post)
})

app.get('/api/articles', rutasProtegidas, async (req, res) => {
    const posts = await prisma.post.findMany({
        where: { published: true },
        include: { user: true }
    })
    res.json(posts)
})

app.get(`/api/posts/:id`, rutasProtegidas, async (req, res) => {
    const { id } = req.params
    const post = await prisma.post.findUnique({
        where: { id: Number(id) },
    })
    res.json(post)
})

app.post(`/api/user`, rutasProtegidas, async (req, res) => {
    const result = await prisma.user.create({
        data: { ...req.body },
    })
    res.json(result)
})

app.post(`/api/posts`, rutasProtegidas, async (req, res) => {
    const { postId, title, publishedAt, author, sourceLink, category, bodyDescription, authorEmail } = req.body
    const result = await prisma.post.create({
        data: {
            postId,
            title,
            publishedAt,
            author,
            sourceLink,
            category,
            bodyDescription,
            published: true,
            user: { connect: { email: authorEmail } },
        },
    })
    res.json(result)
})

app.get(`/api/posts`, rutasProtegidas, async (req, res) => {
    const { tag } = req.query;
    const post = await prisma.post.findMany({
        where: {
            OR: [
                {
                    category: String(tag)
                }, {
                    author: String(tag)
                },
            ]

        },
    })
    res.json(post)
})

app.put('/api/post/publish/:id', rutasProtegidas, async (req, res) => {
    const { id } = req.params
    const { title, bodyDescription, published } = req.body
    const post = await prisma.post.update({
        where: { id: Number(id) },
        data: {
            title,
            bodyDescription,
            published
        },
    })
    res.json(post)
})

app.put('/api/password', rutasProtegidas, async (req, res) => {
    // const { id } = req.params
    const { email, password } = req.body
    const post = await prisma.user.update({
        where: { email: String(email) },
        data: {
            password
        },
    })
    res.json(post)
})

app.delete(`/api/post/:id`, rutasProtegidas, async (req, res) => {
    const { id } = req.params
    const post = await prisma.post.delete({
        where: { id: Number(id) },
    })
    res.json(post)
})

app.delete(`/api/posts`, rutasProtegidas, async (req, res) => {
    const post = await prisma.post.deleteMany()
    res.json(post)
})

class article { postId: any; title: any; publishedAt: any; author: any; sourceLink: any; category: any; bodyDescription: any; }

app.get('/api/search', rutasProtegidas, async (req, res) => {

    const { tag } = req.query;

    var datas: article[] = [];

    request(`https://cargofive.com/es/blog/`, (err: any, response: { statusCode: number; }, html: any) => {

        if (response.statusCode === 200) {

            const $ = cheerio.load(html);

            var j = 0;

            $('.post').each(async (i: any, el: any) => {

                if (j < 3) {
                    let postId: string = $(el).attr('id');
                    let title: string = $(el).find('.post-header').find('.title').find('a').text().replaceAll("\t", "").trim();
                    let publishedAt: string = $(el).find('.grav-wrap').find('span').text();
                    let author: string = $(el).find('.grav-wrap').find('a').text();
                    let sourceLink: string = $(el).find('.post-content-wrap').find('a').attr('href');
                    var t = '.' + tag;

                    let category: string = $(el).find('.meta-category').find(t).text();
                    let bodyDescription: string = $(el).find('.excerpt').text();

                    let data: article = {
                        postId,
                        title,
                        publishedAt,
                        author,
                        sourceLink,
                        category,
                        bodyDescription
                    }



                    if (category != '') {

                        datas.push(data);
                        j = j + 1;



                        try {
                            await prisma.post.create({
                                data: {
                                    postId,
                                    title,
                                    publishedAt,
                                    author,
                                    sourceLink,
                                    category,
                                    bodyDescription,
                                    published: true,
                                    user: { connect: { email: 'codeart.ve@gmail.com' } },
                                },
                            })
                        }
                        catch (e: any) {

                        }

                    }

                }


            })


            res.json(datas)
        }
    })



})


app.listen(3000, () =>
    console.log('REST API server ready at: http://localhost:3000'),
)