#!/usr/bin/env node
const http = require('http');
const fs = require('node:fs');

const DB_FILE = "db.json";

// Load opportunities from JSON file on startup
let volunteerOpportunities = [];
fs.readFile(DB_FILE, "utf8", (err, data) => {
    if (err || !data) {
        console.error("Error reading database file, initializing new array.");
        volunteerOpportunities = []; // Default to an empty array if file is missing or empty
        return;
    }
    try {
        const parsedData = JSON.parse(data);
        volunteerOpportunities = Array.isArray(parsedData) ? parsedData : []; // Ensure it's an array
    } catch (error) {
        console.error("Error parsing database file, resetting to empty array:", error);
        volunteerOpportunities = []; // Reset if corrupted
    }
});

// Helper function to save opportunities to JSON database
const saveOpportunities = () => {
    fs.writeFile(DB_FILE, JSON.stringify(volunteerOpportunities, null, 2), (err) => {
        if (err) console.error("Error saving database file:", err);
    });
};

const parseData = (query = '') =>
    Object.fromEntries(new URLSearchParams(query));

const handleRequest = (req, res) => {
    const [path, query] = req.url.split('?');
    const params = parseData(query);
    console.log(`Received ${req.method} request to: ${req.url}`);

    if (req.method === "POST") {
        let body = "";
        req.on("data", (data) => {
            console.log("Received raw data chunk:", data.toString()); // Log each chunk
            body += data;
        });
        req.on("end", () => {
            console.log("Full received request body:", body);

            try {
                const newEntry = JSON.parse(body); // Parse JSON
                console.log("Parsed JSON successfully:", newEntry);

                if (!newEntry.name || !newEntry.location) {
                    console.error("Missing 'name' or 'location' in request");
                    return sendJSON(res, { error: "Missing 'name' or 'location'" }, 400);
                }

                newEntry.id = String(Date.now());
                volunteerOpportunities.push(newEntry);
                saveOpportunities();
                sendJSON(res, newEntry, 201);
            } catch (error) {
                console.error("JSON Parsing Error:", error.message); // Log error details
                sendJSON(res, { error: "Invalid JSON", details: error.message }, 400);
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
            sendJSON(res, Array.isArray(volunteerOpportunities) ? volunteerOpportunities : []); // Return all volunteers
        }
    } else if (req.method === "PUT") {
        const id = path.split("/")[2];
        let body = "";
        req.on("data", data => body += data);
        req.on("end", () => {
            try {
                const updatedEntry = JSON.parse(body);
                const opportunity = volunteerOpportunities.find(v => v.id === id);

                if (!opportunity) {
                    console.error(`Opportunity with ID ${id} not found`);
                    return sendJSON(res, { error: `Opportunity with ID ${id} not found` }, 404);
                }

                opportunity.name = updatedEntry.name;
                opportunity.location = updatedEntry.location;
                saveOpportunities();
                sendJSON(res, opportunity, 200);
            } catch {
                sendJSON(res, { error: "Invalid JSON" }, 400);
            }
        });
    } else if (req.method === "DELETE") {
        const id = path.split("/")[2];
        const initialLength = volunteerOpportunities.length;
        volunteerOpportunities = volunteerOpportunities.filter(v => v.id !== id);

        if (volunteerOpportunities.length === initialLength) {
            return sendJSON(res, { error: "Opportunity not found" }, 404);
        }

        saveOpportunities();
        sendJSON(res, { success: true }, 200);
    } else {
        sendJSON(res, { error: "Operation Not Found" }, 404);
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
