document.addEventListener("DOMContentLoaded", () => {
    loadUserProfile();
});

function loadUserProfile() {
    const username = sessionStorage.getItem("username");
    const userRole = sessionStorage.getItem("userRole");
    const usernameElement = document.getElementById("profileUsername");
    const userRoleElement = document.getElementById("profileRole");

    if (usernameElement) {
        usernameElement.textContent = `Username: ${username || "Not logged in"}`;
    }
    if(userRoleElement){
        userRoleElement.textContent = `Role: ${userRole || "Not logged in"}`;
    }

    // Fetch event signups and hours here (note for later)
    loadUserEventSignups();
}

async function loadUserEventSignups() {
    const username = sessionStorage.getItem("username");
    const listElement = document.getElementById("signedUpEventsList");
    const hoursElement = document.getElementById("totalHours");

    if (!username) return;

    try {
        let response = await fetch("/api/signups", {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error("Could not fetch event data.");

        let data = await response.json();

        // Display events user signed up for
        if (data.signups && data.signups.length) {
            listElement.innerHTML = "";
            data.signups.forEach(ev => {
                console.log(ev)
                const item = document.createElement("li");
                item.textContent = `${ev.name} (${ev.location}) - ${ev.hours || 0} hrs`;
                listElement.appendChild(item);
            });
        } else {
            listElement.innerHTML = "<li>No signed-up events.</li>";
        }

        // Display total hours
        hoursElement.textContent = `Total Hours: ${data.totalHours || 0}`;
    } catch (error) {
        console.error("Error loading user events:", error);
    }
}