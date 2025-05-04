document.addEventListener("DOMContentLoaded", () => {
    console.log("Page Loaded");

    // Check if elements exist before adding event listeners or performing actions on them
    if (document.getElementById("opportunityList")) {
        refreshOpportunities();
    }

    const container = document.querySelector(".container");
    const userRole = sessionStorage.getItem("userRole");
    const formSection = document.getElementById("opportunityFormSection");

    if (formSection && ( userRole === "user" || userRole === null)) {
        formSection.style.display = "none";
    }

    // Count visible direct children of container in order to dynamically change the grid layout
    if(container){
        const visibleSections = Array.from(container.children).filter(
            (el) => el.style.display !== "none"
        );

        // If only one section is visible, switch to one column and center it horizontally
        if (visibleSections.length <= 1) {
            container.style.gridTemplateColumns = "1fr";
            container.style.justifyItems = "center";
        }
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

    const voiceBtn = document.getElementById("startVoiceSearch");
    if (voiceBtn) {
        voiceBtn.addEventListener("click", handleVoiceSearch);
    }
});

// Refresh Volunteer Opportunities
const refreshOpportunities = async () => {
    console.log("Refreshing volunteer opportunities...");

    try {
        // Always fetch events
        const eventRes = await fetch('/api/events');
        if (!eventRes.ok) throw new Error("Failed to fetch events");
        const opportunities = await eventRes.json();

        // Try fetching signups only if logged in
        let signedUpEventIds = [];
        const authHeader = getAuthHeaders();

        if (authHeader?.Authorization) {
            const signupRes = await fetch('/api/signups', { headers: authHeader });

            if (signupRes.ok) {
                const signups = await signupRes.json();
                signedUpEventIds = signups.signups.map(s => s.opportunity_id);
            } else {
                console.warn("User not signed in or signups not available");
            }
        }

        // Render the events
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

// Record speech using the Web Speech API and then notify user of result (if given permission)
// using the Notifications API
function handleVoiceSearch() {
    const spokenOutput = document.getElementById("spokenText");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Speech Recognition API is not supported in this browser.");
        return;
    }

    // Create and configure Speech Recognition 
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    // Indicate that the mic is on and listening
    recognition.onstart = () => {
        if (spokenOutput) {
            spokenOutput.textContent = "Listening...";
        }
    };

    // Set up event handlers
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        console.log(`Transcript: ${transcript} (Confidence: ${confidence})`);

        if (spokenOutput) {
            spokenOutput.textContent = `You said: "${transcript}"`;
        }

        showVolunteerNotification(transcript);
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        showToast("Error: " + event.error, "error");
        if (spokenOutput) {
            spokenOutput.textContent = "";
        }
    };

    recognition.onend = () => {
        console.log("Voice recognition ended.");
        
        // Only clear "Listening..." if no transcript came back
        if (spokenOutput && spokenOutput.textContent === "Listening...") {
            spokenOutput.textContent = "No speech detected.";
        }
    };

    // Start recording
    recognition.start();
}

// 
function showVolunteerNotification(transcript) {
    // Check if the browser supports notifications
    if (!("Notification" in window)) {
        alert("This browser does not support system notifications.");
        return;
    }

    // Check if permission was already granted
    if (Notification?.permission === "granted") {
        const notification = new Notification("GoodNeighbor Match", {
            body: `Found something for "${transcript}"!`,
        });

        // Optional: auto-close notification after 4 seconds
        setTimeout(() => notification.close(), 4000);
    }

    // Otherwise, request permission
    else if (Notification?.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                const notification = new Notification("GoodNeighbor Match", {
                    body: `Found something for "${transcript}"!`,
                });

                setTimeout(() => notification.close(), 4000);
            }
        });
    }

    // Explicitly denied permission
    else {
        showToast(`Found something for "${transcript}"!`, "success");
    }
}