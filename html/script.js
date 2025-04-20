document.addEventListener("DOMContentLoaded", () => {
    console.log("Page Loaded");

    // Check if elements exist before adding event listeners or performing actions on them
    if (document.getElementById("opportunityList")) {
        refreshOpportunities();
    }

    const container = document.querySelector(".container");
    const userRole = sessionStorage.getItem("userRole");
    const formSection = document.getElementById("opportunityFormSection");

    if (formSection && userRole === "user") {
        formSection.style.display = "none";
    }

    // Count visible direct children of container in order to dynamically change the grid layout
    const visibleSections = Array.from(container.children).filter(
        (el) => el.style.display !== "none"
    );

    // If only one section is visible, switch to one column and center it horizontally
    if (visibleSections.length <= 1) {
        container.style.gridTemplateColumns = "1fr";
        container.style.justifyItems = "center";
    }

    const form = document.getElementById("opportunityForm");
    if (form) {
        form.addEventListener("submit", addOpportunity);
    }

    const searchButton = document.getElementById("fetchOppByNameButton");
    if (searchButton) {
        searchButton.addEventListener("click", fetchOppByName);
    }

    const editForm = document.getElementById("editForm");
    if (editForm) {
        editForm.addEventListener("submit", editOpportunityFormHandler);
    }
});

// Refresh Volunteer Opportunities
const refreshOpportunities = async () => {
    console.log("Refreshing volunteer opportunities...");

    try {
        // Fetch both events and user signups in parallel
        const [eventRes, signupRes] = await Promise.all([
            fetch('/api/events'),
            fetch('/api/signups', { headers: getAuthHeaders() })
        ]);

        if (!eventRes.ok || !signupRes.ok) {
            throw new Error("Failed to fetch events or signups");
        }

        const opportunities = await eventRes.json();
        const signups = await signupRes.json();
        const signedUpEventIds = signups.signups.map(s => s.opportunity_id);

        const list = document.getElementById("opportunityList");
        if (!list) return;

        list.innerHTML = "";

        opportunities.forEach((opportunity) => {
            const listItem = document.createElement('li');

            const userRole = sessionStorage.getItem("userRole");
            const userHasSignedUp = signedUpEventIds.includes(opportunity.id);

            listItem.innerHTML = `
                <div class="opportunity-content">
                    <strong>${opportunity.name}</strong> ${opportunity.location}
                    <br><em>Last modified by: ${opportunity.modified_by || "Unknown"}</em>
                </div>

                <div class="button-group">
                    ${
                        userRole === "user" 
                            ? (!userHasSignedUp
                                ? `<button onclick="signUpForEvent(${opportunity.id})">Sign Up</button>`
                                : `<span class="badge success">Signed Up</span>`)
                            : ""
                    }
                    ${
                        (userRole === "admin" || userRole === "organization")
                            ? `<button onclick='openEditModal(${JSON.stringify(opportunity)})'>Edit</button>
                               <button onclick="deleteOpportunity(${opportunity.id})">Delete</button>`
                            : ""
                    }
                </div>
            `;

            list.appendChild(listItem);
        });

        console.log("Fetched Volunteer Opportunities:", opportunities);
    } catch (error) {
        console.error("Error refreshing volunteer opportunities:", error);
    }
};

function showToast(msg, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("fade-out"), 3000);
    setTimeout(() => toast.remove(), 4000);
}

// POST new volunteer
async function addOpportunity(event) {
    event.preventDefault();
    console.log("addOpportunity() function is running!");

    const nameField = document.getElementById("name");
    const locationField = document.getElementById("location");

    if (!nameField || !locationField) {
        console.error("Form fields not found.");
        return;
    }

    let name = nameField.value;
    let location = locationField.value;

    if (!name || !location) {
        console.error("Form fields cannot be empty.");
        return;
    }

    const requestBody = JSON.stringify({ name, location });
    console.log("Sending data:", requestBody);

    try {
        let response = await fetch('/api', {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": sessionStorage.getItem("authHeader")
            },
            body: requestBody
        });

        if (!response.ok) {
            let errorMessage = await response.text();
            throw new Error(`Failed to add opportunity: ${errorMessage}`);
        }

        refreshOpportunities(); // Refresh the volunteer list
        document.getElementById("opportunityForm").reset();
    } catch (error) {
        console.error("Error posting volunteer:", error);
    }
}

