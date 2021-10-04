const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')
const capitalize = require('./utils/capitalize')

const app = express()

const port = process.env.PORT
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))

const server = http.createServer(app)
const io = socketio(server)


io.on('connection', (socket) => {
    console.log('New WebSocket connection')

    socket.on('join', ({ username, room }, cb) => {
        const { error, user } = addUser({ id: socket.id, username, room })

        if (error) {
            return cb(error)
        }

        socket.join(user.room)

        io.to(user.id).emit('message', generateMessage(
            'Admin',
            `Welcome ${capitalize(user.username)}!`
        ))
        socket.broadcast.to(user.room).emit('message', generateMessage(
            'Admin',
            `${capitalize(user.username)} has joined!`
        ))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room).map((user) => {
                user.username = capitalize(user.username)
                return user
            })
        })
        cb()

    })

    socket.on('sendMessage', (mesg, cb) => {
        const filter = new Filter()
        const user = getUser(socket.id)

        if (filter.isProfane(mesg)) {
            io.to(user.room).emit('message', generateMessage(
                capitalize(user.username),
                'Im a very naughty boy!'
            ))
            return cb('Delivered')
        }

        io.to(user.room).emit('message', generateMessage(
            capitalize(user.username),
            mesg
        ))
        cb('Delivered')
    })

    socket.on('sendLocation', ({ latitude, longitude }, cb) => {
        const user = getUser(socket.id)

        io.to(user.room).emit('locationMessage', generateLocationMessage(
            capitalize(user.username),
            `https://google.com/maps?q=${latitude},${longitude}`
        ))
        cb()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage(
                'Admin',
                `${capitalize(user.username)} has left!`
            ))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })

})

server.listen(port, () => {
    console.log(`Server listening on ${port}`)
})

