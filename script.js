let reportType = "Lost";



function showForm(type) {

    document.getElementById("loginForm").hidden = true;
    document.getElementById("signupForm").hidden = true;
    document.getElementById("reportForm").hidden = true;

    if (type === "login") {

        document.getElementById("loginForm").hidden = false;

    }

    if (type === "signup") {

        document.getElementById("signupForm").hidden = false;

    }

    if (type === "lost" || type === "found") {

        reportType =
            type === "lost"
                ? "Lost"
                : "Found";

        document.getElementById("formTitle").innerText =
            "Report " + reportType + " Item";

        document.getElementById("reportForm").hidden = false;
    }
}



async function signup() {

    const name =
        document.getElementById("signupName").value;

    const studentId =
        document.getElementById("studentId").value;

    const email =
        document.getElementById("signupEmail").value;

    const password =
        document.getElementById("signupPassword").value;


    if (!name || !studentId ||
        !email || !password) {

        document.getElementById("signupMessage")
            .innerText =
            "Please fill all fields.";

        return;
    }


    const response =
        await fetch("/api/signup", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                name,
                studentId,
                email,
                password
            })

        });


    const data =
        await response.json();


    document.getElementById("signupMessage")
        .innerText = data.message;

}



async function login() {

    const email =
        document.getElementById("loginEmail").value;

    const password =
        document.getElementById("loginPassword").value;


    const response =
        await fetch("/api/login", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                email,
                password
            })

        });


    const data =
        await response.json();


    document.getElementById("loginMessage")
        .innerText = data.message;


    if (data.success) {

        localStorage.setItem(
            "student",
            JSON.stringify(data.user)
        );

        document.getElementById("logoutBtn")
            .hidden = false;

    }

}


// ==========================
// LOGOUT
// ==========================

function logout() {

    localStorage.removeItem("student");

    document.getElementById("logoutBtn")
        .hidden = true;

    alert("Logged out successfully.");

}


// ==========================
// SUBMIT LOST / FOUND ITEM
// ==========================

document.getElementById("itemForm")
    .addEventListener("submit", async function(e) {

        e.preventDefault();


        const student =
            localStorage.getItem("student");


        if (!student) {

            alert("Please login first.");

            showForm("login");

            return;
        }


        const formData =
            new FormData();


        formData.append(
            "type",
            reportType
        );

        formData.append(
            "name",
            document.getElementById("itemName").value
        );

        formData.append(
            "category",
            document.getElementById("category").value
        );

        formData.append(
            "description",
            document.getElementById("description").value
        );

        formData.append(
            "location",
            document.getElementById("location").value
        );

        formData.append(
            "date",
            document.getElementById("date").value
        );

        formData.append(
            "photo",
            document.getElementById("itemPhoto").files[0]
        );


        const response =
            await fetch("/api/reports", {

                method: "POST",

                body: formData

            });


        const data =
            await response.json();


        document.getElementById("reportMessage")
            .innerText = data.message;


        if (data.success) {

            document.getElementById("itemForm")
                .reset();

            loadItems();

        }

    });




async function loadItems() {

    const response =
        await fetch("/api/reports");

    const reports =
        await response.json();


    const search =
        document.getElementById("search")
            .value
            .toLowerCase();


    const filter =
        document.getElementById("filter")
            .value;


    const filtered =
        reports.filter(item => {

            const matchesSearch =
                item.name
                    .toLowerCase()
                    .includes(search) ||

                item.category
                    .toLowerCase()
                    .includes(search);


            const matchesFilter =
                filter === "All" ||
                item.type === filter;


            return matchesSearch &&
                   matchesFilter;

        });


    displayItems(filtered);

    updateStats(reports);

}




function displayItems(items) {

    const list =
        document.getElementById("itemList");

    list.innerHTML = "";


    if (items.length === 0) {

        list.innerHTML =
            "<p>No items found.</p>";

        return;
    }


    items.forEach(item => {

        const card =
            document.createElement("div");

        card.className = "card";


        card.innerHTML = `

            <img src="${item.photo}"
                 alt="${item.name}">

            <div class="card-content">

                <span class="badge
                ${item.type === "Lost"
                    ? "lost"
                    : "found"}">

                    ${item.type}

                </span>

                <h3>
                    ${item.name}
                </h3>

                <p>
                    <b>Category:</b>
                    ${item.category}
                </p>

                <p>
                    <b>Description:</b>
                    ${item.description}
                </p>

                <p>
                    <b>Location:</b>
                    ${item.location}
                </p>

                <p>
                    <b>Date:</b>
                    ${item.date}
                </p>

                <p>
                    <b>Reported by:</b>
                    ${item.reportedBy}
                </p>

            </div>
        `;


        list.appendChild(card);

    });

}



function updateStats(reports) {

    const lost =
        reports.filter(
            item => item.type === "Lost"
        ).length;


    const found =
        reports.filter(
            item => item.type === "Found"
        ).length;


    document.getElementById("lostCount")
        .innerText = lost;


    document.getElementById("foundCount")
        .innerText = found;


    document.getElementById("totalCount")
        .innerText = reports.length;

}



const student =
    localStorage.getItem("student");

if (student) {

    document.getElementById("logoutBtn")
        .hidden = false;

}



loadItems();