// GET all volunteers
async function fetchAllOpportunities() {
    try {
        let response = await fetch("/api/events");

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        let data = await response.json();
        console.log("All Volunteer Opportunities:", data);
        alert(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error fetching all volunteers:", error);
        showToast("Error fetching volunteers. Check console for details.", "error");
    }
}

// GET an opportunity by name
async function fetchOppByName() {
    const searchField = document.getElementById("oppNameSearch");
    if (!searchField) {
        console.error("Search field not found.");
        return;
    }

    let name = searchField.value;
    if (!name) {
        showToast("Please enter a name to search.", "error");
        return;
    }

    try {
        let response = await fetch(`/api?name=${encodeURIComponent(name)}`);

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        let data = await response.json();
        console.log(`Opportunity (${name}):`, data);
        alert(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error fetching opportunity by name:", error);
        showToast("Error fetching opportunity. Check console for details.", "error");
    }
}

// DELETE: Remove an opportunity
async function deleteOpportunity(id) {
    if (!confirm("Are you sure you want to delete this opportunity?")) return;

    try {
        let response = await fetch(`/api/${id}`, {
            method: "DELETE",
            headers: {
                "Authorization": sessionStorage.getItem("authHeader")
            }
        });

        if (!response.ok) throw new Error("Failed to delete opportunity");

        refreshOpportunities(); // Update the list after deletion
    } catch (error) {
        console.error("Error deleting opportunity:", error);
    }
}


// POST: Sign up for opportunity (authenticated users only)
async function signUpForEvent(selected_opportunity_id) {
    const username = sessionStorage.getItem("username");
    if (!username) {
        showToast("You must be logged in to sign up for an event.");
        return;
    }

    const inputHours = prompt("How many hours do you expect to volunteer?");
    if (!inputHours || isNaN(inputHours)) return showToast("Invalid number of hours.", "error");

    try {
        let response = await fetch("/api/signup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify({ opportunity_id: selected_opportunity_id, hours: Number(inputHours) })
        });
        
        if (response.ok) {
            showToast("Successfully signed up for event!", "success");
        } else {
            let data = await response.json();
            showToast("Signup Failed: " + (data.error || "Unknown error."), "error");
        }
    } catch (error) {
        console.error("Error signing up:", error);
        showToast("An error occurred while signing up.", "error");
    }
}

// PUT: Edit an existing opportunity
async function editOpportunity(id) {
    console.log("In editOpportunity()...")
    // Show a modal or form to collect updated info
    const name = document.getElementById("editName")?.value || "";
    const location = document.getElementById("editLocation")?.value || "";
    const description = document.getElementById("editDescription")?.value || "";
    const event_date = document.getElementById("editDate")?.value || "";
    const start_time = document.getElementById("editStartTime")?.value || "";
    const end_time = document.getElementById("editEndTime")?.value || "";
    const contact_name = document.getElementById("editContactName")?.value || "";
    const contact_email = document.getElementById("editContactEmail")?.value || "";
    const contact_phone = document.getElementById("editContactPhone")?.value || "";

    try {
        const response = await fetch(`/api/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": sessionStorage.getItem("authHeader")
            },
            body: JSON.stringify({
                name,
                location,
                description,
                event_date,
                start_time,
                end_time,
                contact_name,
                contact_email,
                contact_phone
            })
        });

        if (!response.ok) throw new Error("Failed to edit opportunity");

        refreshOpportunities(); // Refresh the event list
        showToast("Opportunity updated!", "success");
    } catch (error) {
        console.error("Error editing opportunity:", error);
        showToast("An error occurred while updating the opportunity.", "error");
    }
}

async function editOpportunityFormHandler(e) {
    e.preventDefault();
    const id = document.getElementById("editId")?.value;

    const updated = {
        name: document.getElementById("editName")?.value || "",
        location: document.getElementById("editLocation")?.value || "",
        description: document.getElementById("editDescription")?.value || "",
        event_date: document.getElementById("editEventDate")?.value || "",
        start_time: document.getElementById("editStartTime")?.value || "",
        end_time: document.getElementById("editEndTime")?.value || "",
        contact_name: document.getElementById("editContactName")?.value || "",
        contact_email: document.getElementById("editContactEmail")?.value || "",
        contact_phone: document.getElementById("editContactPhone")?.value || ""
    };

    // Client-side validation
    if (!updated.name.trim() || !updated.location.trim()) {
        showToast("Please fill in all required fields (Name and Location).");
        return;
    }

    if (updated.event_date) {
        const selectedDate = new Date(updated.event_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Ignore time when comparing
        if (selectedDate < today) {
            showToast("Event date cannot be in the past.");
            return;
        }
    }

    try {
        const response = await fetch(`/api/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify(updated)
        });

        if (!response.ok) throw new Error("Failed to update opportunity");

        showToast("Opportunity updated successfully!", "success");
        closeEditModal();
        refreshOpportunities();
    } catch (error) {
        console.error("Error updating opportunity:", error);
        showToast("Update failed. See console for details.", "error");
    }
}

// Open and populate opportunity editor modal
function openEditModal(opportunity) {
    console.log("Editing opportunity ID:", opportunity.id);
    document.getElementById("editId").value = opportunity.id;
    document.getElementById("editName").value = opportunity.name;
    document.getElementById("editLocation").value = opportunity.location || "";
    document.getElementById("editDescription").value = opportunity.description || "";
    document.getElementById("editEventDate").value = opportunity.event_date || "";
    document.getElementById("editStartTime").value = opportunity.start_time || "";
    document.getElementById("editEndTime").value = opportunity.end_time || "";
    document.getElementById("editContactName").value = opportunity.contact_name || "";
    document.getElementById("editContactEmail").value = opportunity.contact_email || "";
    document.getElementById("editContactPhone").value = opportunity.contact_phone || "";
    document.getElementById("editModal").style.display = "flex";
}
  
function closeEditModal() {
    document.getElementById("editModal").style.display = "none";
}

// WebSocket setup from class
let wsurl
if(window.location.protocol == 'http:') {
    // assume dev environment. Very sad, http-server doesn't proxy ws :(
    wsurl = 'ws://localhost:3000/ws'
} else {
    // Prod mode 
    wsurl = 'wss://' + window.location.host + '/ws'
}
let sock = new WebSocket(wsurl);

sock.addEventListener('open', () => {
    console.log("WebSocket connected to", wsurl);
});

sock.addEventListener('message', ({ data }) => {
    try {
        const msg = JSON.parse(data);
        if (msg.type === "opportunity") {
            console.log("WS Notification:", msg.message);
            showToast(msg.message);
            refreshOpportunities(); // Auto-refresh
        }
    } catch (e) {
        console.error("WebSocket JSON parse error:", e);
    }
});

// Diplay WebSocket notifications 
function showToast(msg) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("fade-out");
    }, 4000);

    setTimeout(() => {
        toast.remove();
    }, 5000);
}