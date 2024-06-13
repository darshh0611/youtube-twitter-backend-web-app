//require ("dotenv").config({path: "./env"});

import mongoose from "mongoose";

import app from "./app.js";
import connectDB from "./db/db.js";
import dotenv from 'dotenv';
dotenv.config();

connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is successfully running on port ${process.env.PORT}`);
    })
})
.catch((error) => {
    console.log("Database Connection error: ", error);
});