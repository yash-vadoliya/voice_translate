const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const translate = require("@vitalets/google-translate-api");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.static("public"));

io.on("connection", (socket) => {
    console.log("User connected");

    socket.on("translate-message", async (data) => {
        try {
            // Translate to listener's selected language
            const result = await translate(data.text, { to: data.targetLang });

            socket.emit("translated-text", {
                text: result.text,
                lang: data.targetLang
            });

        } catch (err) {
            console.error("Translation Error:", err);
        }
    });
});

server.listen(5000, () => console.log("Server running on port 5000"));
