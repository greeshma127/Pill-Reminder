import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import session from "express-session";

const app = express();
const port = 3000;

app.use(session({
    secret: "secret", // Change this to a strong secret
    resave: false,
    saveUninitialized: true
}));

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "pill_reminder",
    password: "pg2003",
    port: 5432,
});

db.connect();

app.set("view engine", "ejs");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.listen(port, () => {
    console.log(`Server running at port ${port}`);
});

app.get("/", (req, res) => {
    res.render("login.ejs");
});

app.get("/settings",(req,res)=>{
    res.render("settings.ejs");
});

app.get("/my-pills", async(req,res)=>{
    const result=await db.query("SELECT * FROM pills");
    const pills = result.rows;

    res.render("my-pills", { username: req.session.username, pills });
})

app.post("/login", async (req, res) => {
    const { username, pw } = req.body;
    try {
        const result = await db.query("SELECT * FROM users WHERE username = $1 AND password = $2", [username, pw]);
        if (result.rows.length > 0) {
            req.session.username = result.rows[0].username;
            res.redirect("/home"); // Redirect to the home page on successful login
        } else {
            res.send("Invalid username or password");
        }
    } catch (error) {
        console.error("Login error:", error);
        res.send("An error occurred");
    }
});

app.get("/home", async (req, res) => {
    try {
        if (!req.session.username) {
            return res.redirect("/login"); // Redirect if not logged in
        }

        const result = await db.query("SELECT * FROM pills");
        const pills = result.rows;

        // Fetch appointments from the database
        const appointmentResult = await db.query("SELECT * FROM appointments");
        const appointments = appointmentResult.rows;

        res.render("home", { username: req.session.username, pills, appointments }); // Pass both pills and appointments
    } catch (error) {
        console.error("Error retrieving pills or appointments:", error);
        res.send("An error occurred while loading the homepage.");
    }
});

// Route to render the add appointment form
app.get("/add-appointment", (req, res) => {
    res.render("add-appointment"); // Create this EJS file for the form
});


app.get("/signout", (req, res) => {
    // Perform sign-out actions like clearing the session
    res.redirect("/"); // Redirect to the login page
});

app.get("/add", (req, res) => {
    res.render("add");
});

app.post("/add", async (req, res) => {
    const { pillName, dosage, unit, frequency, reminderTime1, reminderTime2 } = req.body;
    try {
        await db.query(
            "INSERT INTO pills (pill_name, dosage, unit, frequency, reminder_time1, reminder_time2) VALUES ($1, $2, $3, $4, $5, $6)",
            [pillName, dosage, unit, frequency, reminderTime1, reminderTime2 || null]
        );
        res.redirect("/home");
    } catch (error) {
        console.error("Error adding pill:", error);
        res.send("An error occurred while adding the pill.");
    }
});

app.get("/edit/:id", async (req, res) => {
    const pillId = req.params.id;

    try {
        const result = await db.query("SELECT * FROM pills WHERE id = $1", [pillId]);
        const pill = result.rows[0]; // Get the first pill if it exists

        if (!pill) {
            // If pill is not found, handle the error gracefully
            return res.status(404).send("Pill not found");
        }

        res.render("edit", { pill }); // Render the edit page with the pill data
    } catch (error) {
        console.error("Error fetching pill for edit:", error);
        res.status(500).send("An error occurred while retrieving the pill.");
    }
});


app.post("/edit/:id", async (req, res) => {
    const pillId = req.params.id;
    const { pillName, dosage, unit = 'pill', reminderTime1, reminderTime2 } = req.body;

    try {
        await db.query(
            "UPDATE pills SET pill_name = $1, dosage = $2, unit = $3, reminder_time1 = $4, reminder_time2 = $5 WHERE id = $6",
            [pillName, dosage, unit, reminderTime1, reminderTime2 || null, pillId]
        );
        res.redirect("/home"); // Redirect to the homepage after a successful update
    } catch (error) {
        console.error("Error updating pill:", error);
        res.send("An error occurred while updating the pill.");
    }
});

app.post("/delete/:id", async (req, res) => {
    const pillId = req.params.id;

    try {
        const result = await db.query("DELETE FROM pills WHERE id = $1", [pillId]);
        if (result.rowCount === 0) {
            console.log(`No pill found with ID: ${pillId}`);
        }
        res.redirect("/home"); // Redirect to the homepage after deletion
    } catch (error) {
        console.error("Error deleting pill:", error);
        res.send("An error occurred while deleting the pill.");
    }
});

// Get the appointment for editing
app.get("/edit-appointment/:id", async (req, res) => {
    const appointmentId = req.params.id;
    try {
        const result = await db.query("SELECT * FROM appointments WHERE id = $1", [appointmentId]);
        const appointment = result.rows[0];
        res.render("edit-appointment", { appointment });
    } catch (error) {
        console.error("Error fetching appointment for edit:", error);
        res.send("An error occurred while retrieving the appointment.");
    }
});

app.post("/edit-appointment/:id", async (req, res) => {
    const appointmentId = req.params.id;
    const { department, date, time } = req.body;
    try {
        await db.query(
            "UPDATE appointments SET department = $1, date = $2, time = $3 WHERE id = $4",
            [department, date, time, appointmentId]
        );
        res.redirect("/home"); // Redirect to the homepage after successful update
    } catch (error) {
        console.error("Error updating appointment:", error);
        res.send("An error occurred while updating the appointment.");
    }
});

app.post("/delete-appointment/:id", async (req, res) => {
    const appointmentId = req.params.id;
    try {
        await db.query("DELETE FROM appointments WHERE id = $1", [appointmentId]);
        res.redirect("/home"); // Redirect to the homepage after deletion
    } catch (error) {
        console.error("Error deleting appointment:", error);
        res.send("An error occurred while deleting the appointment.");
    }
});


app.post("/add-appointment", async (req, res) => {
    const { department, date, time } = req.body;

    try {
        await db.query(
            "INSERT INTO appointments (department, date, time) VALUES ($1, $2, $3)",
            [department, date, time]
        );
        res.redirect("/home"); // Redirect back to home after adding
    } catch (error) {
        console.error("Error adding appointment:", error);
        res.send("An error occurred while adding the appointment.");
    }
});

// Route to render the create account form
app.get("/create-account", (req, res) => {
    res.render("create-account"); // Create this EJS file for the form
});

// Route to handle account creation
app.post("/create-account", async (req, res) => {
    const { username, pw } = req.body;
    try {
        await db.query("INSERT INTO users (username, password) VALUES ($1, $2)", [username, pw]);
        res.redirect("/"); // Redirect to login after account creation
    } catch (error) {
        console.error("Error creating account:", error);
        res.send("An error occurred while creating the account.");
    }
});


