document.addEventListener("DOMContentLoaded", async () => {
    console.log("In org dashboard..");
    const role = sessionStorage.getItem("userRole");
    if (role !== "organization") {
        window.location.href = "/unauthorized.html";
        return;
    }

    const res = await fetch("/api/org/dashboard", { headers: getAuthHeaders() });
    const data = await res.json();

    renderStats(data);
    renderEvents(data.upcoming, data.past);
});

function renderStats(data) {
    console.log("Rendering org stats..");
    const container = document.getElementById("statsSummary");
    container.innerHTML = `
      <div class="stat-card">Events Posted: ${data.stats.event_count}</div>
      <div class="stat-card">Total Signups: ${data.stats.total_signups}</div>
      <div class="stat-card">Volunteer Hours: ${data.stats.total_hours}</div>
    `;
}

function renderEvents(upcoming = [], past = []) {
    console.log("Rendering org events..");
    const container = document.getElementById("eventBreakdown");
    container.innerHTML = ""; // Clear previous content

    // Create section for upcoming events
    const upcomingSection = document.createElement("section");
    upcomingSection.innerHTML = `<h3>Upcoming Events</h3>`;
    const upcomingList = document.createElement("ul");
    upcomingList.classList.add("event-list");

    if (upcoming.length === 0) {
        upcomingList.innerHTML = `<li>No upcoming events</li>`;
    } else {
        upcoming.forEach(event => {
            const li = document.createElement("li");
            li.className = "stat-card";
            li.textContent = `${event.name} - ${formatDate(event.event_date)}`;
            upcomingList.appendChild(li);
        });
    }

    upcomingSection.appendChild(upcomingList);
    container.appendChild(upcomingSection);

    // Create section for past events
    const pastSection = document.createElement("section");
    pastSection.innerHTML = `<h3>Past Events</h3>`;
    const pastList = document.createElement("ul");
    pastList.classList.add("event-list");

    if (past.length === 0) {
        pastList.innerHTML = `<li>No past events</li>`;
    } else {
        past.forEach(event => {
            const li = document.createElement("li");
            li.textContent = `${event.name} - ${formatDate(event.event_date)}`;
            pastList.appendChild(li);
        });
    }

    pastSection.appendChild(pastList);
    container.appendChild(pastSection);
}

// Helper to convert ISO strings to something readable
function formatDate(isoDate) {
    const date = new Date(isoDate);
    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}