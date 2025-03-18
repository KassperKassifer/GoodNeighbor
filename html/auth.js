document.addEventListener("DOMContentLoaded", () => {
    console.log("Auth script loaded");

    // Attach event listeners if forms exist on the page
    const registerForm = document.getElementById("registerForm");
    if (registerForm) registerForm.addEventListener("submit", registerUser);

    const loginForm = document.getElementById("loginForm");
    if (loginForm) loginForm.addEventListener("submit", loginUser);

    updateNav();
});

function updateNav() {
    console.log("In updateNav..")
    const navAuth = document.getElementById("navAuth");
    const authHeader = sessionStorage.getItem("authHeader");
    const userRole = sessionStorage.getItem("userRole"); // Get stored role

    if (authHeader) {
        // User is logged in -> Show Logout & Profile
        navAuth.innerHTML = `
            <a href="/index.html">Home</a>
            <a href="/events.html">Events</a>
            <a href="/profile.html">Profile</a>
            ${userRole === "admin" ? `<a href="/admin.html">Manage Users</a>` : ""}
            <a href="#" id="logoutLink">Logout</a>
        `;

        document.getElementById("logoutLink").addEventListener("click", logoutUser);
    } else {
        // User is logged out -> Show Login
        navAuth.innerHTML = `
            <a href="/index.html">Home</a>
            <a href="/events.html">Events</a>
            <a href="/login.html">Login</a>
        `;
    }
}

// Register User
async function registerUser(event) {
    event.preventDefault();
    const username = document.getElementById("regUsername").value;
    const password = document.getElementById("regPassword").value;

    if (!username || !password) {
        alert("Username and password required.");
        return;
    }

    try {
        let response = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        let data = await response.json();
        if (response.ok) {
            alert("Registration successful! Please log in.");
            window.location.href = "login.html"; // Redirect to login page
        } else {
            alert("Error: " + data.error);
        }
    } catch (error) {
        console.error("Registration error:", error);
    }
}

// Login User
async function loginUser(event) {
    event.preventDefault();
    const username = document.getElementById("loginUsername").value;
    const password = document.getElementById("loginPassword").value;

    if (!username || !password) {
        alert("Username and password required.");
        return;
    }

    const authHeader = "Basic " + btoa(username + ":" + password);

    try {
        let response = await fetch("/api", {
            method: "GET",
            headers: { "Authorization": authHeader }
        });

        let data = await response.json();

        if (response.ok) {
            sessionStorage.setItem("authHeader", authHeader);
            sessionStorage.setItem("userRole", data.role); // Store user role
            alert("Login successful!");
            window.location.href = "index.html"; // Redirect to homepage
        } else {
            alert("Invalid credentials: " + data.error);
        }
    } catch (error) {
        console.error("Login error:", error);
    }
}

// Check Authentication Status
function checkAuthStatus() {
    const authHeader = sessionStorage.getItem("authHeader");
    const statusElement = document.getElementById("authStatus");

    if (statusElement) {
        statusElement.innerText = authHeader ? "Logged in" : "Not logged in";
    }
}

// Logout User
function logoutUser() {
    sessionStorage.removeItem("authHeader");
    alert("Logged out successfully.");
    window.location.href = "login.html"; // Redirect to login
}

// Attach Auth Header to Requests
function getAuthHeaders() {
    const authHeader = sessionStorage.getItem("authHeader");
    return authHeader ? { "Authorization": authHeader } : {};
}
