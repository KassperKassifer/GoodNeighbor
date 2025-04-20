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

    // Fetch event signups and hours
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

                const cancelBtn = document.createElement("button");
                cancelBtn.textContent = "Cancel Signup";
                cancelBtn.onclick = () => cancelSignup(ev.opportunity_id);
                item.appendChild(cancelBtn);
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

async function cancelSignup(opportunityId) {
    console.log("Canceling signup for:", opportunityId);
    if (!confirm("Are you sure you want to cancel this signup?")) return;

    try {
        const response = await fetch(`/api/signups/${opportunityId}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error("Failed to cancel signup");

        showToast("Successfully canceled successfully!", "success");
        loadUserEventSignups(); // refresh signed-up list
    } catch (err) {
        console.error("Cancel signup failed:", err);
        showToast("Something went wrong while canceling.", "error");
    }
}