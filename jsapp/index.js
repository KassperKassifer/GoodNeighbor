#!/usr/bin/env node
const http = require('http');

const volunteerOpportunities = [];

const parseData = (query = '') => 
    Object.fromEntries(new URLSearchParams(query));

const handleRequest = (req, res) => {
    const [path, query] = req.url.split('?');
    const params = parseData(query);

    if (req.method === "POST") {
        let body = "";
        req.on("data", data => body += data);
        req.on("end", () => {
            try {
                const newEntry = JSON.parse(body);

                // Validate field entry
                if (!newEntry.name || !newEntry.location) {
                    return sendJSON(res, { error: "Missing 'name' or 'location'" }, 400);
                }

                volunteerOpportunities.push(newEntry); // Store new volunteer opportunity
                sendJSON(res, newEntry, 201); // Respond with the new entry
            } catch {
                sendJSON(res, { error: "Invalid JSON" }, 400);
            }
        });
    } else if (req.method === "GET") {
        if (params.name) {
            let filteredVolunteers = volunteerOpportunities.filter(v => 
                v.name.toLowerCase() === params.name.toLowerCase());

            if (filteredVolunteers.length === 0) {
                return sendJSON(res, { error: "No opportunities found" }, 404);
            }
                
            sendJSON(res, filteredVolunteers); // Return only matched results
        } else {
            sendJSON(res, volunteerOpportunities); // Return all volunteers
        }
    } else {
        sendJSON(res, { error: "Not Found" }, 404);
    }
};

// Helper function to send JSON response
const sendJSON = (res, data, statusCode = 200) => {
    res.writeHead(statusCode, { 
        "Content-Type": "application/json" 
    });
    res.write(JSON.stringify(data));
    res.end();
};

const server = http.createServer(handleRequest);
server.listen(3000, () => console.log("Good Neighbor API running on port 3000"));
