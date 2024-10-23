const mongoose = require('mongoose');

// Use async/await to handle connection
async function connectToDatabase() {
    try {
        await mongoose.connect("mongodb+srv://indrasena197:indrasena@cluster0.dov1iki.mongodb.net/usertable");
        console.log("Successfully connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}

// Call the connection function
connectToDatabase();

// Define a schema using Mongoose Schema class
const newSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    
});
const transactionSchema = new mongoose.Schema({
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: true
    },
    category: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    description: {
      type: String
    }
  });
  
  const transaction = mongoose.model('Transactions', transactionSchema);
// Log schema details for debugging
console.log("Schema defined:", newSchema);

// Create a model for the schema
const collection = mongoose.model("mycollection", newSchema);

// Log collection details for debugging
console.log("Collection created:", collection);

// Export the collection to use in other parts of the application
module.exports = {collection,transaction};
