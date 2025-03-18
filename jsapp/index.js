#!/usr/bin/env node
const http = require('http');
const bcrypt = require("bcrypt");
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Test database connection on startup
pool.query("SELECT NOW()", (err, res) => {
    if (err) {
        console.error("Database connection error:", err);
    } else {
        console.log("Connected to PostgreSQL at:", res.rows[0].now);
    }
});

// Hash password function (for storing new users)
const hashPassword = async (password) => {
    const saltRounds = 10;
    const pepper = process.env.PEPPER_SECRET;

    return bcrypt.hash(password + pepper, saltRounds);
};

// Verify password function (for login)
const verifyPassword = async (password, hash) => {
    const pepper = process.env.PEPPER_SECRET;
    return bcrypt.compare(password + pepper, hash);
};

// Authenticate user function
const authenticate = async (auth = '') => {
    if (!auth.startsWith('Basic ')) return { authenticated: false };

    const [username, password] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
    if (!username || !password) return { authenticated: false };

    try {
        const result = await pool.query('SELECT password, role FROM users WHERE username = $1', [username]);

        if (result.rows.length === 0) {
            console.log('User not found:', username);
            return { authenticated: false };
        }

        const hash = result.rows[0].password;
        const role = result.rows[0].role;

        const isValid = await verifyPassword(password, hash);
        return { authenticated: isValid, role: isValid ? role : null };
    } catch (err) {
        console.error('Error checking user authentication:', err);
        return { authenticated: false };
    }
};

// Register New User
const handleRegister = async (req, res, adminRegistering = false) => {
    if (req.method !== "POST") {
        return sendJSON(res, { error: "Method not allowed" }, 405);
    }

    let body = "";
    req.on("data", (data) => (body += data));
    req.on("end", async () => {
        try {
            const { username, password, role } = JSON.parse(body);

            if (!username || !password) {
                return sendJSON(res, { error: "Username and password are required" }, 400);
            }

            // Check if user already exists
            const userExists = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
            if (userExists.rows.length > 0) {
                return sendJSON(res, { error: "Username already exists" }, 400);
            }

            // Hash the password before storing
            const hashedPassword = await hashPassword(password);

            // If an admin is registering a new user, they can set the role, otherwise default to "user"
            let assignedRole = "user"; // Default role for self-registration
            if (adminRegistering && ["admin", "organization"].includes(role)) {
                assignedRole = role;
            }
            
            // Insert new user into the database
            const result = await pool.query(
                "INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username",
                [username, hashedPassword, assignedRole]
            );

            sendJSON(res, { success: true, user: result.rows[0] }, 201);
        } catch (error) {
            console.error("Error registering user:", error);
            sendJSON(res, { error: "Internal Server Error" }, 500);
        }
    });
};

// Helper function to parse query parameters
const parseData = (query = '') => Object.fromEntries(new URLSearchParams(query));

const handleRequest = async (req, res) => {
    const [path, query] = req.url.split('?');
    const params = parseData(query);
    console.log(`Received ${req.method} request to: ${req.url}`);

    let auth = await authenticate(req.headers.authorization);

    // Standard registration
    if (path === "/register") {
        return handleRegister(req, res);
    }

    // Admin registering other users
    if (path === "/register-admin") {
        if (!auth.authenticated || auth.role !== "admin") {
            return sendJSON(res, { error: "Only admins can create new users" }, 403);
        }
        return handleRegister(req, res, auth); // Pass authentication object
    }

    // Protect routes that require authentication
    if (['POST', 'PUT', 'DELETE'].includes(req.method) && !auth.authenticated) {        
        res.writeHead(401, { "WWW-Authenticate": "Basic realm='GoodNeighbor'" });
        return res.end('Unauthorized');
    }

    if (req.method === "POST") {
        if (auth.role !== "admin" && auth.role !== "organization") {
            return sendJSON(res, { error: "Only organizations can create opportunities" }, 403);
        }

        let body = "";
        req.on("data", (data) => (body += data));
        req.on("end", async () => {
            try {
                const newEntry = JSON.parse(body);
                console.log("Parsed JSON successfully:", newEntry);

                if (!newEntry.name || !newEntry.location) {
                    return sendJSON(res, { error: "Missing 'name' or 'location'" }, 400);
                }

                // Insert into database
                const result = await pool.query(
                    "INSERT INTO opportunities (name, location) VALUES ($1, $2) RETURNING *",
                    [newEntry.name, newEntry.location]
                );
                sendJSON(res, result.rows[0], 201);
            } catch (error) {
                console.error("Error adding opportunity:", error.message);
                sendJSON(res, { error: "Invalid JSON or database error", details: error.message }, 400);
            }
        });
    } else if (req.method === "GET") {
        try {
            let result;
            if (params.name) {
                result = await pool.query("SELECT * FROM opportunities WHERE LOWER(name) = LOWER($1)", [params.name]);
            } else {
                result = await pool.query("SELECT * FROM opportunities");
            }

            if (result.rows.length === 0) {
                return sendJSON(res, { error: "No opportunities found" }, 404);
            }
            sendJSON(res, result.rows);
        } catch (error) {
            console.error("Error fetching opportunities:", error);
            sendJSON(res, { error: "Database error" }, 500);
        }
    } else if (req.method === "PUT") {
        if (auth.role !== "admin" && auth.role !== "organization") {
            return sendJSON(res, { error: "Only organizations can update opportunities" }, 403);
        }

        const id = path.split("/")[2];
        let body = "";
        req.on("data", (data) => (body += data));
        req.on("end", async () => {
            try {
                const updatedEntry = JSON.parse(body);
                console.log("Received update request:", updatedEntry);

                // Update the opportunity in the database
                const result = await pool.query(
                    "UPDATE opportunities SET name = $1, location = $2 WHERE id = $3 RETURNING *",
                    [updatedEntry.name, updatedEntry.location, id]
                );

                if (result.rows.length === 0) {
                    return sendJSON(res, { error: "Opportunity not found" }, 404);
                }

                console.log("Updated opportunity:", result.rows[0]);
                sendJSON(res, result.rows[0], 200);
            } catch (error) {
                console.error("Error updating opportunity:", error.message);
                if (!res.headersSent) {
                    sendJSON(res, { error: "Invalid JSON or Update Failed", details: error.message }, 400);
                }
            }
        });
    } else if (req.method === "DELETE") {
        if (auth.role !== "admin" && auth.role !== "organization") {
            return sendJSON(res, { error: "Only organizations can delete opportunities" }, 403);
        }

        const id = path.split("/")[2];
        try {
            const result = await pool.query("DELETE FROM opportunities WHERE id = $1 RETURNING *", [id]);
            if (result.rows.length === 0) {
                return sendJSON(res, { error: `Opportunity with ID ${id} not found` }, 404);
            }
            sendJSON(res, { success: true }, 200);
        } catch (error) {
            console.error("Error deleting opportunity:", error);
            sendJSON(res, { error: "Database error" }, 500);
        }
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
