document.addEventListener("DOMContentLoaded", () => {
    const usernameDisplay = document.getElementById("profileUsername");
    const roleDisplay = document.getElementById("profileRole");

    const storedUsername = sessionStorage.getItem("username");

    if (storedUsername) {
        usernameDisplay.textContent = `Username: ${storedUsername}`;
        roleDisplay.style.display = "none"; // Hide the role section for now (future iteration)
    } else {
        usernameDisplay.textContent = "Username: Not logged in";
        roleDisplay.textContent = "Role: Unknown";
    }

    // Placeholder volunteer info (can be updated once backend tracking is done)
    const totalHours = document.getElementById("totalHours");
    totalHours.textContent = "Total Hours: 0";

    const signedUpList = document.getElementById("signedUpEventsList");
    signedUpList.innerHTML = `<li>You haven't signed up for any events yet.</li>`;
});
