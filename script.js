
const form = document.getElementById("itemForm");
const list = document.getElementById("items");
const search = document.getElementById("search");
const categoryFilter = document.getElementById("categoryFilter");
const statusFilter = document.getElementById("statusFilter");
const message = document.getElementById("message");
const submitButton = document.getElementById("submitButton");
const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("photoPreview");

const filterButtons = document.querySelectorAll(".filter-button");

let allItems = [];
let selectedFilter = "All";
let previewURL = null;

const today = new Date();
document.getElementById("itemDate").max =
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

async function api(url, options = {}) {
    const response = await fetch(url, options);

    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok) {
        throw new Error(data.error || "Request failed.");
    }

    return data;
}

function makeElement(tag, text = "", className = "") {
    const node = document.createElement(tag);
    node.textContent = text;

    if (className) node.className = className;

    return node;
}

function updateStatistics() {
    document.getElementById("totalCount").textContent =
        allItems.length;

    document.getElementById("lostCount").textContent =
        allItems.filter(item => item.type === "Lost").length;

    document.getElementById("foundCount").textContent =
        allItems.filter(item => item.type === "Found").length;
}

function makeAction(label, action, itemId, className = "") {
    const button = makeElement(
        "button",
        label,
        `item-action ${className}`.trim()
    );

    button.type = "button";

    button.addEventListener("click", async () => {
        button.disabled = true;

        try {
            await api(`/api/items/${itemId}/${action}`, {
                method: "POST"
            });

            await loadItems();
        } catch (error) {
            alert(error.message);
            button.disabled = false;
        }
    });

    return button;
}

function createCard(item) {
    const card = makeElement("article", "", "item-card");

    const top = makeElement("div", "", "item-topline");

    top.append(
        makeElement(
            "span",
            item.type === "Lost" ? "🔎" : "🤝",
            `item-symbol ${item.type === "Found" ? "found-symbol" : ""}`
        ),
        makeElement(
            "span",
            `${item.type.toUpperCase()} ITEM`,
            `item-tag ${item.type === "Lost" ? "lost-tag" : "found-tag"}`
        )
    );

    card.appendChild(top);

    // Uploaded image
    if (item.photo) {
        const image = document.createElement("img");
        image.className = "item-photo";
        image.src = item.photo;
        image.alt = item.name;
        image.loading = "lazy";

        image.addEventListener("error", () => image.remove());

        card.appendChild(image);
    }

    card.appendChild(makeElement("h3", item.name));

    card.appendChild(
        makeElement("p", item.description, "item-description")
    );

    card.appendChild(
        makeElement("p", `▦ ${item.category}`, "item-location")
    );

    card.appendChild(
        makeElement("p", `⌖ ${item.location}`, "item-location")
    );

    card.appendChild(
        makeElement("p", `Date: ${item.date}`, "item-location")
    );

    const status = makeElement(
        "p",
        `● ${item.status}`,
        "item-status"
    );

    card.appendChild(status);

    const actions = makeElement("div", "", "item-actions");

    if (item.status === "Available") {
        actions.appendChild(
            makeAction("Request to claim →", "claim", item.id)
        );
    }

    if (item.status === "Claim requested") {
        actions.appendChild(
            makeAction("✓ Approve claim", "approve", item.id)
        );

        actions.appendChild(
            makeAction("Reject claim", "reject", item.id, "return-action")
        );
    }

    if (
        item.status === "Available" ||
        item.status === "Claim requested" ||
        item.status === "Claim approved"
    ) {
        actions.appendChild(
            makeAction(
                "Mark as returned",
                "return",
                item.id,
                "return-action"
            )
        );
    }

    if (actions.childElementCount) {
        card.appendChild(actions);
    }

    return card;
}

function renderItems() {
    const query = search.value.trim().toLowerCase();
    const category = categoryFilter.value;
    const status = statusFilter.value;

    const visibleItems = allItems.filter(item => {
        const text = [
            item.name,
            item.location,
            item.description,
            item.category
        ].join(" ").toLowerCase();

        return (
            (selectedFilter === "All" || item.type === selectedFilter) &&
            (category === "All" || item.category === category) &&
            (status === "All" || item.status === status) &&
            text.includes(query)
        );
    });

    list.replaceChildren();

    document.getElementById("resultCount").textContent =
        `${visibleItems.length} ${visibleItems.length === 1 ? "report" : "reports"}`;

    if (visibleItems.length === 0) {
        const empty = makeElement("div", "", "empty-state");

        empty.append(
            makeElement("div", "🔍"),
            makeElement("strong", "No items found"),
            makeElement(
                "p",
                allItems.length
                    ? "Try a different keyword or filter."
                    : "No reports yet. Be the first to share one!"
            )
        );

        list.appendChild(empty);
        return;
    }

    visibleItems.forEach(item => {
        list.appendChild(createCard(item));
    });
}

async function loadItems() {
    try {
        allItems = await api("/api/items");
        updateStatistics();
        renderItems();
    } catch (error) {
        list.replaceChildren(
            makeElement(
                "div",
                "Unable to load reports. Check that the Python server is running and refresh.",
                "empty-state"
            )
        );

        console.error(error);
    }
}

// Preview a selected photo
photoInput.addEventListener("change", () => {
    const file = photoInput.files[0];

    if (previewURL) {
        URL.revokeObjectURL(previewURL);
        previewURL = null;
    }

    photoPreview.hidden = true;
    photoPreview.removeAttribute("src");

    if (!file) return;

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
    ];

    if (!allowedTypes.includes(file.type) || file.size > 5 * 1024 * 1024) {
        alert("Choose a JPG, PNG, WEBP or GIF image no larger than 5 MB.");
        photoInput.value = "";
        return;
    }

    previewURL = URL.createObjectURL(file);
    photoPreview.src = previewURL;
    photoPreview.hidden = false;
});

// Submit a new report
form.addEventListener("submit", async event => {
    event.preventDefault();

    submitButton.disabled = true;
    message.textContent = "Publishing your report...";

    try {
        const formData = new FormData(form);

        await api("/api/items", {
            method: "POST",
            body: formData
        });

        form.reset();

        if (previewURL) {
            URL.revokeObjectURL(previewURL);
            previewURL = null;
        }

        photoPreview.hidden = true;
        photoPreview.removeAttribute("src");

        message.textContent = "✓ Your report has been published!";
        await loadItems();

        document.getElementById("browse").scrollIntoView({
            behavior: "smooth"
        });
    } catch (error) {
        message.textContent = `Error: ${error.message}`;
    } finally {
        submitButton.disabled = false;
    }
});

// Keyword search and dropdown filters
search.addEventListener("input", renderItems);
categoryFilter.addEventListener("change", renderItems);
statusFilter.addEventListener("change", renderItems);

// Lost / Found / All filter buttons
filterButtons.forEach(button => {
    button.addEventListener("click", () => {
        selectedFilter = button.dataset.filter;

        filterButtons.forEach(filter => {
            const active = filter === button;

            filter.classList.toggle("active", active);
            filter.setAttribute("aria-pressed", String(active));
        });

        renderItems();
    });
});

// Initial load
loadItems();