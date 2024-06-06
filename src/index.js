//require ("dotenv").config({path: "./env"});

import mongoose from "mongoose";

import connectDB from "./db/db.js";
import dotenv from 'dotenv';
dotenv.config();



connectDB();