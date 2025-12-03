const express = require("express");
const http = require("http");
const cors = require("cors");
const socketio = require("socket.io");
const translate = require("@vitalets/google-translate-api");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketio(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log("Client connected");

    socket.on("translate-message", async (data) => {
        try {
            const result = await translate(data.text, { to: data.targetLang });

            socket.emit("translated-text", {
                text: result.text,
                lang: data.targetLang
            });

        } catch (error) {
            console.log("Translation Error:", error);
        }
    });
});

server.listen(5000, () => console.log("Server running on port 5000"));
