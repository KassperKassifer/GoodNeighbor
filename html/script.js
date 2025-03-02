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
                listItem.textContent = `${opportunity.name} - ${opportunity.location}`;
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

    try {
        let response = await fetch('/api', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, location })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
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
