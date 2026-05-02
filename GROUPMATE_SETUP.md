# Groupmate Setup & Troubleshooting Guide

If you are having issues running the system locally after pulling the latest update, follow this checklist.

## 1. Prerequisites
- **Java 17** (Verify with `java -version`)
- **Node.js 18+** (Verify with `node -version`)
- **MySQL 8.0+** (Running locally)

## 2. Database Setup (MOST IMPORTANT)
The backend will **fail to start** (resulting in "Failed to Fetch") if the database does not exist or the password is wrong.
1. Open your MySQL client (CLI or Workbench).
2. Run this command:
   ```sql
   CREATE DATABASE IF NOT EXISTS surgealert_db;
   ```
3. Check your `.env` file in the root directory:
   - `SPRING_DATASOURCE_PASSWORD`: Must match YOUR local MySQL password.
   - `SPRING_DATASOURCE_USERNAME`: Usually `root`.

## 3. Environment Variables (.env)
1. Ensure the `.env` file is in the **repository root** (`SurgeAlert/`).
2. If you are on Windows, ensure the file is named exactly `.env` (no `.txt` extension).
3. Confirm `VITE_API_BASE_URL=http://localhost:8080/api` is present for local testing.

## 4. Running the System Correctly

### Backend
1. Go to `backend/`
2. Run: `./mvnw spring-boot:run` (or use your IDE).
3. **Check Console**: Look for `SUCCESS: head_admin User seeded into Database.`
4. **Diagnostic**: Open `http://localhost:8080/api/sensor-data/latest` in your browser. If you get a JSON object or "Not Found", the backend is alive.

### Frontend
1. Go to `frontend/WebApp/`
2. Run: `npm install` (if you haven't recently).
3. Run: `npm run dev`.
4. Open `http://localhost:5173`.

## 5. Troubleshooting "Failed to Fetch"
This is a network connection error.
- **Backend Crashed?** If MySQL isn't running or the DB doesn't exist, the backend will stop. Check your IDE/Terminal for red text.
- **Port 8080?** Make sure no other app (like another project or a web server) is using port 8080.
- **Vite Config?** Ensure `frontend/WebApp/vite.config.js` has `envDir: '../../'`.

## 6. Tide Data Issues
If tides are missing:
1. Check that `WORLDTIDES_API_KEY` in `.env` is correct.
2. If the backend is running but tides show "Unavailable", the API key might have reached its monthly limit or your internet connection is blocking the request.
