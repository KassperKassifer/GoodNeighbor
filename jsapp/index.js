const http = require("http");

const handleRequest = (req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.write("Hello from local Node.js!");
    res.end();
};

const server = http.createServer(handleRequest);
server.listen(3000, () => {
    console.log("Server running at http://localhost:3000/");
});