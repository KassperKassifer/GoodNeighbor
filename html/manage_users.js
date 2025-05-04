document.addEventListener("DOMContentLoaded", async () => {
    console.log("Manage Users page loaded");
    
    const role = sessionStorage.getItem("userRole");
    if (role !== "admin") {
        window.location.href = "/unauthorized.html";
        return;
    }

    const table = document.getElementById("userTable");
    if (table) {
        fetchAndRenderUsers();
        table.addEventListener("change", handleRoleChange);
    }
});

// Fetch and render all users
async function fetchAndRenderUsers() {
    try {
        const res = await fetch("/api/users", {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error("Unauthorized or error loading users");

        const users = await res.json();
        const tbody = document.querySelector("#userTable tbody");
        tbody.innerHTML = ""; // Clear existing rows

        users.forEach(user => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td data-label="ID">${user.id}</td>
                <td data-label="Username">${user.username}</td>
                <td data-label="Role">
                    <select data-user-id="${user.id}">
                        ${["user", "organization", "admin"].map(role =>
                            `<option value="${role}" ${user.role === role ? "selected" : ""}>${role}</option>`
                        ).join("")}
                    </select>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        alert("Failed to load users.");
        console.error(err);
    }
}

// Handle role dropdown change
async function handleRoleChange(event) {
    if (event.target.tagName !== "SELECT") return;

    const userId = event.target.getAttribute("data-user-id");
    const newRole = event.target.value;

    try {
        const res = await fetch(`/api/users/${userId}/role`, {
            method: "PATCH",
            headers: {
                ...getAuthHeaders(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ role: newRole })
        });

        if (!res.ok) throw new Error("Role update failed");
        showToast("Role updated successfully");
    } catch (err) {
        alert("Error updating role");
        console.error(err);
    }
}