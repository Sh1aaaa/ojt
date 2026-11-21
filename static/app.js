
const $ = id => document.getElementById(id);

let toastTimer;

function toast(message) {
    const el = $("toast");

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        el.classList.remove("show");
    }, 3500);
}

async function api(path, options = {}) {

    const response = await fetch(path, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}


function showLogin() {

    $("login-panel").classList.remove("hidden");
    $("register-panel").classList.add("hidden");
    $("dashboard").classList.add("hidden");

    $("login-error").textContent = "";
    $("register-error").textContent = "";
}


function showRegister() {

    $("login-panel").classList.add("hidden");
    $("register-panel").classList.remove("hidden");
    $("dashboard").classList.add("hidden");

    $("login-error").textContent = "";
    $("register-error").textContent = "";
}


function showDashboard(employee) {

    $("login-panel").classList.add("hidden");
    $("register-panel").classList.add("hidden");
    $("dashboard").classList.remove("hidden");

    $("logout").classList.remove("hidden");

    $("employee-name").textContent =
        employee.name || employee.email || "Employee";

    loadAttendance();
}


function formatDate(value) {

    if (!value) return "—";

    return new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(new Date(value));
}


function formatTime(value) {

    if (!value) return "—";

    return new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    }).format(new Date(value));
}


function updateClock() {

    const now = new Date();

    $("live-time").textContent =
        new Intl.DateTimeFormat("en-PH", {
            timeZone: "Asia/Manila",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        }).format(now);

    $("live-date").textContent =
        new Intl.DateTimeFormat("en-PH", {
            timeZone: "Asia/Manila",
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric"
        }).format(now);
}


// LOGIN

$("login-form").addEventListener("submit", async event => {

    event.preventDefault();

    $("login-error").textContent = "";

    const button = event.submitter;

    button.disabled = true;
    button.textContent = "SIGNING IN...";

    try {

        const data = await api("/api/login", {
            method: "POST",
            body: JSON.stringify({
                email: $("email").value,
                password: $("password").value
            })
        });

        showDashboard(data.employee);

        toast("Signed in successfully.");

    } catch (error) {

        $("login-error").textContent = error.message;

    } finally {

        button.disabled = false;
        button.textContent = "Sign in →";
    }

});


// REGISTRATION

$("register-form").addEventListener("submit", async event => {

    event.preventDefault();

    $("register-error").textContent = "";

    const password = $("register-password").value;
    const confirmPassword = $("confirm-password").value;

    if (password !== confirmPassword) {

        $("register-error").textContent =
            "Passwords do not match.";

        return;
    }

    const button = $("register-submit");

    button.disabled = true;
    button.textContent = "CREATING ACCOUNT...";

    try {

        const data = await api("/api/register", {
            method: "POST",

            body: JSON.stringify({

                full_name: $("register-name").value,

                employee_id: $("register-employee-id").value,

                email: $("register-email").value,

                password: password,

                confirm_password: confirmPassword

            })
        });

        $("register-form").reset();

        if (data.confirmed && data.employee) {

            showDashboard(data.employee);

            toast("Account created successfully!");

        } else {

            showLogin();

            $("email").value = $("register-email").value;

            $("login-error").textContent = data.message;

        }

    } catch (error) {

        $("register-error").textContent = error.message;

    } finally {

        button.disabled = false;
        button.textContent = "Create account →";
    }

});


// NAVIGATION

$("show-register").addEventListener("click", showRegister);

$("show-login").addEventListener("click", showLogin);


// ATTENDANCE

async function loadAttendance() {

    try {

        const data = await api("/api/attendance");

        const records = data.records || [];

        const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date());

        const current = records.find(record =>
            record.work_date === today
        );

        if (current) {

            if (current.time_out) {

                $("status-title").textContent = "Workday completed";

                $("status-desc").textContent =
                    "You have completed your attendance today.";

                $("status-pill").textContent = "COMPLETED";

                $("status-pill").className = "pill done";

            } else {

                $("status-title").textContent = "Currently working";

                $("status-desc").textContent =
                    "You have successfully clocked in.";

                $("status-pill").textContent = "CLOCKED IN";

                $("status-pill").className = "pill active";
            }

        } else {

            $("status-title").textContent = "Not clocked in";

            $("status-desc").textContent =
                "Record your time in when you start work.";

            $("status-pill").textContent = "NOT STARTED";

            $("status-pill").className = "pill neutral";
        }

        $("clock-in").disabled = !!current;

        $("clock-out").disabled =
            !current || !!current.time_out;


        $("history").innerHTML = records.length

            ? records.map(record => `
                <tr>
                    <td>${formatDate(record.work_date)}</td>
                    <td>${formatTime(record.time_in)}</td>
                    <td>${formatTime(record.time_out)}</td>
                    <td>
                        ${record.time_out ? "COMPLETED" : "IN PROGRESS"}
                    </td>
                </tr>
            `).join("")

            : `
                <tr>
                    <td colspan="4" class="empty">
                        No attendance records yet.
                    </td>
                </tr>
            `;

    } catch (error) {

        toast(error.message);
    }
}


async function recordAttendance(path) {

    const button = path.includes("clock-in")
        ? $("clock-in")
        : $("clock-out");

    button.disabled = true;

    try {

        const data = await api(path, {
            method: "POST",
            body: JSON.stringify({})
        });

        toast(data.message);

        await loadAttendance();

    } catch (error) {

        toast(error.message);

        await loadAttendance();
    }
}


$("clock-in").addEventListener("click", () => {
    recordAttendance("/api/clock-in");
});

$("clock-out").addEventListener("click", () => {
    recordAttendance("/api/clock-out");
});

$("refresh").addEventListener("click", loadAttendance);


// LOGOUT

$("logout").addEventListener("click", async () => {

    try {

        await api("/api/logout", {
            method: "POST",
            body: JSON.stringify({})
        });

        location.reload();

    } catch (error) {

        toast(error.message);
    }
});


// INITIALIZE

(async function initialize() {

    updateClock();

    setInterval(updateClock, 1000);

    try {

        const data = await api("/api/me");

        showDashboard(data.employee);

    } catch (_) {

        showLogin();
    }

})();
