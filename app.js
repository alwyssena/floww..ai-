const express = require("express");
const {collection,transaction} = require("./mongo"); // Assuming this is your MongoDB model

const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");

const app = express();
app.use(express.json());
app.use(bodyParser.json());
app.use(cors());

// POST /login route
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await collection.findOne({ username:username });
        if (user) {
            const isPasswordMatched = await bcrypt.compare(password, user.password);
            if (isPasswordMatched) {
                const payload = { username:username };
                const token = jwt.sign(payload, "INDRA", { expiresIn: '1d' });
                return res.json({ token });
            } else {
                return res.status(401).json("Invalid password");
            }
        } else {
            return res.status(404).json("User not found");
        }
    } catch (e) {
        console.error("Login error:", e);
        return res.status(500).json("Login failed due to server error");
    }
});

// POST /signup route
app.post("/signup", async (req, res) => {
    const { username, password } = req.body;

    // Check if the username and password are provided
    if (!username || !password) {
        return res.status(400).json({ status: "error", message: "Missing required fields" });
    }

    try {
        // Check if the user already exists
        const check = await collection.findOne({ username: username });
        if (check) {
            return res.status(409).json({ status: "error", message: "User already exists" });
        }

        // Hash the password before storing it
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create a new user object
        const newUser = { username, password: hashedPassword };

        // Insert the new user into the collection
        await collection.create(newUser);
        return res.status(201).json({ status: "success", message: "User created successfully" });

    } catch (e) {
        console.error("Signup error:", e);
        return res.status(500).json({ status: "error", message: "Internal server error" });
    }
});


const authenticateToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    console.log(authHeader)
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "INDRA", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.username = payload.username;
          next();
        }
      });
    }
  };



app.post("/transactions", async (req, res) => {
    const { type, category, amount, description } = req.body;

    // Validate the input data
    if (!type || !category || !amount) {
        return res.status(400).json({ status: "error", message: "Missing required fields" });
    }

    // Ensure the type is either 'income' or 'expense'
    if (type !== 'income' && type !== 'expense') {
        return res.status(400).json({ status: "error", message: "Type must be either 'income' or 'expense'" });
    }

    try {
        // Create a new transaction object
        const newTransaction = new transaction({
            type,
            category,
            amount,
            description,
            date: new Date()  // You can set the date manually or allow the user to send it via the request
        });

        // Save the transaction to the database
        await newTransaction.save();

        return res.status(201).json({ status: "success", message: "Transaction added successfully", transaction: newTransaction });
    } catch (error) {
        console.error("Error adding transaction:", error);
        return res.status(500).json({ status: "error", message: "Internal server error" });
    }
});






app.get("/transactions", authenticateToken,async (req, res) => {
    try {
        // Find all transactions in the database
        const transactions = await transaction.find({});
        
        // Respond with the list of transactions
        return res.status(200).json({ status: "success", transactions });
    } catch (error) {
        console.error("Error retrieving transactions:", error);
        return res.status(500).json({ status: "error", message: "Internal server error" });
    }
});



app.get("/transactions", authenticateToken, async (req, res) => {
    try {
        const transactions = await Transaction.find({});
        return res.status(200).json({ status: "success", transactions });
    } catch (error) {
        console.error("Error retrieving transactions:", error);
        return res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

// GET /transactions/:id: Retrieve a transaction by ID
app.get("/transactions/:id", authenticateToken,async (req, res) => {
    try {
        const transaction = await transaction.findById(req.params.id);
        if (!transaction) {
            return res.status(404).json({ status: "error", message: "Transaction not found" });
        }
        return res.status(200).json({ status: "success", transaction });
    } catch (error) {
        console.error("Error retrieving transaction:", error);
        return res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

// PUT /transactions/:id: Update a transaction by ID
app.put("/transactions/:id",authenticateToken, async (req, res) => {
    const { type, category, amount, description } = req.body;

    if (!type || !category || !amount) {
        return res.status(400).json({ status: "error", message: "Missing required fields" });
    }

    if (type !== 'income' && type !== 'expense') {
        return res.status(400).json({ status: "error", message: "Type must be either 'income' or 'expense'" });
    }

    try {
        const updatedTransaction = await transaction.findByIdAndUpdate(
            req.params.id,
            { type, category, amount, description, date: new Date() },
            { new: true }
        );

        if (!updatedTransaction) {
            return res.status(404).json({ status: "error", message: "Transaction not found" });
        }

        return res.status(200).json({ status: "success", message: "Transaction updated successfully", transaction: updatedTransaction });
    } catch (error) {
        console.error("Error updating transaction:", error);
        return res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

// DELETE /transactions/:id: Delete a transaction by ID
app.delete("/transactions/:id",authenticateToken,  async (req, res) => {
    try {
        const deletedTransaction = await transaction.findByIdAndDelete(req.params.id);
        if (!deletedTransaction) {
            return res.status(404).json({ status: "error", message: "Transaction not found" });
        }
        return res.status(200).json({ status: "success", message: "Transaction deleted successfully" });
    } catch (error) {
        console.error("Error deleting transaction:", error);
        return res.status(500).json({ status: "error", message: "Internal server error" });
    }
});



// GET /summary: Retrieves a summary of transactions
app.get("/summary", authenticateToken,async (req, res) => {
    const { startDate, endDate, category } = req.query; // Optional filters

    try {
        // Create a filter object to apply the optional filters
        let filter = {};

        // Filter by date range if provided
        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = new Date(startDate);
            if (endDate) filter.date.$lte = new Date(endDate);
        }

        // Filter by category if provided
        if (category) {
            filter.category = category;
        }

        // Fetch all transactions matching the filter
        const transactions = await transaction.find(filter);

        // Calculate total income and expenses
        const totalIncome = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const totalExpenses = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        // Calculate the balance (income - expenses)
        const balance = totalIncome - totalExpenses;

        // Return the summary response
        return res.status(200).json({
            status: "success",
            totalIncome,
            totalExpenses,
            balance
        });
    } catch (error) {
        console.error("Error retrieving summary:", error);
        return res.status(500).json({ status: "error", message: "Internal server error" });
    }
});


// Server listen
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
