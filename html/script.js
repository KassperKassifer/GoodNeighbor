document.addEventListener("DOMContentLoaded", () => {
    console.log("Page Loaded");

    // Check if the volunteer list exists before refreshing opportunities
    if (document.getElementById("opportunityList")) {
        refreshOpportunities();
    }

    // Check if the form exists before adding an event listener
    const form = document.getElementById("opportunityForm");
    if (form) {
        form.addEventListener("submit", addOpportunity);
    }

    // Check if the search field exists before adding event listeners
    const searchButton = document.getElementById("fetchOppByNameButton");
    if (searchButton) {
        searchButton.addEventListener("click", fetchOppByName);
    }
});

// Refresh Volunteer Opportunities
const refreshOpportunities = () => {
    console.log("Refreshing volunteer opportunities...");

    fetch('/api')
        .then(body => body.json())
        .then(opportunities => {
            const list = document.getElementById("opportunityList");
            if (!list) return; // Ensure the element exists

            list.innerHTML = "";

            opportunities.forEach((opportunity) => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    <strong>${opportunity.name}</strong> ${opportunity.location}
                    <button onclick="editOpportunity('${opportunity.id}')">Edit</button>
                    <button onclick="deleteOpportunity('${opportunity.id}')">Delete</button>
                `;
                list.appendChild(listItem);
            });

            console.log("Fetched Volunteer Opportunities:", opportunities);
        })
        .catch(error => console.error("Error fetching volunteer opportunities:", error));
};

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
            headers: { "Content-Type": "application/json" },
            body: requestBody
        });

        if (!response.ok) {
            let errorMessage = await response.text();
            throw new Error(`Failed to add opportunity: ${errorMessage}`);
        }

        let result = await response.json();
        console.log("Added opportunity:", result);

        refreshOpportunities(); // Refresh the volunteer list
        document.getElementById("opportunityForm").reset();
    } catch (error) {
        console.error("Error posting volunteer:", error);
    }
}

// GET all volunteers
async function fetchAllOpportunities() {
    try {
        let response = await fetch("/api");

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        let data = await response.json();
        console.log("All Volunteers:", data);
        alert(JSON.stringify(data, null, 2)); // Show data in an alert box
    } catch (error) {
        console.error("Error fetching all volunteers:", error);
        alert("Error fetching volunteers. Check console for details.");
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
        alert("Please enter a name to search.");
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
        alert("Error fetching opportunity. Check console for details.");
    }
}

// PUT: Edit an existing opportunity
async function editOpportunity(id) {
    const newName = prompt("Enter new opportunity name:");
    const newLocation = prompt("Enter new location:");

    if (!newName || !newLocation) return;

    try {
        let response = await fetch(`/api/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newName, location: newLocation })
        });

        if (!response.ok) throw new Error("Failed to edit opportunity");

        refreshOpportunities(); // Update the list after editing
    } catch (error) {
        console.error("Error editing opportunity:", error);
    }
}

// DELETE: Remove an opportunity
async function deleteOpportunity(id) {
    if (!confirm("Are you sure you want to delete this opportunity?")) return;

    try {
        let response = await fetch(`/api/${id}`, {
            method: "DELETE"
        });

        if (!response.ok) throw new Error("Failed to delete opportunity");

        refreshOpportunities(); // Update the list after deletion
    } catch (error) {
        console.error("Error deleting opportunity:", error);
    }
}
