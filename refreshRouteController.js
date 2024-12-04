// refreshRouteController.js
const axios = require("axios");

let intervalId = null; // Variable to store the interval ID

// This function will make the request to the /refresh route itself every 2 minutes
const callRefreshRoute = async () => {
  try {
    // Make an HTTP request to the /refresh route (using axios)
    await axios.get("https://madhuproject.onrender.com/refreshitaxios"); // Replace with your URL
    console.log("Refresh route called successfully");
  } catch (error) {
    console.error("Error calling refresh route:", error.message);
  }
};

// This function is executed when the /refresh route is hit
exports.refresh = (req, res) => {
  try {
    // If interval is not already set, start the repeating task every 2 minutes
    if (!intervalId) {
      intervalId = setInterval(callRefreshRoute, 120000); // 2 minutes = 120000 ms
    }

    // Send a response indicating the task has started
    res.status(200).json({
      message:
        "Background task started, calling the /refresh route every 2 minutes.",
    });
  } catch (error) {
    console.error("Error in refresh route:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
