#!/usr/bin/env node
const http = require('http');
const bcrypt = require("bcrypt");
require("dotenv").config();
const { Pool } = require("pg");
const WebSocket = require("ws");

const wsserver = new WebSocket.WebSocketServer({ noServer: true });


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
    console.log("Authenticating user..")
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
        return { authenticated: isValid, role: isValid ? role : null, username: isValid ? username : null };
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

    // Standard registration
    if (path === "/api/register") {
        return handleRegister(req, res);
    }

    let auth = await authenticate(req.headers.authorization);

    // Admin registering other users (currently nonfunctional)
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
        // Route handling for a user signing up for an event
        if (path === "/api/signup") {
            let body = "";
            req.on("data", chunk => body += chunk);
            req.on("end", async () => {
                try {
                    const { opportunity_id, hours } = JSON.parse(body);
                    if (!opportunity_id || !hours) {
                        return sendJSON(res, { error: "Missing opportunity_id or hours" }, 400);
                    }

                    const username = auth.username;
                    if (!username) {
                        return sendJSON(res, { error: "User not found (auth)" }, 404);
                    }

                    const userResult = await pool.query(
                        "SELECT id FROM users WHERE LOWER(username) = LOWER($1)",
                        [username]
                    );

                    if (userResult.rows.length === 0) {
                        return sendJSON(res, { error: "User not found (db)" }, 404);
                    }

                    const user_id = userResult.rows[0].id;

                    const insertResult = await pool.query(
                        `INSERT INTO event_signups (user_id, opportunity_id, hours)
                         VALUES ($1, $2, $3)
                         RETURNING *`,
                        [user_id, opportunity_id, hours]
                    );

                    return sendJSON(res, { success: true, signup: insertResult.rows[0] }, 201);
                } catch (error) {
                    console.error("Error signing up for event:", error);
                    return sendJSON(res, { error: "Database error", details: error.message }, 500);
                }
            });
            // Route handling for creating a new opportunity/event
        } else {
            if (auth.role !== "admin" && auth.role !== "organization") {
                return sendJSON(res, { error: "Only organizations can create opportunities" }, 403);
            }

            let body = "";
            req.on("data", (data) => (body += data));
            req.on("end", async () => {
                const opportunity = JSON.parse(body);
                console.log("Parsed JSON successfully:", opportunity);

                try {
                    const {
                        name,
                        location,
                        description,
                        event_date,
                        start_time,
                        end_time,
                        contact_name,
                        contact_email,
                        contact_phone
                    } = opportunity;

                    // Basic validation
                    if (!name || !location) {
                        return sendJSON(res, { error: "Missing 'name' or 'location'" }, 400);
                    }

                    // Insert into database
                    const result = await pool.query(`
                        INSERT INTO opportunities (
                            name, location, description, event_date, start_time, end_time, 
                            contact_name, contact_email, contact_phone, modified_by, created_by
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
                        RETURNING *`,
                        [name, location, description, event_date, start_time, end_time, contact_name, contact_email, contact_phone, auth.username, auth.id]
                    );
                    notifyAll(`New Opportunity: ${name} at ${location}\n event_date, start_time`);
                    sendJSON(res, result.rows[0], 201);
                } catch (error) {
                    console.error("Error adding opportunity:", error.message);
                    sendJSON(res, { error: "Invalid JSON or database error", details: error.message }, 400);
                }
            });
        }
    }
    // Retrieve events the user has signed up for
    else if (req.method === "GET" && path === "/api/signups") {
        try {
            const userResult = await pool.query("SELECT id FROM users WHERE username = $1", [auth.username]);
            const user_id = userResult.rows[0]?.id;
            if (!user_id) {
                return sendJSON(res, { error: "User not found" }, 404);
            }

            const result = await pool.query(
                `SELECT e.id, e.opportunity_id, o.name, o.location, e.hours
                 FROM event_signups e
                 JOIN opportunities o ON e.opportunity_id = o.id
                 WHERE e.user_id = $1`,
                [user_id]
            );

            const totalHours = result.rows.reduce((sum, r) => sum + Number(r.hours), 0);
            return sendJSON(res, { signups: result.rows, totalHours });
        } catch (error) {
            console.error("Error retrieving signups:", error);
            sendJSON(res, { error: "Database error" }, 500);
        }
    }
    // Retrieve opportunities
    else if (req.method === "GET" && path === "/api/events") {
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
    }
    // Return auth info
    else if (req.method === "GET" && path === "/api/login") {
        if (!auth.authenticated) {
            return sendJSON(res, { error: "Invalid credentials" }, 401);
        }
        return sendJSON(res, {
            username: auth.username,
            role: auth.role
        });
    }
    // Return users for admins only
    else if (req.method === "GET" && path === "/api/users") {
        if (!auth || auth.role !== "admin") {
            return sendJSON(res, { error: "Forbidden" }, 403);
        }

        try {
            const result = await pool.query("SELECT id, username, role FROM users ORDER BY id");
            return sendJSON(res, result.rows);
        } catch (err) {
            console.error("Error fetching users:", err);
            return sendJSON(res, { error: "Server error" }, 500);
        }
    }
    else if (req.method === "GET" && path === "/api/org/dashboard"){
        // Get activity summary for an organization
        if (!auth || auth.role !== "organization") {
            return sendJSON(res, { error: "Forbidden" }, 403);
        }

        try {
            console.log("Org dashboard route hit by:", auth.username);
            const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

            const orgResult = await pool.query("SELECT id FROM users WHERE username = $1", [auth.username]);
            const org_id = orgResult.rows[0]?.id;

            if (!org_id) {
                return sendJSON(res, { error: "User not found" }, 404);
            }

            const eventsResult = await pool.query(
                `SELECT id, name, location, event_date
                 FROM opportunities
                 WHERE created_by = $1
                 ORDER BY event_date DESC`,
                [org_id]
            );
            console.log("Fetched events:", eventsResult.rows);
            const formatAsDateOnly = (date) => new Date(date).toISOString().split("T")[0];

            const statsResult = await pool.query(
                `SELECT
                    COUNT(DISTINCT o.id) AS event_count,
                    COUNT(e.id) AS total_signups,
                    COALESCE(SUM(e.hours), 0) AS total_hours
                 FROM opportunities o
                 LEFT JOIN event_signups e ON o.id = e.opportunity_id
                 WHERE o.created_by = $1`,
                [org_id]
            );
            console.log("Fetched stats:", statsResult.rows[0]);
            
            const upcoming = eventsResult.rows.filter(e => formatAsDateOnly(e.event_date) > today);
            const past = eventsResult.rows.filter(e => formatAsDateOnly(e.event_date) <= today);

            return sendJSON(res, {
                stats: statsResult.rows[0],
                upcoming,
                past
            });

        } catch (err) {
            console.error("Error fetching organization summary:", err);
            return sendJSON(res, { error: "Server error" }, 500);
        }
    }
    // Return opportunity details
    else if (req.method === "GET") {
        if (auth.role !== "admin" && auth.role !== "organization") {
            return sendJSON(res, { error: "Only organizations or admins can update opportunities" }, 403);
        }
        const id = path.split("/")[2];
        try {
            const result = await pool.query("SELECT * FROM opportunities WHERE id = $1", [id]);

            if (result.rows.length === 0) {
                return sendJSON(res, { error: "Opportunity not found" }, 404);
            }

            sendJSON(res, result.rows[0]);
        } catch (error) {
            console.error("Error fetching opportunity by ID:", error.message);
            sendJSON(res, { error: "Database error" }, 500);
        }
    }
    // Route handling for updating an opportunity
    else if (req.method === "PUT") {
        console.log("In PUT route..")
        if (auth.role !== "admin" && auth.role !== "organization") {
            return sendJSON(res, { error: "Only organizations or admins can update opportunities" }, 403);
        }

        const id = path.split("/")[2];
        let body = "";
        req.on("data", (data) => (body += data));
        req.on("end", async () => {
            try {
                const raw = JSON.parse(body);

                const name = raw.name || "";
                const location = raw.location || "";
                const description = raw.description || "";

                const event_date = raw.event_date?.trim() ? raw.event_date : null;
                const start_time = raw.start_time?.trim() ? raw.start_time : null;
                const end_time = raw.end_time?.trim() ? raw.end_time : null;

                const contact_name = raw.contact_name || "";
                const contact_email = raw.contact_email || "";
                const contact_phone = raw.contact_phone || "";
                console.log("Editing opportunity with values:", {
                    name,
                    location,
                    description,
                    event_date,
                    start_time,
                    end_time,
                    contact_name,
                    contact_email,
                    contact_phone
                });

                const result = await pool.query(
                    `UPDATE opportunities SET
                        name = $1,
                        location = $2,
                        description = $3,
                        event_date = $4,
                        start_time = $5,
                        end_time = $6,
                        contact_name = $7,
                        contact_email = $8,
                        contact_phone = $9,
                        modified_by = $10
                     WHERE id = $11
                     RETURNING *`,
                    [
                        name,
                        location,
                        description,
                        event_date,
                        start_time,
                        end_time,
                        contact_name,
                        contact_email,
                        contact_phone,
                        auth.username,
                        id
                    ]
                );

                if (result.rows.length === 0) {
                    return sendJSON(res, { error: "Opportunity not found" }, 404);
                }

                console.log("Updated opportunity:", result.rows[0]);
                notifyAll(`Opportunity Updated: ${name}`);
                sendJSON(res, result.rows[0], 200);
            } catch (error) {
                console.error("Error updating opportunity:", error.message);
                sendJSON(res, { error: "Update failed", details: error.message }, 500);
            }
        });
    }
    // Allow admins to change user roles
    else if (req.method === "PATCH" && req.url.startsWith("/api/users/") && req.url.endsWith("/role")) {
        if (!auth || auth.role !== "admin") {
            return sendJSON(res, { error: "Forbidden" }, 403);
        }

        const id = req.url.split("/")[3];
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
            try {
                const { role } = JSON.parse(body);
                if (!["user", "organization", "admin"].includes(role)) {
                    return sendJSON(res, { error: "Invalid role" }, 400);
                }

                await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);
                return sendJSON(res, { success: true });
            } catch (err) {
                console.error("Error updating role:", err);
                return sendJSON(res, { error: "Server error" }, 500);
            }
        });
    }
    else if (req.method === "DELETE" && path.startsWith("/api/signups/")) {
        // Delete an event sign-up instance
        const opportunityId = path.split("/").pop();
        console.log("Matched DELETE /api/signups/* route with opportunityId =", opportunityId);

        try {
            const userResult = await pool.query("SELECT id FROM users WHERE username = $1", [auth.username]);
            const userId = userResult.rows[0]?.id;

            if (!userId) {
                return sendJSON(res, { error: "User not found" }, 404);
            }

            await pool.query(
                "DELETE FROM event_signups WHERE user_id = $1 AND opportunity_id = $2",
                [userId, opportunityId]
            );

            return sendJSON(res, { message: "Signup cancelled" }, 200);
        } catch (error) {
            console.error("Error cancelling signup:", error);
            return sendJSON(res, { error: "Server error" }, 500);
        }
    }
    //Delete opportunity
    else if (req.method === "DELETE") {
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

let sockets = [];
wsserver.on('connection', (ws) => {
    sockets.push(ws);
    console.log("WebSocket client connected");

    ws.send(JSON.stringify({ type: "welcome", message: "Connected to GoodNeighbor updates!" }));

    ws.on("close", () => {
        sockets = sockets.filter(s => s !== ws);
    });

});

// Upgrade handler for WebSocket connections at /ws
server.on("upgrade", (req, socket, head) => {
    if (req.url === "/ws") {
        wsserver.handleUpgrade(req, socket, head, (ws) => {
            wsserver.emit("connection", ws, req);
        });
    } else {
        socket.destroy();
    }
});

// Helper function to broadcast a string with WebSocket
const notifyAll = (message) => {
    sockets.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: "opportunity", message }));
        }
    });
};


server.listen(3000, () => console.log("Good Neighbor API running on port 3000"));
